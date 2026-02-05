/**
 * Database module
 * Uses PostgreSQL on Railway, falls back to in-memory for local dev
 */

const { Pool } = require('pg');

// Check if we have a database URL
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let useDatabase = false;

// In-memory fallback
const memoryStore = {
  skills: [],
  purchases: [],
};

/**
 * Initialize database connection
 */
async function init() {
  if (DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });
      
      // Test connection
      await pool.query('SELECT NOW()');
      console.log('Database connected');
      
      // Create tables if they don't exist
      await createTables();
      useDatabase = true;
      
      return true;
    } catch (err) {
      console.error('Database connection failed:', err.message);
      console.log('Falling back to in-memory storage');
      useDatabase = false;
    }
  } else {
    console.log('No DATABASE_URL found, using in-memory storage');
    useDatabase = false;
  }
  return false;
}

/**
 * Create database tables
 */
async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS skills (
      id VARCHAR(100) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      creator VARCHAR(100) NOT NULL,
      wallet VARCHAR(100),
      tags TEXT NOT NULL,
      price DECIMAL(10, 4) NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      downloads INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchases (
      id VARCHAR(100) PRIMARY KEY,
      buyer_wallet VARCHAR(100) NOT NULL,
      skill_id VARCHAR(100) NOT NULL REFERENCES skills(id),
      skill_title VARCHAR(255) NOT NULL,
      creator_wallet VARCHAR(100),
      tx_signature VARCHAR(200) NOT NULL,
      price_paid DECIMAL(10, 4) NOT NULL,
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      refunded BOOLEAN DEFAULT FALSE
    )
  `);
  
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_keys (
      id SERIAL PRIMARY KEY,
      api_key VARCHAR(100) UNIQUE NOT NULL,
      wallet VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_used TIMESTAMP,
      revoked BOOLEAN DEFAULT FALSE
    )
  `);
  
  // Create indexes
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_wallet);
    CREATE INDEX IF NOT EXISTS idx_purchases_skill ON purchases(skill_id);
    CREATE INDEX IF NOT EXISTS idx_agent_keys_wallet ON agent_keys(wallet);
    CREATE INDEX IF NOT EXISTS idx_agent_keys_key ON agent_keys(api_key);
  `);
  
  console.log('Database tables created');
}

// ============================================
// SKILLS
// ============================================

async function getSkills() {
  if (!useDatabase) {
    return memoryStore.skills;
  }
  
  const result = await pool.query(
    'SELECT * FROM skills ORDER BY created_at DESC'
  );
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    creator: row.creator,
    wallet: row.wallet,
    tags: row.tags,
    price: parseFloat(row.price),
    description: row.description,
    content: row.content,
    downloads: row.downloads,
    createdAt: row.created_at,
  }));
}

async function getSkillById(id) {
  if (!useDatabase) {
    return memoryStore.skills.find(s => s.id === id) || null;
  }
  
  const result = await pool.query(
    'SELECT * FROM skills WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    creator: row.creator,
    wallet: row.wallet,
    tags: row.tags,
    price: parseFloat(row.price),
    description: row.description,
    content: row.content,
    downloads: row.downloads,
    createdAt: row.created_at,
  };
}

async function createSkill(skill) {
  if (!useDatabase) {
    memoryStore.skills.unshift(skill);
    return skill;
  }
  
  await pool.query(
    `INSERT INTO skills (id, title, creator, wallet, tags, price, description, content, downloads, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [skill.id, skill.title, skill.creator, skill.wallet, skill.tags, skill.price, skill.description, skill.content, skill.downloads || 0, skill.createdAt]
  );
  return skill;
}

async function updateSkillDownloads(id) {
  if (!useDatabase) {
    const skill = memoryStore.skills.find(s => s.id === id);
    if (skill) skill.downloads = (skill.downloads || 0) + 1;
    return skill;
  }
  
  const result = await pool.query(
    'UPDATE skills SET downloads = downloads + 1 WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

async function getSkillsCount() {
  if (!useDatabase) {
    const creators = new Set(memoryStore.skills.map(s => s.creator));
    const downloads = memoryStore.skills.reduce((sum, s) => sum + (s.downloads || 0), 0);
    return {
      total: memoryStore.skills.length,
      creators: creators.size,
      downloads,
    };
  }
  
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT creator) as creators,
      COALESCE(SUM(downloads), 0) as downloads
    FROM skills
  `);
  return {
    total: parseInt(result.rows[0].total),
    creators: parseInt(result.rows[0].creators),
    downloads: parseInt(result.rows[0].downloads),
  };
}

// ============================================
// PURCHASES
// ============================================

async function getPurchasesByWallet(wallet) {
  if (!useDatabase) {
    return memoryStore.purchases.filter(p => p.buyerWallet === wallet && !p.refunded);
  }
  
  const result = await pool.query(
    'SELECT * FROM purchases WHERE buyer_wallet = $1 AND refunded = FALSE ORDER BY purchased_at DESC',
    [wallet]
  );
  return result.rows.map(row => ({
    id: row.id,
    buyerWallet: row.buyer_wallet,
    skillId: row.skill_id,
    skillTitle: row.skill_title,
    creatorWallet: row.creator_wallet,
    txSignature: row.tx_signature,
    pricePaid: parseFloat(row.price_paid),
    purchasedAt: row.purchased_at,
    refunded: row.refunded,
  }));
}

async function getPurchase(wallet, skillId) {
  if (!useDatabase) {
    return memoryStore.purchases.find(p => 
      p.buyerWallet === wallet && p.skillId === skillId && !p.refunded
    ) || null;
  }
  
  const result = await pool.query(
    'SELECT * FROM purchases WHERE buyer_wallet = $1 AND skill_id = $2 AND refunded = FALSE',
    [wallet, skillId]
  );
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    id: row.id,
    buyerWallet: row.buyer_wallet,
    skillId: row.skill_id,
    skillTitle: row.skill_title,
    creatorWallet: row.creator_wallet,
    txSignature: row.tx_signature,
    pricePaid: parseFloat(row.price_paid),
    purchasedAt: row.purchased_at,
    refunded: row.refunded,
  };
}

async function createPurchase(purchase) {
  if (!useDatabase) {
    memoryStore.purchases.push(purchase);
    return purchase;
  }
  
  await pool.query(
    `INSERT INTO purchases (id, buyer_wallet, skill_id, skill_title, creator_wallet, tx_signature, price_paid, purchased_at, refunded)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [purchase.id, purchase.buyerWallet, purchase.skillId, purchase.skillTitle, purchase.creatorWallet, purchase.txSignature, purchase.pricePaid, purchase.purchasedAt, purchase.refunded]
  );
  return purchase;
}

