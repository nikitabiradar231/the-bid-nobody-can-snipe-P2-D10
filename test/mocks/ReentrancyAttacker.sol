// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {BlindBidAuction} from "../../src/BlindBidAuction.sol";

/**
 * @title ReentrancyAttacker
 * @notice Malicious contract attempting re-entrancy during refund withdrawal.
 */
contract ReentrancyAttacker {
    BlindBidAuction public immutable auction;
    uint256 public attackAttempts;
    bool public attackSuccess;

    constructor(BlindBidAuction _auction) {
        auction = _auction;
    }

    function commitBid(bytes32 commitment) external payable {
        auction.commitBid{value: msg.value}(commitment);
    }

    function revealBid(uint256 bidAmount, bytes32 salt) external {
        auction.revealBid(bidAmount, salt);
    }

    function initiateWithdrawRefund() external {
        auction.withdrawRefund();
    }

    receive() external payable {
        attackAttempts++;
        if (attackAttempts <= 3) {
            // Attempt to re-enter
            try auction.withdrawRefund() {
                attackSuccess = true;
            } catch {
                // Re-entrancy reverted as expected
                attackSuccess = false;
            }
        }
    }
}
