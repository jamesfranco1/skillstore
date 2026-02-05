/**
 * Purchases Routes
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/purchases
 * Get purchases for a wallet
 */
router.get('/', async (req, res) => {
  try {
    const { wallet } = req.query;

    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const purchases = await db.getPurchasesByWallet(wallet);
    res.json({ purchases });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

/**
 * GET /api/purchases/check
 * Check if wallet owns a skill
 */
router.get('/check', async (req, res) => {
  try {
    const { wallet, skillId } = req.query;

    if (!wallet || !skillId) {
      return res.status(400).json({ error: 'Wallet and skillId required' });
    }

    const owns = await db.checkOwnership(wallet, skillId);
    res.json({ owns });
  } catch (err) {
    console.error('Error checking ownership:', err);
    res.status(500).json({ error: 'Failed to check ownership' });
  }
});

/**
 * POST /api/purchases
 * Record a purchase
 */
router.post('/', async (req, res) => {
  try {
    const { buyerWallet, skillId, txSignature, pricePaid } = req.body;

    // Validation
    if (!buyerWallet || !skillId || !txSignature) {
      return res.status(400).json({ 
        error: 'Missing required fields: buyerWallet, skillId, txSignature' 
      });
    }

    // Get the skill
    const skill = await db.getSkillById(skillId);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Check if already purchased
    const existing = await db.getPurchase(buyerWallet, skillId);
    if (existing) {
      return res.status(400).json({ error: 'Already purchased' });
    }

    // TODO: Verify transaction on-chain
    // When smart contracts are deployed, verify:
    // 1. Transaction exists and is confirmed
    // 2. Amount matches skill price
    // 3. Recipient is correct (creator wallet or contract)
    //
    // For now, we trust the frontend (development mode)

    // Record purchase
    const purchase = await db.createPurchase({
      buyerWallet,
      skillId,
      skillTitle: skill.title,
      txSignature,
      pricePaid: pricePaid || skill.price
    });

    res.status(201).json(purchase);
  } catch (err) {
    // Handle unique constraint violation (duplicate purchase)
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Already purchased' });
    }

    console.error('Error creating purchase:', err);
    res.status(500).json({ error: 'Failed to record purchase' });
  }
});

module.exports = router;

