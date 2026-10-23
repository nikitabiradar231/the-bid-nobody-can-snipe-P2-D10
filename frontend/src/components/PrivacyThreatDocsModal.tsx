import React from 'react';
import { X, ShieldCheck, AlertTriangle, Cpu, Lock } from 'lucide-react';

interface PrivacyThreatDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyThreatDocsModal: React.FC<PrivacyThreatDocsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        maxWidth: '850px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px',
        position: 'relative',
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(56, 189, 248, 0.3)'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={24} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldCheck size={22} color="var(--cyan-glow)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Threat Model & Privacy Analysis</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Cryptographic guarantees, economic boundaries, and FHE extension overview
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontSize: '0.9rem', lineHeight: '1.6' }}>
          {/* Section 1 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--cyan-glow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={16} /> 1. What Commit-Reveal Hides
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              Before the reveal phase, observers only see the 256-bit commitment hash and transaction metadata. The exact intended bid amount and secret salt cannot be deduced under the preimage resistance of Keccak256, provided the salt has sufficient cryptographic entropy (≥128 bits).
            </p>
          </div>

          {/* Section 2 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--amber-glow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} /> 2. What Commit-Reveal DOES NOT Hide
            </h3>
            <ul style={{ color: 'var(--text-secondary)', marginTop: '8px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Public Escrow:</strong> The exact ETH deposited at commit time is visible to all on-chain observers. This leaks the studio's maximum potential bid upper-bound.</li>
              <li><strong>Public Plaintext on Reveal:</strong> Once revealed, the bid amount becomes permanently public in transaction calldata and events.</li>
              <li><strong>Identity & Timing:</strong> Studio wallet addresses, gas fees, and commitment sequence timestamps are fully public.</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--emerald-glow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} /> 3. Economic Rules for Unrevealed Bids
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              If a bidder commits but refuses or fails to reveal, their deposited escrow is permanently forfeited to the cooperative treasury upon settlement. This eliminates free-option front-running and guarantees cooperative funding. Settlement operates in <strong>O(1)</strong> constant time, ensuring no unrevealed bidder can block auction resolution.
            </p>
          </div>

          {/* Section 4: FHE Extension */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--purple-glow)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={16} /> 4. Zama FHEVM Extension Comparison
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
              In an advanced Fully Homomorphic Encryption (FHEVM) implementation, bids would remain ciphertext (<code>euint64</code>) throughout the entire auction. Computation of the highest bid is executed directly over encrypted data without any reveal phase. The losing bids remain confidential forever, revealing only the winning slot holder upon threshold decryption.
            </p>
          </div>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button onClick={onClose} className="btn-secondary">
            Close Documentation
          </button>
        </div>
      </div>
    </div>
  );
};
