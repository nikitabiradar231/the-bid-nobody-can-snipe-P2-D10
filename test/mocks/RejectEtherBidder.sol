// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BlindBidAuction} from "../../src/BlindBidAuction.sol";

/**
 * @title RejectEtherBidder
 * @notice Contract that commits and reveals, but rejects incoming ETH to test transfer failure handling.
 */
contract RejectEtherBidder {
    BlindBidAuction public immutable auction;

    constructor(BlindBidAuction _auction) {
        auction = _auction;
    }

    function commitBid(bytes32 commitment) external payable {
        auction.commitBid{value: msg.value}(commitment);
    }

    function revealBid(uint256 bidAmount, bytes32 salt) external {
        auction.revealBid(bidAmount, salt);
    }

    function attemptWithdraw() external {
        auction.withdrawRefund();
    }

    // Rejects any ETH transfers
    receive() external payable {
        revert("Rejecting ETH");
    }
}
