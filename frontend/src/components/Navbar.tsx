import React from 'react';
import { Shield, Wallet, BookOpen } from 'lucide-react';

export const DEMO_ACCOUNTS = [
  { name: 'Studio Alpha (Bidder 1)', address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const },
  { name: 'Studio Beta (Bidder 2)', address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as const },
  { name: 'Studio Gamma (Bidder 3)', address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const },
  { name: 'Studio Delta (Bidder 4)', address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65' as const },
  { name: 'Studio Epsilon (Bidder 5)', address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc' as const },
  { name: 'Quiet Room Cooperative', address: '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720' as const },
];

interface NavbarProps {
  currentAccount: `0x${string}`;
  onSelectAccount: (addr: `0x${string}`) => void;
  onOpenDocs: () => void;
  networkName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentAccount,
  onSelectAccount,
  onOpenDocs,
  networkName,
}) => {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 28px',
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(56, 189, 248, 0.35)'
        }}>
          <Shield size={24} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              The Quiet Room
            </h1>
            <span style={{
              background: 'rgba(56, 189, 248, 0.12)',
              color: '#38bdf8',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '6px',
              border: '1px solid rgba(56, 189, 248, 0.25)'
            }}>
              SEALED AUCTION
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Anti-Snipe Commit-Reveal Feature Slot
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          onClick={onOpenDocs}
          className="btn-secondary"
          style={{ fontSize: '0.85rem', padding: '6px 12px' }}
        >
          <BookOpen size={16} />
          Threat Model & Privacy
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(15, 20, 34, 0.8)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '10px'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px #10b981'
          }} />
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {networkName}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wallet size={18} color="var(--cyan-glow)" />
          <select
            value={currentAccount}
            onChange={(e) => onSelectAccount(e.target.value as `0x${string}`)}
            style={{
              padding: '6px 12px',
              fontSize: '0.85rem',
              background: 'rgba(22, 28, 48, 0.9)',
              cursor: 'pointer',
              width: 'auto'
            }}
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.address} value={acc.address}>
                {acc.name} ({acc.address.slice(0, 6)}...{acc.address.slice(-4)})
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
};
