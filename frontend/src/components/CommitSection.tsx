import React, { useState, useEffect } from 'react';
import { parseEther, type Address } from 'viem';
import { Lock, RefreshCw, Download, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { generateSecureSalt, computeCommitmentHash, saveBidRecordToLocal, downloadBidBackup, type SavedBidRecord } from '../utils/crypto';
import { AuctionPhase, type AuctionDetails, type BidInfo } from '../types';

interface CommitSectionProps {
  currentAccount: Address;
  auctionDetails: AuctionDetails | null;
  existingBid: BidInfo | null;
  onCommit: (commitment: `0x${string}`, depositWei: bigint) => Promise<void>;
  isLoading: boolean;
  contractAddress: Address;
  chainId: number;
}

export const CommitSection: React.FC<CommitSectionProps> = ({
  currentAccount,
  auctionDetails,
  existingBid,
  onCommit,
  isLoading,
  contractAddress,
  chainId,
}) => {
  const [depositEth, setDepositEth] = useState<string>('5.0');
  const [bidAmountEth, setBidAmountEth] = useState<string>('3.5');
  const [salt, setSalt] = useState<`0x${string}`>('0x');
  const [computedHash, setComputedHash] = useState<`0x${string}`>('0x');
  const [lastCommittedRecord, setLastCommittedRecord] = useState<SavedBidRecord | null>(null);

  // Initialize secure salt on load
  useEffect(() => {
    handleGenerateSalt();
  }, []);

  const handleGenerateSalt = () => {
    const newSalt = generateSecureSalt();
    setSalt(newSalt);
  };

  // Recompute commitment hash on any parameter change
  useEffect(() => {
    if (!auctionDetails || !salt || salt === '0x' || !currentAccount) return;
    try {
      const bidWei = parseEther(bidAmountEth || '0');
      const hash = computeCommitmentHash(
        chainId,
        contractAddress,
        auctionDetails.auctionId,
        currentAccount,
        bidWei,
        salt
      );
      setComputedHash(hash);
    } catch {
      setComputedHash('0x');
    }
  }, [chainId, contractAddress, auctionDetails, currentAccount, bidAmountEth, salt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionDetails || computedHash === '0x') return;

    try {
      const depositWei = parseEther(depositEth);
      const bidWei = parseEther(bidAmountEth);

      if (bidWei <= 0n) {
        alert('Bid amount must be strictly positive');
        return;
      }
      if (bidWei > depositWei) {
        alert('Bid amount cannot exceed deposited escrow');
        return;
      }

      await onCommit(computedHash, depositWei);

      // Save record locally and prepare backup download
      const record: SavedBidRecord = {
        auctionId: auctionDetails.auctionId.toString(),
        contractAddress,
        bidder: currentAccount,
        bidAmountEth,
        depositEth,
        salt,
        commitment: computedHash,
        timestamp: Date.now(),
      };
      saveBidRecordToLocal(record);
      setLastCommittedRecord(record);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Commitment transaction failed');
    }
  };

  const isCommitPhase = auctionDetails?.phase === AuctionPhase.Commit;
  const hasAlreadyCommitted = existingBid && existingBid.commitment !== '0x0000000000000000000000000000000000000000000000000000000000000000';

  return (
    <div className="glass-panel" style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Lock size={20} color="var(--cyan-glow)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Commit Sealed Bid</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Step 1: Deposit ETH Escrow & Submit Blind Commitment
            </p>
          </div>
        </div>

        {hasAlreadyCommitted && (
          <span className="badge badge-settled" style={{ fontSize: '0.75rem' }}>
            <CheckCircle2 size={14} /> Bid Committed
          </span>
        )}
      </div>

      {hasAlreadyCommitted ? (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{ color: 'var(--emerald-glow)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <ShieldCheck size={18} /> Bid Successfully Committed
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Your sealed commitment is recorded on-chain. Exactly one commitment is allowed per studio address.
          </p>
          <div style={{ marginTop: '14px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div><strong>Commitment Hash:</strong> <span className="mono" style={{ wordBreak: 'break-all' }}>{existingBid.commitment}</span></div>
            <div><strong>Escrow Deposited:</strong> {Number(existingBid.deposit) / 1e18} ETH</div>
            <div><strong>Sequence Number:</strong> #{existingBid.sequence.toString()}</div>
          </div>
          {lastCommittedRecord && (
            <button
              onClick={() => downloadBidBackup(lastCommittedRecord)}
              className="btn-secondary"
              style={{ marginTop: '16px', fontSize: '0.85rem' }}
            >
              <Download size={16} /> Download Bid Backup JSON
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isCommitPhase && (
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
              Commit phase is inactive. Bids can only be committed during the Commit Phase.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Escrow Deposit (ETH)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={depositEth}
                onChange={(e) => setDepositEth(e.target.value)}
                placeholder="5.0"
                disabled={!isCommitPhase || isLoading}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Funds locked in contract escrow
              </span>
            </div>

            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Secret Intended Bid (ETH)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={bidAmountEth}
                onChange={(e) => setBidAmountEth(e.target.value)}
                placeholder="3.5"
                disabled={!isCommitPhase || isLoading}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Must be ≤ Escrow Deposit
              </span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Cryptographic Secret Salt (256-bit bytes32)
              </label>
              <button
                type="button"
                onClick={handleGenerateSalt}
                disabled={!isCommitPhase || isLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--cyan-glow)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={12} /> Regenerate Secure Salt
              </button>
            </div>
            <input
              type="text"
              readOnly
              value={salt}
              className="mono"
              style={{ fontSize: '0.8rem', background: 'rgba(0, 0, 0, 0.4)' }}
            />
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px dashed var(--border-subtle)',
            borderRadius: '10px',
            padding: '12px 14px'
          }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Computed Commitment Hash (On-Chain Payload):
            </div>
            <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--cyan-glow)', wordBreak: 'break-all' }}>
              {computedHash}
            </div>
          </div>

          {/* Warning Banner */}
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            fontSize: '0.8rem',
            color: 'var(--amber-glow)'
          }}>
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Critical Security Notice:</strong> If you lose your salt or bid amount, you will NOT be able to reveal your bid, and your deposited escrow will be forfeited to the cooperative upon settlement! Always download a JSON backup.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="submit"
              disabled={!isCommitPhase || isLoading || computedHash === '0x'}
              className="btn-primary"
              style={{ flex: 1 }}
            >
              <Lock size={16} />
              {isLoading ? 'Submitting Commitment...' : 'Submit Sealed Commitment'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
