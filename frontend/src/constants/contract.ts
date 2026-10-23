import { parseAbi } from 'viem';

export const COMMITMENT_DOMAIN =
  '0xb86c148f3fb8f787b646bbf20ef8498f3c7e8e52dbb68df465c3bb921ceaa830' as const;
// Keccak256 of "BlindBidAuction_Commitment(uint256 chainId,address contractAddress,uint256 auctionId,address bidder,uint256 bidAmount,bytes32 salt)"

export const AUCTION_ABI = parseAbi([
  'function auctionId() view returns (uint256)',
  'function cooperative() view returns (address)',
  'function commitDeadline() view returns (uint256)',
  'function revealDeadline() view returns (uint256)',
  'function commitmentCounter() view returns (uint256)',
  'function totalDepositedEscrow() view returns (uint256)',
  'function totalRevealedDeposits() view returns (uint256)',
  'function highestBidder() view returns (address)',
  'function highestBid() view returns (uint256)',
  'function highestBidSequence() view returns (uint256)',
  'function settled() view returns (bool)',
  'function cooperativeProceeds() view returns (uint256)',
  'function proceedsClaimed() view returns (bool)',
  'function refundClaimed(address) view returns (bool)',
  'function getPhase() view returns (uint8)',
  'function getCommitmentHash(address bidder, uint256 bidAmount, bytes32 salt) view returns (bytes32)',
  'function getRefundAmount(address bidder) view returns (uint256)',
  'function getBid(address bidder) view returns (bytes32 commitment, uint256 deposit, uint256 sequence, uint256 revealedAmount, bool revealed, bool isRefundClaimed)',
  'function getAuctionDetails() view returns ((uint256 auctionId, address cooperative, uint256 commitDeadline, uint256 revealDeadline, uint8 phase, bool settled, address highestBidder, uint256 highestBid, uint256 highestBidSequence, uint256 cooperativeProceeds, bool proceedsClaimed, uint256 totalDepositedEscrow, uint256 totalRevealedDeposits, uint256 commitmentCount))',
  'function commitBid(bytes32 commitment) payable',
  'function revealBid(uint256 bidAmount, bytes32 salt)',
  'function settleAuction()',
  'function withdrawRefund()',
  'function withdrawProceeds()',
  'event BidCommitted(address indexed bidder, bytes32 indexed commitment, uint256 deposit, uint256 sequence)',
  'event BidRevealed(address indexed bidder, uint256 bidAmount)',
  'event AuctionSettled(address indexed winner, uint256 winningBid, uint256 cooperativeProceeds)',
  'event RefundWithdrawn(address indexed bidder, uint256 amount)',
  'event ProceedsWithdrawn(address indexed recipient, uint256 amount)'
]);

export const DEFAULT_AUCTION_ADDRESS =
  (import.meta.env.VITE_AUCTION_ADDRESS as `0x${string}`) ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';

export const DEFAULT_RPC_URL =
  import.meta.env.VITE_RPC_URL || 'http://127.0.0.1:8545';

export const DEFAULT_CHAIN_ID = 31337;
