import React, { useState, useEffect } from 'react';
import { parseEther, formatEther, type Address } from 'viem';
import { Unlock, Check, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { computeCommitmentHash, getSavedBidRecords, type SavedBidRecord } from '../utils/crypto';
import { AuctionPhase, type AuctionDetails, type BidInfo } from '../types';

interface RevealSectionProps {
  currentAccount: Address;
  auctionDetails: AuctionDetails | null;
  existingBid: BidInfo | null;
  onReveal: (bidAmountWei: bigint, salt: `0x${string}`) => Promise<void>;
  isLoading: boolean;
  contractAddress: Address;
  chainId: number;
}

export const RevealSection: React.FC<RevealSectionProps> = ({
  currentAccount,
  auctionDetails,
  existingBid,
  onReveal,
  isLoading,
  contractAddress,
  chainId,
}) => {
  const [bidAmountEth, setBidAmountEth] = useState<string>('');
  const [salt, setSalt] = useState<string>('');
  const [savedRecords, setSavedRecords] = useState<SavedBidRecord[]>([]);
  const [computedHash, setComputedHash] = useState<`0x${string}`>('0x');
  const [hashMatches, setHashMatches] = useState<boolean>(false);

  // Load saved local records for current account
  useEffect(() => {
    const records = getSavedBidRecords().filter(
      (r) => r.bidder.toLowerCase() === currentAccount.toLowerCase()
    );
    setSavedRecords(records);

    if (records.length > 0 && !bidAmountEth && !salt) {
      setBidAmountEth(records[0].bidAmountEth);
      setSalt(records[0].salt);
    }
  }, [currentAccount]);

  // Recompute commitment hash and verify against on-chain stored commitment
  useEffect(() => {
    if (!auctionDetails || !salt || !bidAmountEth || !currentAccount) {
      setComputedHash('0x');
      setHashMatches(false);
      return;
    }

    try {
      const bidWei = parseEther(bidAmountEth);
      const hash = computeCommitmentHash(
        chainId,
        contractAddress,
        auctionDetails.auctionId,
        currentAccount,
        bidWei,
        salt as `0x${string}`
      );
      setComputedHash(hash);

      if (existingBid && existingBid.commitment.toLowerCase() === hash.toLowerCase()) {
        setHashMatches(true);
      } else {
        setHashMatches(false);
      }
    } catch {
      setComputedHash('0x');
      setHashMatches(false);
    }
  }, [chainId, contractAddress, auctionDetails, currentAccount, bidAmountEth, salt, existingBid]);

  const handleSelectRecord = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = savedRecords.find((r) => r.commitment === e.target.value);
    if (selected) {
      setBidAmountEth(selected.bidAmountEth);
      setSalt(selected.salt);
    }
  };

  const handleRevealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hashMatches || !existingBid) return;

    try {
      const bidWei = parseEther(bidAmountEth);
      await onReveal(bidWei, salt as `0x${string}`);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Reveal transaction failed');
    }
  };

  const isRevealPhase = auctionDetails?.phase === AuctionPhase.Reveal;
  const isAlreadyRevealed = existingBid?.revealed ?? false;
  const hasCommitment = existingBid && existingBid.commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  return (
    <div className="glass-panel" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Unlock size={20} color="var(--amber-glow)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Reveal Sealed Bid</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Step 2: Disclose Plaintext Bid & Salt to Validate Commitment
            </p>
          </div>
        </div>

        {isAlreadyRevealed && (
          <span className="badge badge-settled" style={{ fontSize: '0.75rem' }}>
            <CheckCircle2 size={14} /> Bid Revealed
          </span>
        )}
      </div>

      {!hasCommitment ? (
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)'
        }}>
          No committed bid found for {currentAccount.slice(0, 6)}...{currentAccount.slice(-4)}.
          You must commit a bid with escrow deposit during the Commit Phase before revealing.
        </div>
      ) : isAlreadyRevealed ? (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{ color: 'var(--emerald-glow)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <CheckCircle2 size={18} /> Bid Successfully Revealed On-Chain
          </h4>
          <div style={{ marginTop: '12px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><strong>Revealed Bid Amount:</strong> {formatEther(existingBid.revealedAmount)} ETH</div>
            <div><strong>Escrow Deposited:</strong> {formatEther(existingBid.deposit)} ETH</div>
            <div><strong>Status:</strong> Counted for winner determination. A second reveal is permanently disallowed.</div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleRevealSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isRevealPhase && (
            <div style={{
              background: 'rgba(244, 63, 94, 0.1)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              fontSize: '0.85rem',
              color: '#fb7185',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <AlertTriangle size={18} />
              Reveal phase is inactive. Bids can only be opened when the contract enters the Reveal Phase.
            </div>
          )}

          {savedRecords.length > 0 && (
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Load From Saved Bid Records:
              </label>
              <select onChange={handleSelectRecord} style={{ fontSize: '0.85rem' }}>
                {savedRecords.map((r, i) => (
                  <option key={r.commitment} value={r.commitment}>
                    Record #{i + 1} - {r.bidAmountEth} ETH (Hash: {r.commitment.slice(0, 10)}...)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Plaintext Bid Amount (ETH)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={bidAmountEth}
                onChange={(e) => setBidAmountEth(e.target.value)}
                placeholder="3.5"
                disabled={!isRevealPhase || isLoading}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Secret Salt (bytes32 hex)
              </label>
              <input
                type="text"
                required
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                placeholder="0x..."
                className="mono"
                disabled={!isRevealPhase || isLoading}
              />
            </div>
          </div>

          {/* Validation Status Card */}
          <div style={{
            background: hashMatches ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.08)',
            border: `1px solid ${hashMatches ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {hashMatches ? (
                <>
                  <Check size={18} color="var(--emerald-glow)" />
                  <span style={{ color: 'var(--emerald-glow)', fontWeight: 600 }}>
                    Commitment Verified: Matches on-chain commitment hash!
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={18} color="var(--rose-glow)" />
                  <span style={{ color: 'var(--rose-glow)' }}>
                    Recomputed hash does NOT match on-chain commitment. Reveal will revert.
                  </span>
                </>
              )}
            </div>

            <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Computed: {computedHash.slice(0, 8)}... | On-chain: {existingBid.commitment.slice(0, 8)}...
            </div>
          </div>

          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)'
          }}>
            ℹ️ <strong>Privacy Notice:</strong> Submitting this transaction broadcasts your plaintext bid amount to the blockchain and mempool. The amount becomes permanently public.
          </div>

          <button
            type="submit"
            disabled={!isRevealPhase || isLoading || !hashMatches}
            className="btn-emerald"
          >
            <Unlock size={16} />
            {isLoading ? 'Opening Sealed Bid...' : 'Reveal Bid On-Chain'}
          </button>
        </form>
      )}
    </div>
  );
};
