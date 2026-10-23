// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {BlindBidAuction} from "../src/BlindBidAuction.sol";

contract DeployBlindBidAuction is Script {
    function run() external returns (BlindBidAuction auction) {
        uint256 deployerPrivateKey;
        address cooperativeAddr;

        // Try reading PRIVATE_KEY from environment, fallback to Anvil default account #0
        try vm.envUint("PRIVATE_KEY") returns (uint256 key) {
            deployerPrivateKey = key;
        } catch {
            // Anvil account #0 standard private key for local development
            deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }

        // Try reading COOPERATIVE_ADDRESS from environment, fallback to Anvil account #9
        try vm.envAddress("COOPERATIVE_ADDRESS") returns (address coop) {
            cooperativeAddr = coop;
        } catch {
            // Anvil account #9 standard address
            cooperativeAddr = 0xa0Ee7A142d267C1f36714E4a8F75612F20a79720;
        }

        uint256 auctionId = vm.envOr("AUCTION_ID", uint256(1));
        uint256 commitDuration = vm.envOr("COMMIT_DURATION", uint256(1 days));
        uint256 revealDuration = vm.envOr("REVEAL_DURATION", uint256(1 days));

        uint256 commitDeadline = block.timestamp + commitDuration;
        uint256 revealDeadline = commitDeadline + revealDuration;

        console2.log("--- Deploying BlindBidAuction ---");
        console2.log("Auction ID:        ", auctionId);
        console2.log("Cooperative:       ", cooperativeAddr);
        console2.log("Commit Deadline:   ", commitDeadline);
        console2.log("Reveal Deadline:   ", revealDeadline);

        vm.startBroadcast(deployerPrivateKey);

        auction = new BlindBidAuction(auctionId, payable(cooperativeAddr), commitDeadline, revealDeadline);

        vm.stopBroadcast();

        console2.log("BlindBidAuction deployed at:", address(auction));
    }
}
