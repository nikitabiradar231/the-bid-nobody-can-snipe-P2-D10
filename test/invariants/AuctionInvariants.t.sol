// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {BlindBidAuction} from "../../src/BlindBidAuction.sol";

contract AuctionHandler is Test {
    BlindBidAuction public auction;
    address payable public cooperative;

    address[] public actors;
    mapping(address => bytes32) public actorSalts;
    mapping(address => uint256) public actorBids;
    mapping(address => uint256) public actorDeposits;
    mapping(address => bool) public committed;
    mapping(address => bool) public revealed;

    uint256 public totalRefundsPaid;
    uint256 public proceedsPaid;

    constructor(BlindBidAuction _auction, address payable _cooperative) {
        auction = _auction;
        cooperative = _cooperative;

        for (uint160 i = 100; i < 110; i++) {
            address actor = address(i);
            actors.push(actor);
            vm.deal(actor, 100 ether);
        }
    }

    function commitBid(uint256 actorIndexSeed, uint256 bidSeed, uint256 depositExtra) external {
        if (block.timestamp >= auction.commitDeadline()) return;

        address actor = actors[actorIndexSeed % actors.length];
        if (committed[actor]) return;

        uint256 bid = (bidSeed % 10 ether) + 0.1 ether;
        uint256 deposit = bid + (depositExtra % 5 ether);
        bytes32 salt = keccak256(abi.encodePacked(actor, bidSeed));

        bytes32 commitment = auction.getCommitmentHash(actor, bid, salt);

        actorSalts[actor] = salt;
        actorBids[actor] = bid;
        actorDeposits[actor] = deposit;
        committed[actor] = true;

        vm.prank(actor);
        auction.commitBid{value: deposit}(commitment);
    }

    function revealBid(uint256 actorIndexSeed) external {
        if (block.timestamp < auction.commitDeadline() || block.timestamp >= auction.revealDeadline()) return;

        address actor = actors[actorIndexSeed % actors.length];
        if (!committed[actor] || revealed[actor]) return;

        revealed[actor] = true;

        vm.prank(actor);
        auction.revealBid(actorBids[actor], actorSalts[actor]);
    }

    function settle() external {
        if (block.timestamp < auction.revealDeadline() || auction.settled()) return;
        auction.settleAuction();
    }

    function withdrawRefund(uint256 actorIndexSeed) external {
        if (!auction.settled()) return;

        address actor = actors[actorIndexSeed % actors.length];
        uint256 refund = auction.getRefundAmount(actor);
        if (refund == 0) return;

        totalRefundsPaid += refund;

        vm.prank(actor);
        auction.withdrawRefund();
    }

    function withdrawProceeds() external {
        if (!auction.settled() || auction.proceedsClaimed()) return;
        uint256 proceeds = auction.cooperativeProceeds();
        if (proceeds == 0) return;

        proceedsPaid += proceeds;

        vm.prank(cooperative);
        auction.withdrawProceeds();
    }
}

contract AuctionInvariantTest is Test {
    BlindBidAuction public auction;
    AuctionHandler public handler;
    address payable public cooperative;

    function setUp() public {
        cooperative = payable(makeAddr("coop_invariants"));
        uint256 commitDeadline = block.timestamp + 1 days;
        uint256 revealDeadline = commitDeadline + 1 days;

        auction = new BlindBidAuction(999, cooperative, commitDeadline, revealDeadline);

        handler = new AuctionHandler(auction, cooperative);

        targetContract(address(handler));
    }

    /// @notice Invariant: Contract ETH balance must always equal total deposits minus all paid withdrawals
    function invariant_SolvencyConservationOfETH() public view {
        uint256 expectedBalance = auction.totalDepositedEscrow() - (handler.totalRefundsPaid() + handler.proceedsPaid());
        assertEq(address(auction).balance, expectedBalance, "Solvency violation: balance mismatch");
    }

    /// @notice Invariant: Settled result is immutable
    function invariant_SettledImmutability() public view {
        if (auction.settled()) {
            assertTrue(uint256(auction.getPhase()) == uint256(BlindBidAuction.Phase.Settled));
        }
    }
}
