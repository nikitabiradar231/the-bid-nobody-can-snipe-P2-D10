import React from 'react';
import { formatEther, type Address } from 'viem';
import { ArrowDownToLine, CheckCircle2, Shield, Landmark, AlertCircle } from 'lucide-react';
import { type AuctionDetails, type BidInfo } from '../types';

interface WithdrawSectionProps {
  currentAccount: Address;
  auctionDetails: AuctionDetails | null;
  existingBid: BidInfo | null;
  refundableAmount: bigint;
  onWithdrawRefund: () => Promise<void>;
  onWithdrawProceeds: () => Promise<void>;
  isLoading: boolean;
}

export const WithdrawSection: React.FC<WithdrawSectionProps> = ({
  currentAccount,
  auctionDetails,
  existingBid,
  refundableAmount,
  onWithdrawRefund,
  onWithdrawProceeds,
  isLoading,
}) => {
  if (!auctionDetails) return null;

  const isCooperative = currentAccount.toLowerCase() === auctionDetails.cooperative.toLowerCase();
  const isSettled = auctionDetails.settled;
  const isRefundClaimed = existingBid?.isRefundClaimed ?? false;
  const isWinner = isSettled && auctionDetails.highestBidder.toLowerCase() === currentAccount.toLowerCase();

  const handleRefundClick = async () => {
    try {
      await onWithdrawRefund();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Refund withdrawal failed');
    }
  };

  const handleProceedsClick = async () => {
    try {
      await onWithdrawProceeds();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Proceeds withdrawal failed');
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ArrowDownToLine size={20} color="var(--emerald-glow)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Pull-Payment Withdrawals</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Step 4: Claim Losing Escrow Refunds, Winner Surplus, or Cooperative Proceeds
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Shield size={14} color="var(--emerald-glow)" /> Reentrancy Protected
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {/* Studio Refund Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Your Available Refund / Surplus Escrow
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: refundableAmount > 0n ? 'var(--emerald-glow)' : 'var(--text-muted)' }}>
              {formatEther(refundableAmount)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ETH</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              {isWinner
                ? 'Winning studio: surplus unused escrow (deposit minus winning bid).'
                : 'Losing revealed studio: full deposited escrow refund.'}
            </p>
          </div>

          <div style={{ marginTop: '20px' }}>
            {isRefundClaimed ? (
              <div style={{
                color: 'var(--emerald-glow)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={16} /> Refund Already Claimed
              </div>
            ) : (
              <button
                onClick={handleRefundClick}
                disabled={!isSettled || refundableAmount === 0n || isLoading}
                className="btn-emerald"
                style={{ width: '100%' }}
              >
                <ArrowDownToLine size={16} />
                {isLoading ? 'Processing Withdrawal...' : 'Withdraw Refund (Pull)'}
              </button>
            )}

            {!isSettled && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                Refunds unlock after auction is settled
              </div>
            )}
          </div>
        </div>

        {/* Cooperative Proceeds Card */}
        <div style={{
          background: isCooperative ? 'rgba(168, 85, 247, 0.06)' : 'rgba(255, 255, 255, 0.01)',
          border: `1px solid ${isCooperative ? 'rgba(168, 85, 247, 0.3)' : 'var(--border-subtle)'}`,
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cooperative Treasury Proceeds</span>
              <Landmark size={16} color="var(--purple-glow)" />
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--purple-glow)' }}>
              {formatEther(auctionDetails.cooperativeProceeds)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ETH</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Winning bid + forfeited unrevealed escrow. Dedicated pull payment claimable only by cooperative treasury address.
            </p>
          </div>

          <div style={{ marginTop: '20px' }}>
            {auctionDetails.proceedsClaimed ? (
              <div style={{
                color: 'var(--purple-glow)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <CheckCircle2 size={16} /> Proceeds Already Withdrawn
              </div>
            ) : isCooperative ? (
              <button
                onClick={handleProceedsClick}
                disabled={!isSettled || auctionDetails.cooperativeProceeds === 0n || isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
                  borderColor: 'rgba(168, 85, 247, 0.5)'
                }}
              >
                <Landmark size={16} />
                {isLoading ? 'Claiming Proceeds...' : 'Withdraw Cooperative Proceeds'}
              </button>
            ) : (
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '10px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={14} />
                Only Cooperative Treasury can claim these funds. Switch account to {auctionDetails.cooperative.slice(0, 6)}...{auctionDetails.cooperative.slice(-4)} to withdraw.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
