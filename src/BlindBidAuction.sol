// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BlindBidAuction
 * @notice Sealed-bid commit-reveal auction for The Quiet Room indie game cooperative.
 * @dev Studios commit to a sealed bid with ETH escrow, reveal during reveal phase,
 * and the highest valid bid wins. Tie-breaks favor the earliest valid commitment sequence.
 * Losing revealed bidders pull-refund escrow; unrevealed bids forfeit escrow to the cooperative.
 */
contract BlindBidAuction is ReentrancyGuard {
    // --- Data Types ---

    enum Phase {
        Commit,
        Reveal,
        AwaitingSettlement,
        Settled
    }

    struct BidRecord {
        bytes32 commitment;
        uint256 deposit;
        uint256 sequence;
        uint256 revealedAmount;
        bool revealed;
    }

    // --- Domain Separation ---

    /// @notice EIP-712-style domain hash for commitment uniqueness across contracts and chains
    bytes32 public constant COMMITMENT_DOMAIN = keccak256(
        "BlindBidAuction_Commitment(uint256 chainId,address contractAddress,uint256 auctionId,address bidder,uint256 bidAmount,bytes32 salt)"
    );

    // --- Immutables ---

    uint256 public immutable auctionId;
    address payable public immutable cooperative;
    uint256 public immutable commitDeadline;
    uint256 public immutable revealDeadline;

    // --- State Variables ---

    uint256 public commitmentCounter;
    uint256 public totalDepositedEscrow;
    uint256 public totalRevealedDeposits;

    address public highestBidder;
    uint256 public highestBid;
    uint256 public highestBidSequence;

    bool public settled;
    uint256 public cooperativeProceeds;
    bool public proceedsClaimed;

    mapping(address => BidRecord) public bids;
    mapping(address => bool) public refundClaimed;
    address[] public committedBidders;

    // --- Events ---

    event BidCommitted(address indexed bidder, bytes32 indexed commitment, uint256 deposit, uint256 sequence);
    event BidRevealed(address indexed bidder, uint256 bidAmount);
    event AuctionSettled(address indexed winner, uint256 winningBid, uint256 cooperativeProceeds);
    event RefundWithdrawn(address indexed bidder, uint256 amount);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);

    // --- Custom Errors ---

    error ZeroAddress();
    error InvalidDeadlines();
    error ZeroCommitment();
    error ZeroDeposit();
    error AlreadyCommitted();
    error CommitPhaseEnded();
    error RevealPhaseNotStarted();
    error RevealPhaseEnded();
    error NoCommitmentFound();
    error AlreadyRevealed();
    error ZeroBidAmount();
    error BidExceedsEscrow();
    error CommitmentMismatch();
    error RevealPhaseNotEnded();
    error AlreadySettled();
    error AuctionNotSettled();
    error OnlyCooperative();
    error RefundAlreadyClaimed();
    error ProceedsAlreadyClaimed();
    error NoRefundableBalance();
    error NoProceedsToWithdraw();
    error TransferFailed();
    error DirectETHNotAccepted();

    // --- Constructor ---

    /**
     * @notice Initializes the auction with immutable deadlines, auction ID, and cooperative address.
     * @param _auctionId Unique identifier for this auction instance.
     * @param _cooperative Recipient address for cooperative proceeds and forfeitures.
     * @param _commitDeadline Timestamp after which no more commits are accepted.
     * @param _revealDeadline Timestamp after which no more reveals are accepted and settlement is enabled.
     */
    constructor(uint256 _auctionId, address payable _cooperative, uint256 _commitDeadline, uint256 _revealDeadline) {
        if (_cooperative == address(0)) revert ZeroAddress();
        if (_commitDeadline <= block.timestamp || _revealDeadline <= _commitDeadline) {
            revert InvalidDeadlines();
        }

        auctionId = _auctionId;
        cooperative = _cooperative;
        commitDeadline = _commitDeadline;
        revealDeadline = _revealDeadline;
    }

    // --- Core Functions ---

    /**
     * @notice Computes domain-separated commitment hash.
     * @param bidder Studio address making the bid.
     * @param bidAmount The plaintext bid in wei.
     * @param salt The 256-bit cryptographically secure secret salt.
     * @return Domain-separated commitment hash.
     */
    function getCommitmentHash(address bidder, uint256 bidAmount, bytes32 salt) public view returns (bytes32) {
        return
            keccak256(abi.encode(COMMITMENT_DOMAIN, block.chainid, address(this), auctionId, bidder, bidAmount, salt));
    }

    /**
     * @notice Returns current lifecycle phase of the auction.
     */
    function getPhase() public view returns (Phase) {
        if (settled) {
            return Phase.Settled;
        }
        if (block.timestamp < commitDeadline) {
            return Phase.Commit;
        }
        if (block.timestamp < revealDeadline) {
            return Phase.Reveal;
        }
        return Phase.AwaitingSettlement;
    }

    /**
     * @notice Commits a sealed bid accompanied by ETH escrow deposit.
     * @dev Never emits plaintext bid or salt. Exactly one commitment allowed per bidder.
     * @param commitment The keccak256 commitment hash.
     */
    function commitBid(bytes32 commitment) external payable nonReentrant {
        if (block.timestamp >= commitDeadline) revert CommitPhaseEnded();
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (msg.value == 0) revert ZeroDeposit();
        if (bids[msg.sender].commitment != bytes32(0)) revert AlreadyCommitted();

        uint256 seq = ++commitmentCounter;
        bids[msg.sender] =
            BidRecord({commitment: commitment, deposit: msg.value, sequence: seq, revealedAmount: 0, revealed: false});
        committedBidders.push(msg.sender);
        totalDepositedEscrow += msg.value;

        emit BidCommitted(msg.sender, commitment, msg.value, seq);
    }

    /**
     * @notice Reveals a previously committed bid using plaintext bid amount and salt.
     * @dev Recomputes commitment using `msg.sender` and validates escrow backing.
     * @param bidAmount Plaintext bid amount in wei.
     * @param salt 256-bit secret salt used during commitment.
     */
    function revealBid(uint256 bidAmount, bytes32 salt) external nonReentrant {
        if (block.timestamp < commitDeadline) revert RevealPhaseNotStarted();
        if (block.timestamp >= revealDeadline) revert RevealPhaseEnded();

        BidRecord storage record = bids[msg.sender];
        if (record.commitment == bytes32(0)) revert NoCommitmentFound();
        if (record.revealed) revert AlreadyRevealed();
        if (bidAmount == 0) revert ZeroBidAmount();
        if (bidAmount > record.deposit) revert BidExceedsEscrow();

        bytes32 expected = getCommitmentHash(msg.sender, bidAmount, salt);
        if (expected != record.commitment) revert CommitmentMismatch();

        record.revealed = true;
        record.revealedAmount = bidAmount;
        totalRevealedDeposits += record.deposit;

        // Evaluate winner under deterministic tie-breaking:
        // Highest bid wins. If equal, lowest sequence number (earliest commitment) wins.
        if (bidAmount > highestBid) {
            highestBidder = msg.sender;
            highestBid = bidAmount;
            highestBidSequence = record.sequence;
        } else if (bidAmount == highestBid) {
            if (highestBidder == address(0) || record.sequence < highestBidSequence) {
                highestBidder = msg.sender;
                highestBid = bidAmount;
                highestBidSequence = record.sequence;
            }
        }

        emit BidRevealed(msg.sender, bidAmount);
    }

    /**
     * @notice Permissionlessly settles auction after reveal deadline.
     * @dev Executes in O(1) constant time without loops. Does not require all bidders to reveal.
     */
    function settleAuction() external nonReentrant {
        if (block.timestamp < revealDeadline) revert RevealPhaseNotEnded();
        if (settled) revert AlreadySettled();

        settled = true;

        // Any deposit from bidders who did not reveal is forfeited to the cooperative.
        uint256 unrevealedForfeitures = totalDepositedEscrow - totalRevealedDeposits;
        cooperativeProceeds = highestBid + unrevealedForfeitures;

        emit AuctionSettled(highestBidder, highestBid, cooperativeProceeds);
    }

    // --- Pull-Payment Withdrawals ---

    /**
     * @notice Computes available refundable balance for a bidder.
     * @param bidder Address of the studio.
     * @return Refundable amount in wei.
     */
    function getRefundAmount(address bidder) public view returns (uint256) {
        if (!settled) return 0;
        if (refundClaimed[bidder]) return 0;

        BidRecord storage record = bids[bidder];
        // Unrevealed bidders forfeit their escrow
        if (!record.revealed) return 0;

        if (bidder == highestBidder) {
            // Winning studio recovers unused escrow surplus
            return record.deposit - highestBid;
        } else {
            // Losing revealed studio recovers full escrow deposit
            return record.deposit;
        }
    }

    /**
     * @notice Pull payment function for eligible bidders to withdraw refundable escrow.
     */
    function withdrawRefund() external nonReentrant {
        if (!settled) revert AuctionNotSettled();
        if (refundClaimed[msg.sender]) revert RefundAlreadyClaimed();

        uint256 amount = getRefundAmount(msg.sender);
        if (amount == 0) revert NoRefundableBalance();

        refundClaimed[msg.sender] = true;

        emit RefundWithdrawn(msg.sender, amount);

        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Pull payment function for the cooperative to withdraw winning bid and forfeited funds.
     */
    function withdrawProceeds() external nonReentrant {
        if (!settled) revert AuctionNotSettled();
        if (msg.sender != cooperative) revert OnlyCooperative();
        if (proceedsClaimed) revert ProceedsAlreadyClaimed();

        uint256 amount = cooperativeProceeds;
        if (amount == 0) revert NoProceedsToWithdraw();

        proceedsClaimed = true;

        emit ProceedsWithdrawn(cooperative, amount);

        (bool success,) = cooperative.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // --- View Helpers ---

    /**
     * @notice Returns full bidder record including refund claim status.
     */
    function getBid(address bidder)
        external
        view
        returns (
            bytes32 commitment,
            uint256 deposit,
            uint256 sequence,
            uint256 revealedAmount,
            bool revealed,
            bool isRefundClaimed
        )
    {
        BidRecord storage b = bids[bidder];
        return (b.commitment, b.deposit, b.sequence, b.revealedAmount, b.revealed, refundClaimed[bidder]);
    }

    struct AuctionDetails {
        uint256 auctionId;
        address cooperative;
        uint256 commitDeadline;
        uint256 revealDeadline;
        Phase phase;
        bool settled;
        address highestBidder;
        uint256 highestBid;
        uint256 highestBidSequence;
        uint256 cooperativeProceeds;
        bool proceedsClaimed;
        uint256 totalDepositedEscrow;
        uint256 totalRevealedDeposits;
        uint256 commitmentCount;
    }

    /**
     * @notice Returns comprehensive auction details for dashboard display.
     */
    function getAuctionDetails() external view returns (AuctionDetails memory details) {
        details.auctionId = auctionId;
        details.cooperative = cooperative;
        details.commitDeadline = commitDeadline;
        details.revealDeadline = revealDeadline;
        details.phase = getPhase();
        details.settled = settled;
        details.highestBidder = highestBidder;
        details.highestBid = highestBid;
        details.highestBidSequence = highestBidSequence;
        details.cooperativeProceeds = cooperativeProceeds;
        details.proceedsClaimed = proceedsClaimed;
        details.totalDepositedEscrow = totalDepositedEscrow;
        details.totalRevealedDeposits = totalRevealedDeposits;
        details.commitmentCount = commitmentCounter;
    }

    /**
     * @notice Returns total number of registered bidders.
     */
    function getCommittedBiddersCount() external view returns (uint256) {
        return committedBidders.length;
    }

    // Reject direct ETH transfers outside of commitBid
    receive() external payable {
        revert DirectETHNotAccepted();
    }

    fallback() external payable {
        revert DirectETHNotAccepted();
    }
}
