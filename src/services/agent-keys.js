/**
 * Agent API Key Service
 * Manages API keys for agents to access purchased skills
 */

const crypto = require('crypto');
const nacl = require('tweetnacl');
const bs58 = require('bs58');

// In production, use a database
const agentKeys = new Map(); // apiKey -> { wallet, createdAt, lastUsed, revoked }

/**
 * Generate a secure API key
 */
function generateApiKey() {
  return `sk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Verify a signed message from Phantom wallet
 */
function verifySignature(wallet, message, signatureBase64) {
  try {
    const publicKey = bs58.decode(wallet);
    const signature = Buffer.from(signatureBase64, 'base64');
    const messageBytes = new TextEncoder().encode(message);
    
    return nacl.sign.detached.verify(messageBytes, signature, publicKey);
  } catch (err) {
    console.error('Signature verification failed:', err);
    return false;
  }
}

/**
 * Create a new agent API key for a wallet
 */
function createAgentKey(wallet, message, signatureBase64) {
  // Verify the signature
  if (!verifySignature(wallet, message, signatureBase64)) {
    throw new Error('Invalid signature');
  }

  // Check message freshness (5 minute window)
  const timestampMatch = message.match(/Timestamp: (\d+)/);
  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[1]);
    const age = Date.now() - timestamp;
    if (age > 5 * 60 * 1000) {
      throw new Error('Message expired');
    }
  }

  // Generate new key
  const apiKey = generateApiKey();
  
  // Store key
  agentKeys.set(apiKey, {
    wallet,
    createdAt: Date.now(),
    lastUsed: null,
    revoked: false,
  });

  return apiKey;
}

/**
 * Verify an API key and return wallet if valid
 */
function verifyAgentKey(apiKey) {
  const keyData = agentKeys.get(apiKey);
  
  if (!keyData) {
    return null;
  }

  if (keyData.revoked) {
    return null;
  }

  // Update last used
  keyData.lastUsed = Date.now();
  agentKeys.set(apiKey, keyData);

  return keyData.wallet;
}

/**
 * Revoke an API key
 */
function revokeAgentKey(apiKey, wallet) {
  const keyData = agentKeys.get(apiKey);
  
  if (!keyData) {
    return false;
  }

  // Only the wallet owner can revoke
  if (keyData.wallet !== wallet) {
    return false;
  }

  keyData.revoked = true;
  agentKeys.set(apiKey, keyData);
  return true;
}

/**
 * Get all keys for a wallet
 */
function getWalletKeys(wallet) {
  const keys = [];
  
  for (const [apiKey, data] of agentKeys.entries()) {
    if (data.wallet === wallet && !data.revoked) {
      keys.push({
        key: `${apiKey.slice(0, 10)}...${apiKey.slice(-4)}`, // Masked
        createdAt: data.createdAt,
        lastUsed: data.lastUsed,
      });
    }
  }

  return keys;
}

/**
 * Get all active keys for a wallet (full keys, for internal use)
 */
function getWalletKeysInternal(wallet) {
  const keys = [];
  
  for (const [apiKey, data] of agentKeys.entries()) {
    if (data.wallet === wallet && !data.revoked) {
      keys.push(apiKey);
    }
  }

  return keys;
}

module.exports = {
  createAgentKey,
  verifyAgentKey,
  revokeAgentKey,
  getWalletKeys,
  getWalletKeysInternal,
};

