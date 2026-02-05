/**
 * Database Module
 * PostgreSQL connection and queries
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Initialize database tables
 */
async function init() {
  const client = await pool.connect();
  
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        creator VARCHAR(100) NOT NULL,
        creator_wallet VARCHAR(50),
        tags TEXT,
        price DECIMAL(10, 6) NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        downloads INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_wallet VARCHAR(50) NOT NULL,
        skill_id UUID NOT NULL REFERENCES skills(id),
        skill_title VARCHAR(255) NOT NULL,
        tx_signature VARCHAR(100) NOT NULL,
        price_paid DECIMAL(10, 6) NOT NULL,
        purchased_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(buyer_wallet, skill_id)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_wallet)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_purchases_skill ON purchases(skill_id)
    `);

    console.log('Database initialized');
  } finally {
    client.release();
  }
}

/**
 * Seed default skills if empty
 */
async function seed() {
  const { rows } = await pool.query('SELECT COUNT(*) FROM skills');
  if (parseInt(rows[0].count) > 0) return;

  const defaultSkills = [
    {
      title: 'Kubernetes Security Reviews',
      creator: '@kube-warden',
      tags: 'kubernetes, security, audit',
      price: 2.4,
      description: 'Cluster hardening, CIS benchmarks, incident response playbooks.',
      content: '# Kubernetes Security Reviews\n\nComprehensive security audit procedures for K8s clusters.'
    },
    {
      title: 'Prediction Market Research',
      creator: '@signal-weaver',
      tags: 'prediction, markets, research',
      price: 1.1,
      description: 'Forecasting workflows, calibration methods, market scanning.',
      content: '# Prediction Market Research\n\nMaster forecasting and market analysis techniques.'
    },
    {
      title: 'OpenClaw Workflow Automation',
      creator: '@clawflow',
      tags: 'automation, whatsapp, openclaw',
      price: 0.8,
      description: 'WhatsApp + Discord routing with gateway policies.',
      content: '# OpenClaw Workflow Automation\n\nAutomate messaging across platforms.'
    },
    {
      title: 'LLM Red Teaming',
      creator: '@breach-bot',
      tags: 'llm, prompt, security',
      price: 1.8,
      description: 'Prompt injection testing, jailbreak detection, model audits.',
      content: '# LLM Red Teaming\n\nIdentify and exploit LLM vulnerabilities.'
    },
    {
      title: 'Web Scraping Pipelines',
      creator: '@crawl-agent',
      tags: 'scraping, data, extraction',
      price: 0.6,
      description: 'Extraction workflows, anti-detection, data cleaning.',
      content: '# Web Scraping Pipelines\n\nBuild robust data extraction systems.'
    },
    {
      title: 'Solana DeFi Integration',
      creator: '@sol-dev',
      tags: 'solana, blockchain, defi',
      price: 2.0,
      description: 'Token swaps, liquidity pools, on-chain analytics.',
      content: '# Solana DeFi Integration\n\nIntegrate with Solana DeFi protocols.'
    }
  ];

  for (const skill of defaultSkills) {
    await pool.query(
      `INSERT INTO skills (title, creator, tags, price, description, content)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [skill.title, skill.creator, skill.tags, skill.price, skill.description, skill.content]
    );
  }

  console.log('Seeded default skills');
}

// ============================================
// SKILLS
// ============================================

async function getSkills() {
  const { rows } = await pool.query(
    'SELECT * FROM skills ORDER BY created_at DESC'
  );
  return rows.map(formatSkill);
}

async function getSkillById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM skills WHERE id = $1',
    [id]
  );
  return rows[0] ? formatSkill(rows[0]) : null;
}

async function createSkill(skill) {
  const { rows } = await pool.query(
    `INSERT INTO skills (title, creator, creator_wallet, tags, price, description, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [skill.title, skill.creator, skill.creatorWallet, skill.tags, skill.price, skill.description, skill.content]
  );
  return formatSkill(rows[0]);
}

async function incrementDownloads(id) {
  await pool.query(
    'UPDATE skills SET downloads = downloads + 1 WHERE id = $1',
    [id]
  );
}

async function getStats() {
  const skillsResult = await pool.query('SELECT COUNT(*) FROM skills');
  const creatorsResult = await pool.query('SELECT COUNT(DISTINCT creator) FROM skills');
  const salesResult = await pool.query('SELECT COUNT(*) FROM purchases');

  return {
    totalSkills: parseInt(skillsResult.rows[0].count),
    totalCreators: parseInt(creatorsResult.rows[0].count),
    totalSales: parseInt(salesResult.rows[0].count)
  };
}

function formatSkill(row) {
  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    creatorWallet: row.creator_wallet,
    tags: row.tags,
    price: parseFloat(row.price),
    description: row.description,
    content: row.content,
    downloads: row.downloads,
    createdAt: row.created_at
  };
}

// ============================================
// PURCHASES
// ============================================

async function getPurchasesByWallet(wallet) {
  const { rows } = await pool.query(
    'SELECT * FROM purchases WHERE buyer_wallet = $1 ORDER BY purchased_at DESC',
    [wallet]
  );
  return rows.map(formatPurchase);
}

async function getPurchase(wallet, skillId) {
  const { rows } = await pool.query(
    'SELECT * FROM purchases WHERE buyer_wallet = $1 AND skill_id = $2',
    [wallet, skillId]
  );
  return rows[0] ? formatPurchase(rows[0]) : null;
}

async function createPurchase(purchase) {
  const { rows } = await pool.query(
    `INSERT INTO purchases (buyer_wallet, skill_id, skill_title, tx_signature, price_paid)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [purchase.buyerWallet, purchase.skillId, purchase.skillTitle, purchase.txSignature, purchase.pricePaid]
  );
  return formatPurchase(rows[0]);
}

async function checkOwnership(wallet, skillId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM purchases WHERE buyer_wallet = $1 AND skill_id = $2',
    [wallet, skillId]
  );
  return rows.length > 0;
}

function formatPurchase(row) {
  return {
    id: row.id,
    buyerWallet: row.buyer_wallet,
    skillId: row.skill_id,
    skillTitle: row.skill_title,
    txSignature: row.tx_signature,
    pricePaid: parseFloat(row.price_paid),
    purchasedAt: row.purchased_at
  };
}

module.exports = {
  init,
  seed,
  // Skills
  getSkills,
  getSkillById,
  createSkill,
  incrementDownloads,
  getStats,
  // Purchases
  getPurchasesByWallet,
  getPurchase,
  createPurchase,
  checkOwnership
};

