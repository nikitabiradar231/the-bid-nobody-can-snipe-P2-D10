import React from 'react';
import { formatEther } from 'viem';
import { Gavel, CheckCircle2, AlertTriangle, Trophy } from 'lucide-react';
import { AuctionPhase, type AuctionDetails } from '../types';

interface SettlementSectionProps {
  auctionDetails: AuctionDetails | null;
  onSettle: () => Promise<void>;
  isLoading: boolean;
}

export const SettlementSection: React.FC<SettlementSectionProps> = ({
  auctionDetails,
  onSettle,
  isLoading,
}) => {
  if (!auctionDetails) return null;

  const isAwaitingSettlement = auctionDetails.phase === AuctionPhase.AwaitingSettlement;
  const isSettled = auctionDetails.settled;

  const handleSettle = async () => {
    try {
      await onSettle();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Settlement transaction failed');
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
            background: 'rgba(168, 85, 247, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Gavel size={20} color="var(--purple-glow)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Settlement & Finalization</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Step 3: Permissionless O(1) Constant-Time Auction Settlement
            </p>
          </div>
        </div>

        {isSettled && (
          <span className="badge badge-settled" style={{ fontSize: '0.75rem' }}>
            <CheckCircle2 size={14} /> Auction Settled
          </span>
        )}
      </div>

      {isSettled ? (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--emerald-glow)' }}>
            <Trophy size={24} />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Final Results Settled</h4>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginTop: '16px'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Winning Studio</div>
              <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {auctionDetails.highestBidder !== '0x0000000000000000000000000000000000000000'
                  ? `${auctionDetails.highestBidder.slice(0, 10)}...${auctionDetails.highestBidder.slice(-8)}`
                  : 'No valid revealed bids'}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Winning Bid Amount</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--amber-glow)', marginTop: '2px' }}>
                {formatEther(auctionDetails.highestBid)} ETH
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cooperative Proceeds</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--purple-glow)', marginTop: '2px' }}>
                {formatEther(auctionDetails.cooperativeProceeds)} ETH
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Includes {formatEther(auctionDetails.totalDepositedEscrow - auctionDetails.totalRevealedDeposits)} ETH unrevealed forfeitures
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Once the reveal deadline has passed, anyone can execute the permissionless settlement function.
            Settlement operates in <strong>O(1) constant time</strong> with no bidder loops, so unrevealed or silent bidders cannot block finalization.
          </p>

          {!isAwaitingSettlement && (
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={18} />
              Settlement unlocks after the reveal deadline passes.
            </div>
          )}

          <button
            onClick={handleSettle}
            disabled={!isAwaitingSettlement || isLoading}
            className="btn-primary"
            style={{
              background: isAwaitingSettlement
                ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                : undefined,
              borderColor: isAwaitingSettlement ? 'rgba(168, 85, 247, 0.5)' : undefined
            }}
          >
            <Gavel size={16} />
            {isLoading ? 'Settling Auction...' : 'Execute settleAuction() (Permissionless)'}
          </button>
        </div>
      )}
    </div>
  );
};
