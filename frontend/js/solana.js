/**
 * Solana Module
 * Handles Solana transactions
 * 
 * Currently uses direct transfers.
 * Will be updated to use smart contract when deployed.
 */

const Solana = {
  // Devnet by default, switch to mainnet-beta for production
  network: 'devnet',
  
  // Connection endpoint
  get endpoint() {
    if (this.network === 'mainnet-beta') {
      return 'https://api.mainnet-beta.solana.com';
    }
    return 'https://api.devnet.solana.com';
  },

  // Platform treasury wallet (receives fees)
  // TODO: Set this to your actual treasury wallet
  treasuryWallet: 'TREASURY_WALLET_ADDRESS_HERE',
  
  // Platform fee percentage (e.g., 0.05 = 5%)
  platformFee: 0.05,

  /**
   * Create a purchase transaction
   * 
   * Currently: Direct transfer to creator
   * Future: Call smart contract for escrow + fee splitting
   * 
   * @param {string} creatorWallet - Creator's wallet address
   * @param {number} priceSol - Price in SOL
   * @returns {Transaction} - Unsigned Solana transaction
   */
  async createPurchaseTransaction(creatorWallet, priceSol) {
    // Dynamic import to avoid loading Solana SDK if not needed
    const { 
      Connection, 
      PublicKey, 
      Transaction, 
      SystemProgram, 
      LAMPORTS_PER_SOL 
    } = await import('https://esm.sh/@solana/web3.js@1.87.6');

    const connection = new Connection(this.endpoint, 'confirmed');
    const buyerPubkey = new PublicKey(Wallet.address);
    const creatorPubkey = new PublicKey(creatorWallet);
    
    const lamports = Math.round(priceSol * LAMPORTS_PER_SOL);
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: buyerPubkey
    });

    // === CURRENT IMPLEMENTATION: Direct Transfer ===
    // Full amount goes to creator
    transaction.add(
      SystemProgram.transfer({
        fromPubkey: buyerPubkey,
        toPubkey: creatorPubkey,
        lamports
      })
    );

    // === FUTURE: Smart Contract Call ===
    // When contract is deployed, replace above with:
    // 
    // const program = new Program(idl, programId, provider);
    // const instruction = await program.methods
    //   .purchaseSkill(skillId, new BN(lamports))
    //   .accounts({
    //     buyer: buyerPubkey,
    //     creator: creatorPubkey,
    //     treasury: new PublicKey(this.treasuryWallet),
    //     systemProgram: SystemProgram.programId
    //   })
    //   .instruction();
    // transaction.add(instruction);

    return transaction;
  },

  /**
   * Execute a purchase
   * 
   * @param {string} creatorWallet - Creator's wallet address  
   * @param {number} priceSol - Price in SOL
   * @returns {string} - Transaction signature
   */
  async executePurchase(creatorWallet, priceSol) {
    if (!Wallet.address) {
      throw new Error('Wallet not connected');
    }

    // Create transaction
    const transaction = await this.createPurchaseTransaction(creatorWallet, priceSol);
    
    // Sign and send via Phantom
    const signature = await Wallet.signAndSendTransaction(transaction);
    
    // Wait for confirmation
    await this.confirmTransaction(signature);
    
    return signature;
  },

  /**
   * Wait for transaction confirmation
   */
  async confirmTransaction(signature, maxRetries = 30) {
    const { Connection } = await import('https://esm.sh/@solana/web3.js@1.87.6');
    const connection = new Connection(this.endpoint, 'confirmed');
    
    for (let i = 0; i < maxRetries; i++) {
      const status = await connection.getSignatureStatus(signature);
      
      if (status?.value?.confirmationStatus === 'confirmed' || 
          status?.value?.confirmationStatus === 'finalized') {
        return true;
      }
      
      if (status?.value?.err) {
        throw new Error('Transaction failed');
      }
      
      // Wait 1 second before retry
      await new Promise(r => setTimeout(r, 1000));
    }
    
    throw new Error('Transaction confirmation timeout');
  },

  /**
   * Get SOL balance for connected wallet
   */
  async getBalance() {
    if (!Wallet.address) return 0;
    
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = 
      await import('https://esm.sh/@solana/web3.js@1.87.6');
    
    const connection = new Connection(this.endpoint, 'confirmed');
    const balance = await connection.getBalance(new PublicKey(Wallet.address));
    
    return balance / LAMPORTS_PER_SOL;
  },

  /**
   * Request airdrop (devnet only)
   */
  async requestAirdrop(amount = 1) {
    if (this.network !== 'devnet') {
      throw new Error('Airdrop only available on devnet');
    }
    
    const { Connection, PublicKey, LAMPORTS_PER_SOL } = 
      await import('https://esm.sh/@solana/web3.js@1.87.6');
    
    const connection = new Connection(this.endpoint, 'confirmed');
    const signature = await connection.requestAirdrop(
      new PublicKey(Wallet.address),
      amount * LAMPORTS_PER_SOL
    );
    
    await this.confirmTransaction(signature);
    return signature;
  }
};

window.Solana = Solana;

