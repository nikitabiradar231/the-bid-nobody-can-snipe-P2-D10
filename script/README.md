# Deployment Scripts & Operational Guide

This directory contains Forge deployment scripts for the `BlindBidAuction` contract.

## Deployment Script: `DeployBlindBidAuction.s.sol`

The script handles deploying the `BlindBidAuction` contract to either a local Anvil node, testnet (e.g. Sepolia), or mainnet.

### Configurable Environment Variables

| Variable | Description | Default (Local Development) |
|---|---|---|
| `PRIVATE_KEY` | Private key of the deployer | Anvil Account #0 (`0xac09...ff80`) |
| `COOPERATIVE_ADDRESS` | Address receiving winning bids and forfeited deposits | Anvil Account #9 (`0xa0Ee...9720`) |
| `AUCTION_ID` | Monotonically increasing auction index | `1` |
| `COMMIT_DURATION` | Commit phase duration in seconds | `86400` (1 day) |
| `REVEAL_DURATION` | Reveal phase duration in seconds | `86400` (1 day) |

### Deploying to Local Anvil

1. Start an Anvil node in a separate terminal:
   ```bash
   anvil
   ```

2. Run the deployment script:
   ```bash
   forge script script/DeployBlindBidAuction.s.sol:DeployBlindBidAuction \
     --rpc-url http://127.0.0.1:8545 \
     --broadcast
   ```

3. Note the deployed contract address printed in the console and update your frontend `.env`.

### Deploying to a Live Network (e.g. Sepolia)

```bash
forge script script/DeployBlindBidAuction.s.sol:DeployBlindBidAuction \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```
