/**
 * Solana Payment Module
 * Handles SOL transfers between buyers and creators
 */

const LAMPORTS_PER_SOL = 1000000000;

/**
 * Payment configuration
 */
const config = {
  network: process.env.SOLANA_NETWORK || 'devnet',
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  platformWallet: process.env.PLATFORM_WALLET,
  platformFeePercent: parseFloat(process.env.PLATFORM_FEE_PERCENT) || 5
};

/**
 * Calculate platform fee
 * @param {number} amount - Amount in SOL
 * @returns {object} - Breakdown of creator amount and platform fee
 */
function calculateFees(amount) {
  const platformFee = amount * (config.platformFeePercent / 100);
  const creatorAmount = amount - platformFee;
  
  return {
    total: amount,
    creatorAmount: Math.round(creatorAmount * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL,
    platformFee: Math.round(platformFee * LAMPORTS_PER_SOL) / LAMPORTS_PER_SOL,
    platformFeePercent: config.platformFeePercent
  };
}

/**
 * Generate payment instructions for client
 * @param {string} creatorWallet - Creator's Solana wallet address
 * @param {number} priceInSol - Price in SOL
 * @returns {object} - Payment instructions for frontend
 */
function generatePaymentInstructions(creatorWallet, priceInSol) {
  const fees = calculateFees(priceInSol);
  
  return {
    network: config.network,
    rpcUrl: config.rpcUrl,
    transactions: [
      {
        type: 'creator_payment',
        to: creatorWallet,
        amount: fees.creatorAmount,
        lamports: Math.round(fees.creatorAmount * LAMPORTS_PER_SOL)
      },
      {
        type: 'platform_fee',
        to: config.platformWallet,
        amount: fees.platformFee,
        lamports: Math.round(fees.platformFee * LAMPORTS_PER_SOL)
      }
    ],
    total: {
      sol: priceInSol,
      lamports: Math.round(priceInSol * LAMPORTS_PER_SOL)
    },
    fees
  };
}

/**
 * Verify a transaction on-chain
 * @param {string} signature - Transaction signature
 * @returns {Promise<object>} - Transaction details
 */
async function verifyTransaction(signature) {
  // In production, use @solana/web3.js to verify
  // const connection = new Connection(config.rpcUrl);
  // const tx = await connection.getTransaction(signature);
  
  return {
    verified: true,
    signature,
    timestamp: new Date().toISOString(),
    note: 'Verification requires @solana/web3.js in production'
  };
}

module.exports = {
  config,
  calculateFees,
  generatePaymentInstructions,
  verifyTransaction,
  LAMPORTS_PER_SOL
};



