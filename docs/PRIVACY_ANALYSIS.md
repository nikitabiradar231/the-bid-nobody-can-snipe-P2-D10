# Privacy Analysis: Commit-Reveal vs Fully Homomorphic Encryption (FHE)

## 1. Introduction

A common misconception in Web3 architecture is that cryptographic hashes provide "encryption" or permanent privacy. They do not. 

This document provides a rigorous privacy analysis of the commit-reveal mechanism implemented in **The Quiet Room Sealed Auction** (`BlindBidAuction.sol`), clearly delineating what information is protected, what information leaks to on-chain observers, and how a future **Zama FHEVM** extension could offer true confidential computation.

---

## 2. What Commit-Reveal Protects

Under the standard random oracle assumption for Keccak-256:

1. **Intended Bid Value (During Commit Phase)**:
   Because the commitment hash is computed as:
   $$\text{commitment} = \text{keccak256}(\text{abi.encode}(\text{DOMAIN}, \text{chainId}, \text{contractAddress}, \text{auctionId}, \text{bidder}, \text{bidAmount}, \text{salt}))$$
   the plaintext `bidAmount` cannot be inverted or computed from `commitment` alone, assuming the secret `salt` contains at least 128 bits of cryptographic entropy.

2. **Bidder's Opening Secret (`salt`)**:
   The salt is generated client-side using CSPRNG (`window.crypto.getRandomValues`) and is never transmitted across the network or stored on-chain until the reveal phase.

3. **Protection Against Pre-Deadline Sniping**:
   Competitors cannot observe current bids to submit bids that are 0.01 ETH higher just before the commit deadline.

---

## 3. What Commit-Reveal Does NOT Protect (Privacy Leakages)

Commit-reveal auctions have inherent privacy limitations that participants must understand:

### 3.1 Public Escrow Deposit Leakage (Upper Bound Disclosure)
* **The Leak**: To prevent phantom bidding, the contract requires depositing ETH escrow at commit time: `commitBid(bytes32 commitment) payable`.
* **The Consequence**: The exact amount of ETH transferred (`msg.value`) is permanently recorded in the transaction and visible on all block explorers.
* **Economic Inference**: Any observer knows that a studio's bid cannot exceed its deposited escrow ($\text{bidAmount} \le \text{deposit}$). For example, if Studio Alpha deposits 3.0 ETH and Studio Beta deposits 10.0 ETH, Studio Alpha knows with 100% certainty that Studio Beta's bid cannot exceed 10.0 ETH.
* **Mitigation / Best Practice**: Studios can deliberately over-deposit escrow (e.g., depositing 10 ETH while intending to bid 4 ETH) to obscure their actual bid ceiling. The contract automatically refunds unused surplus escrow upon settlement.

### 3.2 Permanent Plaintext Disclosure upon Reveal
* **The Leak**: In the reveal phase, each participant submits `revealBid(bidAmount, salt)`.
* **The Consequence**: The plaintext bid amount is broadcast through the public mempool and permanently written to blockchain state and event logs (`BidRevealed(bidder, bidAmount)`).
* **Limitation**: Commit-reveal provides *temporary* confidentiality (until reveal), not *permanent* confidentiality.

### 3.3 Wallet Identity and Transaction Graph
* **The Leak**: Ethereum accounts are pseudonymous. Transaction graphs can correlate a studio's address with known exchange accounts, GitHub identities, or cooperative membership.
* **The Consequence**: Observers know *which* studio is bidding, even if they do not yet know the exact bid amount.

### 3.4 Commitment Timing and Mempool Metadata
* **The Leak**: The exact block number, timestamp, and sequence number (`sequence`) of a commitment are public. Observers know how many studios have entered the auction in real time.

### 3.5 Weak Salt Vulnerability (Brute-Force Risk)
* **The Leak**: If a user generates a salt using predictable seeds, low-entropy algorithms (like JavaScript `Math.random()`), or dictionary words, an attacker with a GPU cluster can compute millions of hashes per second and brute-force the bid value before the commit phase ends.
* **Mitigation**: Our frontend exclusively utilizes `window.crypto.getRandomValues` to generate 256-bit cryptographically secure random salts.

---

## 4. Privacy Comparison Table

| Attribute | Plaintext Auction | Commit-Reveal Auction (This Project) | Zama FHEVM (Future Extension) |
|---|---|---|---|
| **Bid confidentiality before deadline** | ❌ None (Public) | ✅ Protected by Keccak-256 | ✅ Encrypted (`euint64`) |
| **Bid confidentiality during evaluation**| ❌ Public | ❌ Becomes Public | ✅ Computed over Ciphertext |
| **Losing bids confidentiality** | ❌ Public | ❌ Public | ✅ Permanently Secret |
| **Escrow deposit privacy** | ❌ Public | ❌ Public amount | ✅ Encrypted tokens (eERC-20) |
| **Sniping resistance** | ❌ Highly vulnerable | ✅ Completely immune | ✅ Completely immune |
| **Client trust & secret storage** | High (No secrets) | Critical (Must preserve salt) | High (Standard Web3 keys) |
| **Hardware / Network dependencies** | Standard EVM | Standard EVM (Foundry/Anvil) | FHE coprocessor / fhEVM nodes |

---

## 5. Future Extension: Confidential Bidding with Zama FHEVM

To achieve permanent bid confidentiality, the auction could be upgraded using **Zama's fhEVM** (Fully Homomorphic Encryption Virtual Machine).

### 5.1 Architecture Under FHEVM
Instead of revealing bids in plaintext, studios would submit an encrypted bid:
```solidity
// Future FHEVM Conceptual Interface
function submitEncryptedBid(einput encryptedBid, bytes calldata proof) external payable {
    euint64 bid = FHE.asEuint64(encryptedBid, proof);
    euint64 maxDeposit = FHE.asEuint64(msg.value);
    
    // Homomorphic assertion: bid <= deposit
    ebool isFunded = FHE.lte(bid, maxDeposit);
    
    // Homomorphic comparison: update highest bid without decrypting
    ebool isHigher = FHE.gt(bid, encryptedHighestBid);
    encryptedHighestBid = FHE.select(isHigher, bid, encryptedHighestBid);
    encryptedWinner = FHE.select(isHigher, FHE.asEaddress(msg.sender), encryptedWinner);
}
```

### 5.2 Key Advantages of FHEVM
1. **Zero Reveal Phase**: Bidders do not need to come back online to reveal their bids.
2. **Permanent Secrecy for Losers**: Losing bids are never decrypted, preserving studios' commercial bidding strategies forever.
3. **Encrypted Escrow**: In conjunction with confidential ERC-20 tokens, even deposit amounts can remain encrypted.

### 5.3 Practical Trade-offs & Limitations of FHEVM Today
* **Performance Overhead**: FHE homomorphic operations require specialized cryptographic coprocessors and introduce higher transaction latencies.
* **Ecosystem Maturity**: fhEVM networks are currently in specialized testnets (Zama Devnet), whereas standard EVM commit-reveal is universally deployable on Ethereum mainnet, Layer 2 rollups (Arbitrum, Optimism, Base), and local Anvil development nodes today.

---

## 6. Conclusion

Commit-reveal provides an elegant, gas-efficient, and mathematically sound defense against last-second front-running and deadline sniping without requiring specialized cryptographic coprocessors. While it leaves escrow deposits and post-reveal bids visible, it fully achieves *The Quiet Room's* cooperative goal: **a fair, tamper-proof homepage feature slot auction where no studio can be sniped.**
