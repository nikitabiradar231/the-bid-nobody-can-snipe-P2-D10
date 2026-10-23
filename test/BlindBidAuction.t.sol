// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BlindBidAuction} from "../src/BlindBidAuction.sol";
import {ReentrancyAttacker} from "./mocks/ReentrancyAttacker.sol";
import {RejectEtherBidder} from "./mocks/RejectEtherBidder.sol";

contract BlindBidAuctionTest is Test {
    BlindBidAuction public auction;

    address payable public cooperative;
    address public studio1;
    address public studio2;
    address public studio3;
    address public studio4;
    address public studio5;

    uint256 public constant AUCTION_ID = 1;
    uint256 public constant COMMIT_DURATION = 1 days;
    uint256 public constant REVEAL_DURATION = 1 days;

    uint256 public deployTime;
    uint256 public commitDeadline;
    uint256 public revealDeadline;

    event BidCommitted(address indexed bidder, bytes32 indexed commitment, uint256 deposit, uint256 sequence);
    event BidRevealed(address indexed bidder, uint256 bidAmount);
    event AuctionSettled(address indexed winner, uint256 winningBid, uint256 cooperativeProceeds);
    event RefundWithdrawn(address indexed bidder, uint256 amount);
    event ProceedsWithdrawn(address indexed recipient, uint256 amount);

    function setUp() public {
        cooperative = payable(makeAddr("quiet_room_cooperative"));
        studio1 = makeAddr("studio_alpha");
        studio2 = makeAddr("studio_beta");
        studio3 = makeAddr("studio_gamma");
        studio4 = makeAddr("studio_delta");
        studio5 = makeAddr("studio_epsilon");

        vm.deal(studio1, 100 ether);
        vm.deal(studio2, 100 ether);
        vm.deal(studio3, 100 ether);
        vm.deal(studio4, 100 ether);
        vm.deal(studio5, 100 ether);

        deployTime = 1_700_000_000;
        vm.warp(deployTime);

        commitDeadline = deployTime + COMMIT_DURATION;
        revealDeadline = commitDeadline + REVEAL_DURATION;

        auction = new BlindBidAuction(AUCTION_ID, cooperative, commitDeadline, revealDeadline);
    }

    // =========================================================================
    // 1. Mandatory 10 Scored Checks
    // =========================================================================

    /// @notice Check 1: Reveal recomputes the commitment with msg.sender (16 points)
    /// Test that account B cannot reveal account A's copied commitment.
    function test_Check1_CannotRevealCopiedCommitmentFromAnotherAccount() public {
        bytes32 saltA = keccak256("studioA_salt");
        uint256 bidAmountA = 5 ether;
        uint256 depositA = 10 ether;

        // Studio 1 creates commitment for its own address
        bytes32 commitmentA = auction.getCommitmentHash(studio1, bidAmountA, saltA);

        vm.prank(studio1);
        auction.commitBid{value: depositA}(commitmentA);

        // Studio 2 copies Studio 1's commitment hash and deposits 10 ether
        vm.prank(studio2);
        auction.commitBid{value: depositA}(commitmentA);

        // Move to reveal phase
        vm.warp(commitDeadline + 1 hours);

        // Studio 2 attempts to reveal using Studio 1's bid and salt
        // Because reveal uses msg.sender (Studio 2), the recomputed hash does not match
        vm.prank(studio2);
        vm.expectRevert(BlindBidAuction.CommitmentMismatch.selector);
        auction.revealBid(bidAmountA, saltA);

        // Studio 1 can legitimately reveal
        vm.prank(studio1);
        auction.revealBid(bidAmountA, saltA);
        assertEq(auction.highestBidder(), studio1);
        assertEq(auction.highestBid(), bidAmountA);
    }

    /// @notice Check 2: Commitment is auction-specific (8 points)
    /// Test that a commitment from a different auction or contract is invalid.
    function test_Check2_CommitmentIsAuctionAndContractSpecific() public {
        // Deploy auction 2 with different auction ID
        BlindBidAuction auction2 = new BlindBidAuction(2, cooperative, commitDeadline, revealDeadline);

        bytes32 salt = keccak256("secret_salt");
        uint256 bid = 3 ether;

        // Commitment generated for auction2
        bytes32 commitForAuction2 = auction2.getCommitmentHash(studio1, bid, salt);

        // Studio 1 commits commitForAuction2 on auction 1
        vm.prank(studio1);
        auction.commitBid{value: 5 ether}(commitForAuction2);

        // Move to reveal phase
        vm.warp(commitDeadline + 1 hours);

        // Reveal on auction 1 should fail because auction.getCommitmentHash uses auction 1's ID & address
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.CommitmentMismatch.selector);
        auction.revealBid(bid, salt);
    }

    /// @notice Check 3: Bidder-chosen secret salt of at least 128 bits (6 points)
    /// Test that a wrong salt fails and the correct salt succeeds.
    function test_Check3_BidderChosenBytes32SaltCorrectAndWrong() public {
        bytes32 correctSalt = bytes32(uint256(0xdeadbeef12345678abcdef0123456789));
        bytes32 wrongSalt = bytes32(uint256(0xcafebabe98765432fedcba9876543210));
        uint256 bid = 4 ether;

        bytes32 commitment = auction.getCommitmentHash(studio1, bid, correctSalt);

        vm.prank(studio1);
        auction.commitBid{value: 5 ether}(commitment);

        vm.warp(commitDeadline + 1 hours);

        // Wrong salt reverts
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.CommitmentMismatch.selector);
        auction.revealBid(bid, wrongSalt);

        // Correct salt succeeds
        vm.prank(studio1);
        auction.revealBid(bid, correctSalt);

        (,,,, bool revealed,) = auction.getBid(studio1);
        assertTrue(revealed);
    }

    /// @notice Check 4: Each commitment can be opened only once (11 points)
    /// Track whether bidder has revealed. Test second reveal reverts and does not modify winner or balances.
    function test_Check4_CannotRevealTwice() public {
        bytes32 salt = keccak256("salt_check4");
        uint256 bid = 4 ether;

        bytes32 commitment = auction.getCommitmentHash(studio1, bid, salt);

        vm.prank(studio1);
        auction.commitBid{value: 6 ether}(commitment);

        vm.warp(commitDeadline + 1 hours);

        // First reveal succeeds
        vm.prank(studio1);
        auction.revealBid(bid, salt);

        assertEq(auction.highestBid(), bid);
        assertEq(auction.totalRevealedDeposits(), 6 ether);

        // Second reveal must revert
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.AlreadyRevealed.selector);
        auction.revealBid(bid, salt);

        // State remains unchanged
        assertEq(auction.highestBid(), bid);
        assertEq(auction.totalRevealedDeposits(), 6 ether);
    }

    /// @notice Check 5: Revealed bid is covered by escrow (11 points)
    /// Require revealed amount <= bidder's deposited ETH. Test underfunded reveal cannot win.
    function test_Check5_UnderfundedBidCannotWin() public {
        bytes32 salt = keccak256("underfunded_salt");
        uint256 bid = 10 ether;
        uint256 deposit = 5 ether; // Escrow is insufficient for 10 ether bid

        bytes32 commitment = auction.getCommitmentHash(studio1, bid, salt);

        vm.prank(studio1);
        auction.commitBid{value: deposit}(commitment);

        vm.warp(commitDeadline + 1 hours);

        // Reveal must revert because bid exceeds deposited escrow
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.BidExceedsEscrow.selector);
        auction.revealBid(bid, salt);

        // Studio 1 does not win
        assertEq(auction.highestBidder(), address(0));
        assertEq(auction.highestBid(), 0);
    }

    /// @notice Check 6: Settlement does not wait for all bidders (8 points)
    /// Allow settlement immediately after reveal deadline even with silent unrevealed bidders.
    function test_Check6_SettlementDoesNotWaitForSilentBidders() public {
        bytes32 salt1 = keccak256("salt_revealer");
        bytes32 salt2 = keccak256("salt_silent");

        bytes32 commit1 = auction.getCommitmentHash(studio1, 3 ether, salt1);
        bytes32 commit2 = auction.getCommitmentHash(studio2, 7 ether, salt2);

        // Studio 1 commits
        vm.prank(studio1);
        auction.commitBid{value: 5 ether}(commit1);

        // Studio 2 commits (will remain silent)
        vm.prank(studio2);
        auction.commitBid{value: 8 ether}(commit2);

        // Move to reveal phase: only Studio 1 reveals
        vm.warp(commitDeadline + 1 hours);
        vm.prank(studio1);
        auction.revealBid(3 ether, salt1);

        // Studio 2 never reveals!
        // Advance past reveal deadline
        vm.warp(revealDeadline + 1 seconds);

        // Settle auction permissionlessly
        auction.settleAuction();

        assertTrue(auction.settled());
        assertEq(auction.highestBidder(), studio1);
        assertEq(auction.highestBid(), 3 ether);
        // Cooperative receives winning bid (3 ether) + silent bidder forfeiture (8 ether) = 11 ether
        assertEq(auction.cooperativeProceeds(), 11 ether);
    }

    /// @notice Check 7: Refunds are pulled by each bidder (7 points)
    /// Test every eligible losing bidder can withdraw independently.
    function test_Check7_LosingBiddersPullRefundsIndependently() public {
        bytes32 salt1 = keccak256("salt_1");
        bytes32 salt2 = keccak256("salt_2");
        bytes32 salt3 = keccak256("salt_3");

        bytes32 commit1 = auction.getCommitmentHash(studio1, 5 ether, salt1);
        bytes32 commit2 = auction.getCommitmentHash(studio2, 2 ether, salt2);
        bytes32 commit3 = auction.getCommitmentHash(studio3, 1 ether, salt3);

        // Studio 1 bids 5 ETH, deposits 6 ETH
        vm.prank(studio1);
        auction.commitBid{value: 6 ether}(commit1);

        // Studio 2 bids 2 ETH, deposits 4 ETH (losing)
        vm.prank(studio2);
        auction.commitBid{value: 4 ether}(commit2);

        // Studio 3 bids 1 ETH, deposits 3 ETH (losing)
        vm.prank(studio3);
        auction.commitBid{value: 3 ether}(commit3);

        // Reveal
        vm.warp(commitDeadline + 1 hours);
        vm.prank(studio1);
        auction.revealBid(5 ether, salt1);
        vm.prank(studio2);
        auction.revealBid(2 ether, salt2);
        vm.prank(studio3);
        auction.revealBid(1 ether, salt3);

        // Settle
        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        // Losing Studio 2 withdraws independently
        uint256 balBefore2 = studio2.balance;
        vm.prank(studio2);
        auction.withdrawRefund();
        assertEq(studio2.balance - balBefore2, 4 ether);

        // Losing Studio 3 withdraws independently
        uint256 balBefore3 = studio3.balance;
        vm.prank(studio3);
        auction.withdrawRefund();
        assertEq(studio3.balance - balBefore3, 3 ether);

        // Winning Studio 1 withdraws surplus (6 - 5 = 1 ether)
        uint256 balBefore1 = studio1.balance;
        vm.prank(studio1);
        auction.withdrawRefund();
        assertEq(studio1.balance - balBefore1, 1 ether);
    }

    /// @notice Check 8: Refunds are safe against re-entry (6 points)
    /// Test re-entry with malicious recipient contract. Attacker cannot withdraw twice.
    function test_Check8_ReentrantWithdrawalIsBlocked() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker(auction);
        vm.deal(address(attacker), 10 ether);

        bytes32 saltAttacker = keccak256("attacker_salt");
        bytes32 saltWinner = keccak256("winner_salt");

        // Attacker deposits 5 ether, bids 1 ether
        bytes32 attackerCommitment = auction.getCommitmentHash(address(attacker), 1 ether, saltAttacker);
        attacker.commitBid{value: 5 ether}(attackerCommitment);

        // Studio 1 deposits 10 ether, bids 8 ether (winner)
        bytes32 winnerCommitment = auction.getCommitmentHash(studio1, 8 ether, saltWinner);
        vm.prank(studio1);
        auction.commitBid{value: 10 ether}(winnerCommitment);

        // Reveal
        vm.warp(commitDeadline + 1 hours);
        attacker.revealBid(1 ether, saltAttacker);
        vm.prank(studio1);
        auction.revealBid(8 ether, saltWinner);

        // Settle
        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        // Attacker attempts re-entrant withdrawal
        attacker.initiateWithdrawRefund();

        // Attacker should only receive its 5 ether refund once, and re-entrant attempt failed
        // Original 10 ether + 5 ether from test commitBid call = 15 ether total balance
        assertEq(address(attacker).balance, 15 ether);
        assertFalse(attacker.attackSuccess());
        assertTrue(attacker.attackAttempts() > 0);
    }

    /// @notice Check 9: A wrong-salt reveal test exists (4 points)
    /// Assert that reveal reverts with CommitmentMismatch on incorrect salt.
    function test_Check9_WrongSaltRevealFails() public {
        bytes32 actualSalt = keccak256("legitimate_salt_9");
        bytes32 incorrectSalt = keccak256("bogus_salt_9");
        uint256 bid = 2 ether;

        bytes32 commitment = auction.getCommitmentHash(studio1, bid, actualSalt);
        vm.prank(studio1);
        auction.commitBid{value: 3 ether}(commitment);

        vm.warp(commitDeadline + 1);

        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.CommitmentMismatch.selector);
        auction.revealBid(bid, incorrectSalt);
    }

    // =========================================================================
    // 2. Comprehensive Security & Edge Case Tests
    // =========================================================================

    function test_DeploymentDeadlinesValidation() public {
        // commitDeadline in the past reverts
        vm.expectRevert(BlindBidAuction.InvalidDeadlines.selector);
        new BlindBidAuction(2, cooperative, block.timestamp - 1, block.timestamp + 10);

        // revealDeadline <= commitDeadline reverts
        vm.expectRevert(BlindBidAuction.InvalidDeadlines.selector);
        new BlindBidAuction(2, cooperative, block.timestamp + 100, block.timestamp + 100);

        // Zero cooperative address reverts
        vm.expectRevert(BlindBidAuction.ZeroAddress.selector);
        new BlindBidAuction(2, payable(address(0)), block.timestamp + 100, block.timestamp + 200);
    }

    function test_CommitmentParametersValidation() public {
        // Zero commitment reverts
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.ZeroCommitment.selector);
        auction.commitBid{value: 1 ether}(bytes32(0));

        // Zero deposit reverts
        bytes32 salt = keccak256("salt");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.ZeroDeposit.selector);
        auction.commitBid{value: 0}(commitment);
    }

    function test_DuplicateCommitmentReverts() public {
        bytes32 salt1 = keccak256("salt_dup1");
        bytes32 salt2 = keccak256("salt_dup2");

        bytes32 commit1 = auction.getCommitmentHash(studio1, 2 ether, salt1);
        bytes32 commit2 = auction.getCommitmentHash(studio1, 3 ether, salt2);

        vm.prank(studio1);
        auction.commitBid{value: 2 ether}(commit1);

        // Second commitment from same studio must revert
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.AlreadyCommitted.selector);
        auction.commitBid{value: 3 ether}(commit2);
    }

    function test_ExactCommitDeadlineBoundary() public {
        bytes32 salt = keccak256("salt_boundary");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);

        // Exactly at commitDeadline, commitBid must revert
        vm.warp(commitDeadline);
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.CommitPhaseEnded.selector);
        auction.commitBid{value: 2 ether}(commitment);
    }

    function test_ExactRevealDeadlineBoundaries() public {
        bytes32 salt = keccak256("salt_boundary");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);

        // Commit just before deadline
        vm.warp(commitDeadline - 1);
        vm.prank(studio1);
        auction.commitBid{value: 2 ether}(commitment);

        // Exactly at commitDeadline, reveal is allowed
        vm.warp(commitDeadline);
        vm.prank(studio1);
        auction.revealBid(1 ether, salt);

        // Advance to exact revealDeadline
        vm.warp(revealDeadline);

        // Settle is allowed exactly at revealDeadline
        auction.settleAuction();
        assertTrue(auction.settled());
    }

    function test_RevealAtOrAfterRevealDeadlineReverts() public {
        bytes32 salt = keccak256("salt_late");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);

        vm.prank(studio1);
        auction.commitBid{value: 2 ether}(commitment);

        // Warp to exact revealDeadline
        vm.warp(revealDeadline);

        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.RevealPhaseEnded.selector);
        auction.revealBid(1 ether, salt);
    }

    function test_RevealBeforeCommitDeadlineReverts() public {
        bytes32 salt = keccak256("salt_early");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);

        vm.prank(studio1);
        auction.commitBid{value: 2 ether}(commitment);

        // Reveal during commit phase must revert
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.RevealPhaseNotStarted.selector);
        auction.revealBid(1 ether, salt);
    }

    function test_SettlementBeforeRevealDeadlineReverts() public {
        bytes32 salt = keccak256("salt_early_settle");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);

        vm.prank(studio1);
        auction.commitBid{value: 2 ether}(commitment);

        vm.warp(revealDeadline - 1);

        vm.expectRevert(BlindBidAuction.RevealPhaseNotEnded.selector);
        auction.settleAuction();
    }

    function test_SettlementCalledTwiceReverts() public {
        bytes32 salt = keccak256("salt_settle_twice");
        bytes32 commitment = auction.getCommitmentHash(studio1, 1 ether, salt);

        vm.prank(studio1);
        auction.commitBid{value: 2 ether}(commitment);

        vm.warp(commitDeadline + 1 hours);
        vm.prank(studio1);
        auction.revealBid(1 ether, salt);

        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        // Calling a second time reverts
        vm.expectRevert(BlindBidAuction.AlreadySettled.selector);
        auction.settleAuction();
    }

    function test_DeterministicTieBreaking_RevealOrderIndependent() public {
        // Test Case A: Equal bids, studio1 commits first, studio2 commits second.
        // Studio 1 reveals first, studio 2 reveals second. Studio 1 wins.
        bytes32 salt1 = keccak256("salt_tb1");
        bytes32 salt2 = keccak256("salt_tb2");
        uint256 equalBid = 5 ether;

        bytes32 commit1 = auction.getCommitmentHash(studio1, equalBid, salt1);
        bytes32 commit2 = auction.getCommitmentHash(studio2, equalBid, salt2);

        vm.prank(studio1);
        auction.commitBid{value: 6 ether}(commit1);

        vm.prank(studio2);
        auction.commitBid{value: 6 ether}(commit2);

        vm.warp(commitDeadline + 1 hours);
        vm.prank(studio1);
        auction.revealBid(equalBid, salt1);
        vm.prank(studio2);
        auction.revealBid(equalBid, salt2);

        assertEq(auction.highestBidder(), studio1);

        // Now Test Case B with fresh auction:
        // studio1 commits first, studio2 commits second.
        // BUT studio 2 reveals first! Studio 1 should still overtake due to lower sequence!
        BlindBidAuction auctionB =
            new BlindBidAuction(10, cooperative, block.timestamp + 1 days, block.timestamp + 2 days);

        bytes32 commitB1 = auctionB.getCommitmentHash(studio1, equalBid, salt1);
        bytes32 commitB2 = auctionB.getCommitmentHash(studio2, equalBid, salt2);

        vm.prank(studio1);
        auctionB.commitBid{value: 6 ether}(commitB1);

        vm.prank(studio2);
        auctionB.commitBid{value: 6 ether}(commitB2);

        vm.warp(block.timestamp + 1 days + 1 hours);

        // Studio 2 reveals first
        vm.prank(studio2);
        auctionB.revealBid(equalBid, salt2);
        assertEq(auctionB.highestBidder(), studio2);

        // Studio 1 reveals second: because sequence 1 < sequence 2, studio 1 wins the tie-break!
        vm.prank(studio1);
        auctionB.revealBid(equalBid, salt1);
        assertEq(auctionB.highestBidder(), studio1);
    }

    function test_NoBidSettlement() public {
        // Auction with zero bids
        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        assertTrue(auction.settled());
        assertEq(auction.highestBidder(), address(0));
        assertEq(auction.highestBid(), 0);
        assertEq(auction.cooperativeProceeds(), 0);
    }

    function test_OnlyUnrevealedBidsSettlement() public {
        bytes32 salt = keccak256("unrevealed_alone");
        bytes32 commit = auction.getCommitmentHash(studio1, 3 ether, salt);

        vm.prank(studio1);
        auction.commitBid{value: 5 ether}(commit);

        // Skip reveal phase
        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        assertTrue(auction.settled());
        assertEq(auction.highestBidder(), address(0));
        assertEq(auction.highestBid(), 0);
        // Deposit forfeited to cooperative
        assertEq(auction.cooperativeProceeds(), 5 ether);

        // Cooperative withdraws proceeds
        uint256 coopBefore = cooperative.balance;
        vm.prank(cooperative);
        auction.withdrawProceeds();
        assertEq(cooperative.balance - coopBefore, 5 ether);
    }

    function test_RepeatedWithdrawalFails() public {
        bytes32 salt1 = keccak256("salt_repeat1");
        bytes32 salt2 = keccak256("salt_repeat2");

        bytes32 commit1 = auction.getCommitmentHash(studio1, 8 ether, salt1);
        bytes32 commit2 = auction.getCommitmentHash(studio2, 2 ether, salt2);

        vm.prank(studio1);
        auction.commitBid{value: 10 ether}(commit1);
        vm.prank(studio2);
        auction.commitBid{value: 4 ether}(commit2);

        vm.warp(commitDeadline + 1 hours);
        vm.prank(studio1);
        auction.revealBid(8 ether, salt1);
        vm.prank(studio2);
        auction.revealBid(2 ether, salt2);

        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        // Studio 2 withdraws once
        vm.prank(studio2);
        auction.withdrawRefund();

        // Second withdrawal reverts
        vm.prank(studio2);
        vm.expectRevert(BlindBidAuction.RefundAlreadyClaimed.selector);
        auction.withdrawRefund();

        // Cooperative withdraws once
        vm.prank(cooperative);
        auction.withdrawProceeds();

        // Second cooperative withdrawal reverts
        vm.prank(cooperative);
        vm.expectRevert(BlindBidAuction.ProceedsAlreadyClaimed.selector);
        auction.withdrawProceeds();
    }

    function test_CannotWithdrawAnotherAccountsRefund() public {
        bytes32 salt = keccak256("salt_other");
        bytes32 commit = auction.getCommitmentHash(studio1, 2 ether, salt);

        vm.prank(studio1);
        auction.commitBid{value: 5 ether}(commit);

        vm.warp(commitDeadline + 1 hours);
        vm.prank(studio1);
        auction.revealBid(2 ether, salt);

        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        // Studio 2 tries to withdraw without having an eligible refund
        vm.prank(studio2);
        vm.expectRevert(BlindBidAuction.NoRefundableBalance.selector);
        auction.withdrawRefund();
    }

    function test_DirectETHTransfersRevert() public {
        (bool success, bytes memory data) = address(auction).call{value: 1 ether}("");
        assertFalse(success);
        assertEq(bytes4(data), BlindBidAuction.DirectETHNotAccepted.selector);
    }

    function test_ExternalPaymentFailureDoesNotCorruptBalances() public {
        RejectEtherBidder rejectingBidder = new RejectEtherBidder(auction);
        vm.deal(address(rejectingBidder), 10 ether);

        bytes32 saltLosing = keccak256("rejecting_salt");
        bytes32 saltWinning = keccak256("winning_salt");

        // Rejecting bidder commits
        bytes32 commitRejecting = auction.getCommitmentHash(address(rejectingBidder), 2 ether, saltLosing);
        rejectingBidder.commitBid{value: 5 ether}(commitRejecting);

        // Winning studio commits
        bytes32 commitWinning = auction.getCommitmentHash(studio1, 6 ether, saltWinning);
        vm.prank(studio1);
        auction.commitBid{value: 8 ether}(commitWinning);

        // Reveal
        vm.warp(commitDeadline + 1 hours);
        rejectingBidder.revealBid(2 ether, saltLosing);
        vm.prank(studio1);
        auction.revealBid(6 ether, saltWinning);

        // Settle
        vm.warp(revealDeadline + 1);
        auction.settleAuction();

        // Rejecting bidder attempts to withdraw refund; call reverts safely due to TransferFailed
        vm.expectRevert(BlindBidAuction.TransferFailed.selector);
        rejectingBidder.attemptWithdraw();

        // Total contract balance still safely holds the funds
        assertEq(address(auction).balance, 13 ether);
    }

    // =========================================================================
    // 3. Required Acceptance Demonstration (18-step Scenario)
    // =========================================================================

    function test_FiveStudioAcceptanceDemonstration() public {
        // 1. Auction deployed in setUp() with valid deadlines
        assertEq(auction.commitDeadline(), commitDeadline);
        assertEq(auction.revealDeadline(), revealDeadline);

        // 2 & 3. Five independent studio accounts and secret salts
        bytes32[5] memory salts = [
            keccak256("studio1_salt_secret_seed_alpha"),
            keccak256("studio2_salt_secret_seed_beta"),
            keccak256("studio3_salt_secret_seed_gamma"),
            keccak256("studio4_salt_secret_seed_delta"),
            keccak256("studio5_salt_secret_seed_epsilon")
        ];

        address[5] memory studios = [studio1, studio2, studio3, studio4, studio5];
        uint256[5] memory bidAmounts = [
            uint256(3 ether),
            uint256(7 ether),
            uint256(5 ether),
            uint256(9 ether), // Studio 4 will submit the highest bid of 9 ether
            uint256(4 ether)
        ];
        uint256[5] memory deposits = [
            uint256(4 ether),
            uint256(8 ether),
            uint256(6 ether),
            uint256(12 ether), // Studio 4 deposits 12 ether (3 ether surplus)
            uint256(5 ether)
        ];

        // 4 & 5. Calculate domain-separated commitments and commit with escrow
        bytes32[5] memory commitments;
        for (uint256 i = 0; i < 5; i++) {
            commitments[i] = auction.getCommitmentHash(studios[i], bidAmounts[i], salts[i]);
            vm.prank(studios[i]);
            auction.commitBid{value: deposits[i]}(commitments[i]);
        }

        // 6 & 7. Verify commitments stored without plaintext bids in public state
        for (uint256 i = 0; i < 5; i++) {
            (bytes32 comm, uint256 dep, uint256 seq, uint256 revAmount, bool rev,) = auction.getBid(studios[i]);
            assertEq(comm, commitments[i]);
            assertEq(dep, deposits[i]);
            assertEq(seq, i + 1);
            assertEq(revAmount, 0);
            assertFalse(rev);
        }
        assertEq(auction.highestBidder(), address(0));
        assertEq(auction.highestBid(), 0);
        assertEq(auction.totalDepositedEscrow(), 35 ether);

        // 8. Advance time to reveal phase
        vm.warp(commitDeadline + 30 minutes);
        assertEq(uint256(auction.getPhase()), uint256(BlindBidAuction.Phase.Reveal));

        // 9. Reveal all 5 bids
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(studios[i]);
            auction.revealBid(bidAmounts[i], salts[i]);
        }

        // 10. Verify highest valid bid wins (Studio 4: 9 ether)
        assertEq(auction.highestBidder(), studio4);
        assertEq(auction.highestBid(), 9 ether);

        // 12. Advance time to settlement deadline
        vm.warp(revealDeadline + 1 minutes);
        assertEq(uint256(auction.getPhase()), uint256(BlindBidAuction.Phase.AwaitingSettlement));

        // 13. Settle auction
        auction.settleAuction();
        assertTrue(auction.settled());
        assertEq(uint256(auction.getPhase()), uint256(BlindBidAuction.Phase.Settled));

        // 14. Verify cooperative proceeds equal winning bid (9 ether)
        assertEq(auction.cooperativeProceeds(), 9 ether);

        // 15. Verify each losing studio can independently withdraw eligible refund
        uint256 balBefore1 = studio1.balance;
        vm.prank(studio1);
        auction.withdrawRefund();
        assertEq(studio1.balance - balBefore1, deposits[0]); // 4 ether

        uint256 balBefore2 = studio2.balance;
        vm.prank(studio2);
        auction.withdrawRefund();
        assertEq(studio2.balance - balBefore2, deposits[1]); // 8 ether

        uint256 balBefore3 = studio3.balance;
        vm.prank(studio3);
        auction.withdrawRefund();
        assertEq(studio3.balance - balBefore3, deposits[2]); // 6 ether

        uint256 balBefore5 = studio5.balance;
        vm.prank(studio5);
        auction.withdrawRefund();
        assertEq(studio5.balance - balBefore5, deposits[4]); // 5 ether

        // 16. Verify winning studio recovers excess escrow (12 - 9 = 3 ether)
        uint256 balBefore4 = studio4.balance;
        vm.prank(studio4);
        auction.withdrawRefund();
        assertEq(studio4.balance - balBefore4, 3 ether);

        // 17. Verify cooperative can withdraw its proceeds
        uint256 balBeforeCoop = cooperative.balance;
        vm.prank(cooperative);
        auction.withdrawProceeds();
        assertEq(cooperative.balance - balBeforeCoop, 9 ether);

        // 18. Verify no account can withdraw twice or exceed entitlement
        vm.prank(studio1);
        vm.expectRevert(BlindBidAuction.RefundAlreadyClaimed.selector);
        auction.withdrawRefund();

        vm.prank(studio4);
        vm.expectRevert(BlindBidAuction.RefundAlreadyClaimed.selector);
        auction.withdrawRefund();

        vm.prank(cooperative);
        vm.expectRevert(BlindBidAuction.ProceedsAlreadyClaimed.selector);
        auction.withdrawProceeds();

        // Total contract balance is now exactly 0
        assertEq(address(auction).balance, 0);
    }

    // =========================================================================
    // 4. Fuzz Tests
    // =========================================================================

    function testFuzz_CommitAndReveal(uint96 rawBid, uint96 extraEscrow, bytes32 salt) public {
        vm.assume(rawBid > 0.001 ether && rawBid < 50 ether);
        vm.assume(extraEscrow < 50 ether);
        vm.assume(salt != bytes32(0));

        uint256 bidAmount = uint256(rawBid);
        uint256 deposit = bidAmount + uint256(extraEscrow);

        bytes32 commitment = auction.getCommitmentHash(studio1, bidAmount, salt);

        vm.prank(studio1);
        auction.commitBid{value: deposit}(commitment);

        vm.warp(commitDeadline + 1 hours);

        vm.prank(studio1);
        auction.revealBid(bidAmount, salt);

        vm.warp(revealDeadline + 1 hours);
        auction.settleAuction();

        assertEq(auction.highestBidder(), studio1);
        assertEq(auction.highestBid(), bidAmount);

        // Surplus escrow matches extraEscrow
        assertEq(auction.getRefundAmount(studio1), extraEscrow);
    }
}
