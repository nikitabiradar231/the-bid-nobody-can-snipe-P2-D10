import { encodeAbiParameters, parseAbiParameters, keccak256, type Address } from 'viem';
import { COMMITMENT_DOMAIN } from '../constants/contract';

export interface SavedBidRecord {
  auctionId: string;
  contractAddress: string;
  bidder: string;
  bidAmountEth: string;
  depositEth: string;
  salt: `0x${string}`;
  commitment: `0x${string}`;
  timestamp: number;
}

/**
 * Generates a cryptographically secure 256-bit (bytes32) random salt.
 * Never uses Math.random() for commitment secrets.
 */
export function generateSecureSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')}` as `0x${string}`;
}

/**
 * Recomputes domain-separated commitment hash identical to BlindBidAuction.sol:
 * keccak256(abi.encode(COMMITMENT_DOMAIN, chainId, contractAddress, auctionId, bidder, bidAmount, salt))
 */
export function computeCommitmentHash(
  chainId: number,
  contractAddress: Address,
  auctionId: bigint,
  bidder: Address,
  bidAmountWei: bigint,
  salt: `0x${string}`
): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, uint256, address, uint256, address, uint256, bytes32'),
    [
      COMMITMENT_DOMAIN,
      BigInt(chainId),
      contractAddress,
      auctionId,
      bidder,
      bidAmountWei,
      salt,
    ]
  );
  return keccak256(encoded);
}

const STORAGE_KEY = 'blindbid_saved_records';

export function saveBidRecordToLocal(record: SavedBidRecord): void {
  try {
    const existing = getSavedBidRecords();
    const updated = [record, ...existing.filter((r) => r.commitment !== record.commitment)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save bid to local storage:', err);
  }
}

export function getSavedBidRecords(): SavedBidRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function downloadBidBackup(record: SavedBidRecord): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(record, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `bid_backup_${record.bidder.slice(0, 8)}_${record.auctionId}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
