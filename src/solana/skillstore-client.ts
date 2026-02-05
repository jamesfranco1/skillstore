/**
 * Skillstore Solana Client
 * TypeScript client for interacting with the Skillstore smart contract
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

// Program ID - update this after deployment
export const PROGRAM_ID = new PublicKey('SKLstoreXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

// Devnet RPC endpoint
export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const MAINNET_RPC = 'https://api.mainnet-beta.solana.com';

// PDA seeds
const CONFIG_SEED = 'config';
const LISTING_SEED = 'listing';
const RECEIPT_SEED = 'receipt';

/**
 * Get the config PDA
 */
export function getConfigPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Get the listing PDA for a skill
 */
export function getListingPda(skillId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(LISTING_SEED), Buffer.from(skillId)],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Get the receipt PDA for a buyer and skill
 */
export function getReceiptPda(buyer: PublicKey, skillId: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from(RECEIPT_SEED), buyer.toBuffer(), Buffer.from(skillId)],
    PROGRAM_ID
  );
  return pda;
}

/**
 * Check if a buyer owns a skill by checking for receipt
 */
export async function checkOwnership(
  connection: Connection,
  buyer: PublicKey,
  skillId: string
): Promise<boolean> {
  const receiptPda = getReceiptPda(buyer, skillId);
  const accountInfo = await connection.getAccountInfo(receiptPda);
  return accountInfo !== null;
}

/**
 * Get all purchases for a wallet
 * Note: This requires an indexer for production. For demo, use getProgramAccounts.
 */
export async function getWalletPurchases(
  connection: Connection,
  wallet: PublicKey
): Promise<{ skillId: string; purchasedAt: number }[]> {
  // This is a simplified version - in production, use an indexer
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      // Filter by account type (Receipt) - first 8 bytes are discriminator
      { dataSize: 8 + 32 + 36 + 32 + 8 + 8 + 8 + 1 }, // Receipt size
      // Filter by buyer pubkey at offset 8 (after discriminator)
      { memcmp: { offset: 8, bytes: wallet.toBase58() } },
    ],
  });

  // Parse receipt accounts
  return accounts.map((acc) => {
    const data = acc.account.data;
    // Skip discriminator (8) + buyer (32)
    const skillIdLen = data.readUInt32LE(40);
    const skillId = data.slice(44, 44 + skillIdLen).toString('utf8');
    // Skip to purchased_at timestamp
    const purchasedAt = Number(data.readBigInt64LE(44 + 32 + 32 + 8 + 8));
    return { skillId, purchasedAt };
  });
}

/**
 * Fetch listing details
 */
export async function getListing(
  connection: Connection,
  skillId: string
): Promise<{
  creator: PublicKey;
  skillId: string;
  priceLamports: number;
  metadataUri: string;
  totalSales: number;
  isActive: boolean;
} | null> {
  const listingPda = getListingPda(skillId);
  const accountInfo = await connection.getAccountInfo(listingPda);
  
  if (!accountInfo) return null;

  // Parse listing data (simplified - in production use Anchor's deserialize)
  const data = accountInfo.data;
  // This is a simplified parser - use Anchor IDL for proper parsing
  
  return {
    creator: new PublicKey(data.slice(8, 40)),
    skillId: skillId,
    priceLamports: Number(data.readBigUInt64LE(76)), // Approximate offset
    metadataUri: '', // Would need proper parsing
    totalSales: 0,
    isActive: true,
  };
}

/**
 * Phantom wallet integration for frontend
 */
export class SkillstoreClient {
  private connection: Connection;
  private wallet: any; // Phantom wallet

  constructor(rpcUrl: string = DEVNET_RPC) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.wallet = null;
  }

  /**
   * Connect to Phantom wallet
   */
  async connect(): Promise<PublicKey | null> {
    if (typeof window === 'undefined') return null;
    
    const phantom = (window as any).phantom?.solana;
    if (!phantom?.isPhantom) {
      window.open('https://phantom.app/', '_blank');
      return null;
    }

    try {
      const response = await phantom.connect();
      this.wallet = phantom;
      return response.publicKey;
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      return null;
    }
  }

  /**
   * Get connected wallet public key
   */
  getWallet(): PublicKey | null {
    return this.wallet?.publicKey || null;
  }

  /**
   * Check if user owns a skill
   */
  async ownsSkill(skillId: string): Promise<boolean> {
    const wallet = this.getWallet();
    if (!wallet) return false;
    return checkOwnership(this.connection, wallet, skillId);
  }

  /**
   * Get all skills owned by connected wallet
   */
  async getMySkills(): Promise<{ skillId: string; purchasedAt: number }[]> {
    const wallet = this.getWallet();
    if (!wallet) return [];
    return getWalletPurchases(this.connection, wallet);
  }

  /**
   * Purchase a skill
   * Note: This builds the transaction. In production, use Anchor for proper instruction building.
   */
  async purchaseSkill(
    skillId: string,
    creatorPubkey: string,
    treasuryPubkey: string
  ): Promise<string | null> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    const buyer = this.wallet.publicKey;
    const creator = new PublicKey(creatorPubkey);
    const treasury = new PublicKey(treasuryPubkey);
    
    const configPda = getConfigPda();
    const listingPda = getListingPda(skillId);
    const receiptPda = getReceiptPda(buyer, skillId);

    // Get listing price
    const listing = await getListing(this.connection, skillId);
    if (!listing) throw new Error('Listing not found');

    // Build transaction
    // Note: In production, use Anchor to build proper program instructions
    // This is a placeholder showing the flow
    const transaction = new Transaction();
    
    // The actual instruction would be built using Anchor:
    // const ix = await program.methods.purchaseSkill().accounts({...}).instruction();
    // transaction.add(ix);

    // For demo, we'll do a direct transfer instead
    // In production, replace this with proper Anchor instruction
    console.log('Would purchase skill:', skillId);
    console.log('Price:', listing.priceLamports, 'lamports');
    console.log('Creator:', creator.toBase58());
    console.log('Treasury:', treasury.toBase58());

    // Sign and send
    // const signed = await this.wallet.signTransaction(transaction);
    // const signature = await this.connection.sendRawTransaction(signed.serialize());
    // await this.connection.confirmTransaction(signature);
    // return signature;

    return null; // Placeholder
  }

  /**
   * Generate agent API key
   * Signs a message to prove wallet ownership, server issues API key
   */
  async generateAgentKey(): Promise<string | null> {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }

    const message = `Skillstore Agent Key Request\nWallet: ${this.wallet.publicKey.toBase58()}\nTimestamp: ${Date.now()}`;
    const encodedMessage = new TextEncoder().encode(message);
    
    try {
      const signature = await this.wallet.signMessage(encodedMessage, 'utf8');
      
      // Send to backend to generate API key
      const response = await fetch('/api/agent-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: this.wallet.publicKey.toBase58(),
          message,
          signature: Buffer.from(signature.signature).toString('base64'),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate agent key');
      }

      const data = await response.json();
      return data.apiKey;
    } catch (err) {
      console.error('Failed to generate agent key:', err);
      return null;
    }
  }
}

// Export singleton for easy use
export const skillstore = new SkillstoreClient();


