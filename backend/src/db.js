/**
 * Database Module
 * PostgreSQL with in-memory fallback for local development
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// In-memory storage for when PostgreSQL is not available
let memoryStore = {
  skills: [],
  purchases: []
};

let useMemory = false;
let pool = null;

// Only create pool if DATABASE_URL is set
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
}

/**
 * Initialize database tables
 */
async function init() {
  if (!pool) {
    console.log('No DATABASE_URL - using in-memory storage');
    useMemory = true;
    return;
  }

  try {
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

      console.log('Database initialized (PostgreSQL)');
    } finally {
      client.release();
    }
  } catch (err) {
    console.log('PostgreSQL unavailable - using in-memory storage');
    useMemory = true;
  }
}

/**
 * Seed default skills if empty
 */
async function seed() {
  const defaultSkills = [
    {
      title: 'Kubernetes Security Reviews',
      creator: '@kube-warden',
      tags: 'security, kubernetes, audit',
      price: 2.4,
      description: 'Cluster hardening, CIS benchmarks, incident response playbooks.',
      content: '# Kubernetes Security Reviews\n\nComprehensive security audit procedures for K8s clusters.'
    },
    {
      title: 'LLM Red Teaming',
      creator: '@breach-bot',
      tags: 'llm, security, prompt',
      price: 1.8,
      description: 'Prompt injection testing, jailbreak detection, model audits.',
      content: '# LLM Red Teaming\n\nIdentify and exploit LLM vulnerabilities.'
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
      title: 'Web Scraping Pipelines',
      creator: '@crawl-agent',
      tags: 'data, scraping, extraction',
      price: 0.6,
      description: 'Extraction workflows, anti-detection, data cleaning.',
      content: '# Web Scraping Pipelines\n\nBuild robust data extraction systems.'
    },
    {
      title: 'Solana DeFi Integration',
      creator: '@sol-dev',
      tags: 'blockchain, solana, defi',
      price: 2.0,
      description: 'Token swaps, liquidity pools, on-chain analytics.',
      content: '# Solana DeFi Integration\n\nIntegrate with Solana DeFi protocols.'
    },
    {
      title: 'Prediction Market Research',
      creator: '@signal-weaver',
      tags: 'data, prediction, markets',
      price: 1.1,
      description: 'Forecasting workflows, calibration methods, market scanning.',
      content: '# Prediction Market Research\n\nMaster forecasting and market analysis techniques.'
    },
    {
      title: 'Discord Bot Framework',
      creator: '@bot-architect',
      tags: 'automation, discord, bots',
      price: 0.5,
      description: 'Moderation bots, slash commands, reaction roles.',
      content: '# Discord Bot Framework\n\nBuild Discord bots with best practices.'
    },
    {
      title: 'Smart Contract Auditing',
      creator: '@audit-prime',
      tags: 'blockchain, security, solidity',
      price: 3.2,
      description: 'Vulnerability patterns, formal verification, gas optimization.',
      content: '# Smart Contract Auditing\n\nComprehensive smart contract security review methodology.'
    },
    {
      title: 'API Rate Limit Handling',
      creator: '@rate-watcher',
      tags: 'devops, api, resilience',
      price: 0.3,
      description: 'Backoff strategies, queue management, limit tracking.',
      content: '# API Rate Limit Handling\n\nGracefully handle API rate limits.'
    },
    {
      title: 'Data Pipeline Orchestration',
      creator: '@data-flow',
      tags: 'data, devops, automation',
      price: 1.5,
      description: 'ETL workflows, scheduling, monitoring, error handling.',
      content: '# Data Pipeline Orchestration\n\nBuild reliable data pipelines.'
    }
  ];

  if (useMemory) {
    if (memoryStore.skills.length === 0) {
      memoryStore.skills = defaultSkills.map((s, i) => ({
        ...s,
        id: crypto.randomUUID(),
        creatorWallet: null,
        downloads: Math.floor(Math.random() * 100),
        createdAt: new Date(Date.now() - i * 86400000).toISOString()
      }));
      console.log('Seeded default skills (memory)');
    }
    return;
  }

  const { rows } = await pool.query('SELECT COUNT(*) FROM skills');
  if (parseInt(rows[0].count) > 0) return;

  for (const skill of defaultSkills) {
    await pool.query(
      `INSERT INTO skills (title, creator, tags, price, description, content, downloads)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [skill.title, skill.creator, skill.tags, skill.price, skill.description, skill.content, Math.floor(Math.random() * 100)]
    );
  }

  console.log('Seeded default skills (PostgreSQL)');
}

// ============================================
// SKILLS
// ============================================

async function getSkills() {
  if (useMemory) {
    return [...memoryStore.skills].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  const { rows } = await pool.query(
    'SELECT * FROM skills ORDER BY created_at DESC'
  );
  return rows.map(formatSkill);
}

async function getSkillById(id) {
  if (useMemory) {
    return memoryStore.skills.find(s => s.id === id) || null;
  }

  const { rows } = await pool.query(
    'SELECT * FROM skills WHERE id = $1',
    [id]
  );
  return rows[0] ? formatSkill(rows[0]) : null;
}

async function createSkill(skill) {
  if (useMemory) {
    const newSkill = {
      id: crypto.randomUUID(),
      title: skill.title,
      creator: skill.creator,
      creatorWallet: skill.creatorWallet || null,
      tags: skill.tags,
      price: parseFloat(skill.price),
      description: skill.description,
      content: skill.content,
      downloads: 0,
      createdAt: new Date().toISOString()
    };
    memoryStore.skills.unshift(newSkill);
    return newSkill;
  }

  const { rows } = await pool.query(
    `INSERT INTO skills (title, creator, creator_wallet, tags, price, description, content)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [skill.title, skill.creator, skill.creatorWallet, skill.tags, skill.price, skill.description, skill.content]
  );
  return formatSkill(rows[0]);
}

async function incrementDownloads(id) {
  if (useMemory) {
    const skill = memoryStore.skills.find(s => s.id === id);
    if (skill) skill.downloads++;
    return;
  }

  await pool.query(
    'UPDATE skills SET downloads = downloads + 1 WHERE id = $1',
    [id]
  );
}

async function getStats() {
  if (useMemory) {
    const creators = new Set(memoryStore.skills.map(s => s.creator));
    return {
      totalSkills: memoryStore.skills.length,
      totalCreators: creators.size,
      totalSales: memoryStore.purchases.length
    };
  }

  const skillsResult = await pool.query('SELECT COUNT(*) FROM skills');
  const creatorsResult = await pool.query('SELECT COUNT(DISTINCT creator) FROM skills');
  const salesResult = await pool.query('SELECT COUNT(*) FROM purchases');

  return {
    totalSkills: parseInt(skillsResult.rows[0].count),
    totalCreators: parseInt(creatorsResult.rows[0].count),
    totalSales: parseInt(salesResult.rows[0].count)
  };
}

async function getTotalDownloads() {
  if (useMemory) {
    return memoryStore.skills.reduce((sum, s) => sum + (s.downloads || 0), 0);
  }

  const result = await pool.query('SELECT COALESCE(SUM(downloads), 0) as total FROM skills');
  return parseInt(result.rows[0].total);
}

async function searchSkills(query) {
  const q = query.toLowerCase();
  
  if (useMemory) {
    return memoryStore.skills.filter(s => {
      const text = `${s.title} ${s.description} ${s.tags} ${s.creator}`.toLowerCase();
      return text.includes(q);
    });
  }
  
  const { rows } = await pool.query(`
    SELECT *,
      CASE 
        WHEN LOWER(title) LIKE $1 THEN 3
        WHEN LOWER(tags) LIKE $1 THEN 2
        WHEN LOWER(description) LIKE $1 THEN 1
        ELSE 0
      END as relevance
    FROM skills
    WHERE 
      LOWER(title) LIKE $1 OR
      LOWER(description) LIKE $1 OR
      LOWER(tags) LIKE $1 OR
      LOWER(creator) LIKE $1
    ORDER BY relevance DESC, downloads DESC
  `, [`%${q}%`]);
  
  return rows.map(formatSkill);
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
  if (useMemory) {
    return memoryStore.purchases.filter(p => p.buyerWallet === wallet);
  }

  const { rows } = await pool.query(
    'SELECT * FROM purchases WHERE buyer_wallet = $1 ORDER BY purchased_at DESC',
    [wallet]
  );
  return rows.map(formatPurchase);
}

async function getPurchase(wallet, skillId) {
  if (useMemory) {
    return memoryStore.purchases.find(p => 
      p.buyerWallet === wallet && p.skillId === skillId
    ) || null;
  }

  const { rows } = await pool.query(
    'SELECT * FROM purchases WHERE buyer_wallet = $1 AND skill_id = $2',
    [wallet, skillId]
  );
  return rows[0] ? formatPurchase(rows[0]) : null;
}

async function createPurchase(purchase) {
  if (useMemory) {
    const newPurchase = {
      id: crypto.randomUUID(),
      buyerWallet: purchase.buyerWallet,
      skillId: purchase.skillId,
      skillTitle: purchase.skillTitle,
      txSignature: purchase.txSignature,
      pricePaid: parseFloat(purchase.pricePaid),
      purchasedAt: new Date().toISOString()
    };
    memoryStore.purchases.push(newPurchase);
    return newPurchase;
  }

  const { rows } = await pool.query(
    `INSERT INTO purchases (buyer_wallet, skill_id, skill_title, tx_signature, price_paid)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [purchase.buyerWallet, purchase.skillId, purchase.skillTitle, purchase.txSignature, purchase.pricePaid]
  );
  return formatPurchase(rows[0]);
}

async function checkOwnership(wallet, skillId) {
  if (useMemory) {
    return memoryStore.purchases.some(p => 
      p.buyerWallet === wallet && p.skillId === skillId
    );
  }

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
  getSkills,
  getSkillById,
  createSkill,
  incrementDownloads,
  getStats,
  getTotalDownloads,
  searchSkills,
  getPurchasesByWallet,
  getPurchase,
  createPurchase,
  checkOwnership
};
