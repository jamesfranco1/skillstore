/**
 * Solana Client-Side Payment Handler
 * 
 * This code runs in the browser with Phantom wallet
 * Include via <script> or import in your frontend build
 */

const SolanaPayment = {
  LAMPORTS_PER_SOL: 1000000000,
  
  /**
   * Check if Phantom is installed
   */
  isPhantomInstalled() {
    return window.phantom?.solana?.isPhantom || false;
  },
  
  /**
   * Get Phantom provider
   */
  getProvider() {
    if (!this.isPhantomInstalled()) {
      window.open('https://phantom.app/', '_blank');
      throw new Error('Phantom wallet not installed');
    }
    return window.phantom.solana;
  },
  
  /**
   * Connect to Phantom wallet
   */
  async connect() {
    const provider = this.getProvider();
    const response = await provider.connect();
    return response.publicKey.toString();
  },
  
  /**
   * Disconnect wallet
   */
  async disconnect() {
    const provider = this.getProvider();
    await provider.disconnect();
  },
  
  /**
   * Create and send a transfer transaction
   * @param {string} toAddress - Recipient wallet address
   * @param {number} amountInSol - Amount in SOL
   * @param {string} rpcUrl - Solana RPC endpoint
   */
  async transfer(toAddress, amountInSol, rpcUrl = 'https://api.devnet.solana.com') {
    // This requires @solana/web3.js loaded in the browser
    // <script src="https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js"></script>
    
    const { Connection, PublicKey, Transaction, SystemProgram } = window.solanaWeb3;
    
    const provider = this.getProvider();
    const connection = new Connection(rpcUrl);
    
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports: Math.round(amountInSol * this.LAMPORTS_PER_SOL)
      })
    );
    
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = provider.publicKey;
    
    const signed = await provider.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize());
    
    await connection.confirmTransaction(signature);
    
    return signature;
  },
  
  /**
   * Purchase a skill (transfer to creator + platform fee)
   * @param {object} paymentInstructions - From server generatePaymentInstructions
   */
  async purchaseSkill(paymentInstructions) {
    const signatures = [];
    
    for (const tx of paymentInstructions.transactions) {
      if (tx.amount > 0) {
        const sig = await this.transfer(
          tx.to,
          tx.amount,
          paymentInstructions.rpcUrl
        );
        signatures.push({ type: tx.type, signature: sig });
      }
    }
    
    return {
      success: true,
      signatures,
      total: paymentInstructions.total
    };
  }
};

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SolanaPayment;
}

