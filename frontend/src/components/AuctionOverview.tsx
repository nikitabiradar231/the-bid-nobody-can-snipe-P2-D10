import React from 'react';
import { formatEther } from 'viem';
import { Clock, Trophy, Vault, Users, Info } from 'lucide-react';
import { AuctionPhase, type AuctionDetails } from '../types';

interface AuctionOverviewProps {
  details: AuctionDetails | null;
  currentTime: number;
}

export const AuctionOverview: React.FC<AuctionOverviewProps> = ({ details, currentTime }) => {
  if (!details) {
    return (
      <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading on-chain auction details...</p>
      </div>
    );
  }

  const getPhaseBadge = (phase: AuctionPhase) => {
    switch (phase) {
      case AuctionPhase.Commit:
        return <span className="badge badge-commit"><span className="animate-pulse-glow">●</span> Commit Phase</span>;
      case AuctionPhase.Reveal:
        return <span className="badge badge-reveal"><span className="animate-pulse-glow">●</span> Reveal Phase</span>;
      case AuctionPhase.AwaitingSettlement:
        return <span className="badge badge-settling"><span className="animate-pulse-glow">●</span> Awaiting Settlement</span>;
      case AuctionPhase.Settled:
        return <span className="badge badge-settled">✓ Settled</span>;
    }
  };

  const formatTimestamp = (ts: bigint) => {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString();
  };

  const getCountdown = (deadline: bigint) => {
    const diff = Number(deadline) - currentTime;
    if (diff <= 0) return 'Deadline reached';
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;
    return `${hours}h ${minutes}m ${seconds}s remaining`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Card */}
      <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>
                Homepage Feature Slot Auction #{details.auctionId.toString()}
              </h2>
              {getPhaseBadge(details.phase)}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
              Cooperative: <span className="mono" style={{ color: 'var(--text-muted)' }}>{details.cooperative}</span>
            </p>
          </div>

          <div style={{
            display: 'flex',
            gap: '16px',
            background: 'rgba(0, 0, 0, 0.3)',
            padding: '10px 16px',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Commit Deadline
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
                {formatTimestamp(details.commitDeadline)}
              </div>
              {details.phase === AuctionPhase.Commit && (
                <div style={{ fontSize: '0.75rem', color: 'var(--cyan-glow)' }}>
                  {getCountdown(details.commitDeadline)}
                </div>
              )}
            </div>

            <div style={{ width: '1px', background: 'var(--border-subtle)' }} />

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} /> Reveal Deadline
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
                {formatTimestamp(details.revealDeadline)}
              </div>
              {details.phase === AuctionPhase.Reveal && (
                <div style={{ fontSize: '0.75rem', color: 'var(--amber-glow)' }}>
                  {getCountdown(details.revealDeadline)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px'
        }}>
          {/* Card 1: Total Escrow */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Escrow Deposited</span>
              <Vault size={16} color="var(--cyan-glow)" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: 'var(--text-primary)' }}>
              {formatEther(details.totalDepositedEscrow)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ETH</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {details.commitmentCount.toString()} studios committed
            </div>
          </div>

          {/* Card 2: Highest Revealed Bid / Winner */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {details.settled ? 'Winning Bid' : 'Highest Revealed Bid'}
              </span>
              <Trophy size={16} color="var(--amber-glow)" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: details.highestBid > 0n ? 'var(--amber-glow)' : 'var(--text-muted)' }}>
              {details.highestBid > 0n ? `${formatEther(details.highestBid)} ETH` : 'None revealed'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {details.highestBidder !== '0x0000000000000000000000000000000000000000'
                ? `Leading: ${details.highestBidder.slice(0, 6)}...${details.highestBidder.slice(-4)} (Seq #${details.highestBidSequence.toString()})`
                : 'Sealed bids active'}
            </div>
          </div>

          {/* Card 3: Revealed Deposits */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Revealed Escrow</span>
              <Users size={16} color="var(--emerald-glow)" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: 'var(--emerald-glow)' }}>
              {formatEther(details.totalRevealedDeposits)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ETH</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Unrevealed: {formatEther(details.totalDepositedEscrow - details.totalRevealedDeposits)} ETH (forfeitable)
            </div>
          </div>

          {/* Card 4: Cooperative Proceeds */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cooperative Proceeds</span>
              <Vault size={16} color="var(--purple-glow)" />
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '8px', color: 'var(--purple-glow)' }}>
              {formatEther(details.cooperativeProceeds)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ETH</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {details.proceedsClaimed ? '✓ Withdrawn by cooperative' : details.settled ? 'Ready for pull withdrawal' : 'Accrues at settlement'}
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Transparency Notice Banner */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '14px'
      }}>
        <Info size={22} color="var(--cyan-glow)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Cryptographic Privacy Transparency:</strong>
          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>
            A commitment hash hides your bid value only while your secret salt remains private.
            <strong> It is not on-chain encryption.</strong> When the reveal phase arrives, opening your bid makes the plaintext amount public.
            Your escrow deposit amount and wallet address are permanently public from the moment you commit.
          </span>
        </div>
      </div>
    </div>
  );
};
