export const AuctionPhase = {
  Commit: 0,
  Reveal: 1,
  AwaitingSettlement: 2,
  Settled: 3,
} as const;

export type AuctionPhase = typeof AuctionPhase[keyof typeof AuctionPhase];

export interface AuctionDetails {
  auctionId: bigint;
  cooperative: `0x${string}`;
  commitDeadline: bigint;
  revealDeadline: bigint;
  phase: AuctionPhase;
  settled: boolean;
  highestBidder: `0x${string}`;
  highestBid: bigint;
  highestBidSequence: bigint;
  cooperativeProceeds: bigint;
  proceedsClaimed: boolean;
  totalDepositedEscrow: bigint;
  totalRevealedDeposits: bigint;
  commitmentCount: bigint;
}

export interface BidInfo {
  commitment: `0x${string}`;
  deposit: bigint;
  sequence: bigint;
  revealedAmount: bigint;
  revealed: boolean;
  isRefundClaimed: boolean;
}