async function walletOwnsSkill(wallet, skillId) {
  const purchase = await getPurchase(wallet, skillId);
  return purchase !== null;
}

// ============================================
// AGENT KEYS
// ============================================

async function createAgentKey(apiKey, wallet) {
  if (!useDatabase) {
    memoryStore.agentKeys = memoryStore.agentKeys || [];
    memoryStore.agentKeys.push({ apiKey, wallet, createdAt: new Date(), lastUsed: null, revoked: false });
    return true;
  }
  
  await pool.query(
    'INSERT INTO agent_keys (api_key, wallet) VALUES ($1, $2)',
    [apiKey, wallet]
  );
  return true;
}

async function getAgentKeyByKey(apiKey) {
  if (!useDatabase) {
    memoryStore.agentKeys = memoryStore.agentKeys || [];
    return memoryStore.agentKeys.find(k => k.apiKey === apiKey && !k.revoked) || null;
  }
  
  const result = await pool.query(
    'SELECT * FROM agent_keys WHERE api_key = $1 AND revoked = FALSE',
    [apiKey]
  );
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    apiKey: row.api_key,
    wallet: row.wallet,
    createdAt: row.created_at,
    lastUsed: row.last_used,
    revoked: row.revoked,
  };
}

async function updateAgentKeyLastUsed(apiKey) {
  if (!useDatabase) {
    const key = memoryStore.agentKeys?.find(k => k.apiKey === apiKey);
    if (key) key.lastUsed = new Date();
    return;
  }
  
  await pool.query(
    'UPDATE agent_keys SET last_used = CURRENT_TIMESTAMP WHERE api_key = $1',
    [apiKey]
  );
}

async function getAgentKeysByWallet(wallet) {
  if (!useDatabase) {
    memoryStore.agentKeys = memoryStore.agentKeys || [];
    return memoryStore.agentKeys
      .filter(k => k.wallet === wallet && !k.revoked)
      .map(k => ({
        key: `${k.apiKey.slice(0, 10)}...${k.apiKey.slice(-4)}`,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
      }));
  }
  
  const result = await pool.query(
    'SELECT * FROM agent_keys WHERE wallet = $1 AND revoked = FALSE ORDER BY created_at DESC',
    [wallet]
  );
  return result.rows.map(row => ({
    key: `${row.api_key.slice(0, 10)}...${row.api_key.slice(-4)}`,
    createdAt: row.created_at,
    lastUsed: row.last_used,
  }));
}

async function revokeAgentKey(apiKey, wallet) {
  if (!useDatabase) {
    const key = memoryStore.agentKeys?.find(k => k.apiKey === apiKey && k.wallet === wallet);
    if (key) {
      key.revoked = true;
      return true;
    }
    return false;
  }
  
  const result = await pool.query(
    'UPDATE agent_keys SET revoked = TRUE WHERE api_key = $1 AND wallet = $2 RETURNING *',
    [apiKey, wallet]
  );
  return result.rowCount > 0;
}

// ============================================
// SEED DATA
// ============================================

async function seedDefaultSkills(defaultSkills) {
  const existing = await getSkills();
  if (existing.length > 0) {
    console.log('Skills already exist, skipping seed');
    return;
  }
  
  console.log('Seeding default skills...');
  for (const skill of defaultSkills) {
    await createSkill(skill);
  }
  console.log(`Seeded ${defaultSkills.length} skills`);
}

module.exports = {
  init,
  // Skills
  getSkills,
  getSkillById,
  createSkill,
  updateSkillDownloads,
  getSkillsCount,
  // Purchases
  getPurchasesByWallet,
  getPurchase,
  createPurchase,
  walletOwnsSkill,
  // Agent Keys
  createAgentKey,
  getAgentKeyByKey,
  updateAgentKeyLastUsed,
  getAgentKeysByWallet,
  revokeAgentKey,
  // Seed
  seedDefaultSkills,
};


