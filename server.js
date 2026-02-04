const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

// Database
const db = require('./src/db');

// Services
const watermark = require('./src/services/watermark');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Default skills for seeding
const defaultSkills = [
  {
    id: "default-1",
    title: "Kubernetes Security Reviews",
    creator: "@kube-warden",
    wallet: null,
    tags: "kubernetes, security, audit",
    price: 2.4,
    description: "Cluster hardening, CIS benchmarks, incident response playbooks.",
    content: "# Kubernetes Security Reviews\n\nThis skill teaches you how to perform comprehensive security audits on Kubernetes clusters.\n\n## Topics Covered\n\n- CIS Benchmark compliance\n- RBAC configuration\n- Network policies\n- Pod security standards\n- Secrets management\n- Incident response procedures",
    downloads: 234,
    createdAt: "2025-12-01T00:00:00.000Z"
  },
  {
    id: "default-2",
    title: "Prediction Market Research",
    creator: "@signal-weaver",
    wallet: null,
    tags: "prediction, markets, research",
    price: 1.1,
    description: "Forecasting workflows, calibration methods, market scanning.",
    content: "# Prediction Market Research\n\nMaster the art of forecasting and market analysis.\n\n## What You'll Learn\n\n- Calibration techniques\n- Market scanning algorithms\n- Probability assessment\n- Signal detection",
    downloads: 189,
    createdAt: "2025-12-05T00:00:00.000Z"
  },
  {
    id: "default-3",
    title: "OpenClaw Workflow Automation",
    creator: "@clawflow",
    wallet: null,
    tags: "automation, whatsapp, openclaw",
    price: 0.8,
    description: "WhatsApp + Discord routing with gateway policies.",
    content: "# OpenClaw Workflow Automation\n\nAutomate your messaging workflows across platforms.\n\n## Features\n\n- WhatsApp integration\n- Discord bot setup\n- Gateway configuration\n- Message routing rules",
    downloads: 412,
    createdAt: "2025-12-10T00:00:00.000Z"
  },
  {
    id: "default-4",
    title: "LLM Red Teaming",
    creator: "@breach-bot",
    wallet: null,
    tags: "llm, prompt, security",
    price: 1.8,
    description: "Prompt injection testing, jailbreak detection, model audits.",
    content: "# LLM Red Teaming\n\nLearn to identify and exploit LLM vulnerabilities.\n\n## Coverage\n\n- Prompt injection attacks\n- Jailbreak techniques\n- Safety bypass methods\n- Audit frameworks",
    downloads: 567,
    createdAt: "2025-12-15T00:00:00.000Z"
  },
  {
    id: "default-5",
    title: "Web Scraping Pipelines",
    creator: "@crawl-agent",
    wallet: null,
    tags: "scraping, data, extraction",
    price: 0.6,
    description: "Extraction workflows, anti-detection, data cleaning.",
    content: "# Web Scraping Pipelines\n\nBuild robust data extraction systems.\n\n## Topics\n\n- Anti-detection strategies\n- Rate limiting\n- Data cleaning\n- Storage patterns",
    downloads: 298,
    createdAt: "2025-12-20T00:00:00.000Z"
  },
  {
    id: "default-6",
    title: "Solana DeFi Integration",
    creator: "@sol-dev",
    wallet: null,
    tags: "solana, blockchain, defi",
    price: 2.0,
    description: "Token swaps, liquidity pools, on-chain analytics.",
    content: "# Solana DeFi Integration\n\nIntegrate with Solana DeFi protocols.\n\n## Learn About\n\n- Jupiter aggregator\n- Raydium pools\n- On-chain analytics\n- Transaction building",
    downloads: 445,
    createdAt: "2025-12-25T00:00:00.000Z"
  }
];

// ============================================
// MIDDLEWARE
// ============================================

// Verify agent API key
async function verifyAgentKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing API key' });
  }
  
  const apiKey = authHeader.slice(7);
  const keyData = await db.getAgentKeyByKey(apiKey);
  
  if (!keyData) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  
  // Update last used
  await db.updateAgentKeyLastUsed(apiKey);
  
  req.agentWallet = keyData.wallet;
  next();
}

// ============================================
// API ROUTES - SKILLS
// ============================================

// GET /api/skills - Get all skills
app.get('/api/skills', async (req, res) => {
  try {
    const skills = await db.getSkills();
    const stats = await db.getSkillsCount();
    
    res.json({
      success: true,
      data: skills,
      stats
    });
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch skills' });
  }
});

// GET /api/skills/:id - Get single skill
app.get('/api/skills/:id', async (req, res) => {
  try {
    const skill = await db.getSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    res.json({ success: true, data: skill });
  } catch (err) {
    console.error('Error fetching skill:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch skill' });
  }
});

// POST /api/skills - Create new skill
app.post('/api/skills', async (req, res) => {
  try {
    const { title, creator, wallet, tags, price, description, content } = req.body;
    
    if (!title || !creator || !tags || !price || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: title, creator, tags, price, content' 
      });
    }
    
    const newSkill = {
      id: `skill-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      title,
      creator,
      wallet: wallet || null,
      tags,
      price: parseFloat(price),
      description: description || '',
      content,
      downloads: 0,
      createdAt: new Date().toISOString()
    };
    
    await db.createSkill(newSkill);
    res.status(201).json({ success: true, data: newSkill });
  } catch (err) {
    console.error('Error creating skill:', err);
    res.status(500).json({ success: false, error: 'Failed to create skill' });
  }
});

// POST /api/skills/:id/download - Increment download count
app.post('/api/skills/:id/download', async (req, res) => {
  try {
    const skill = await db.getSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    
    await db.updateSkillDownloads(req.params.id);
    const updated = await db.getSkillById(req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Error updating downloads:', err);
    res.status(500).json({ success: false, error: 'Failed to update downloads' });
  }
});

// ============================================
// API ROUTES - AGENT ENDPOINTS
// ============================================

// GET /skills.json - Agent-friendly endpoint
app.get('/skills.json', async (req, res) => {
  try {
    const skills = await db.getSkills();
    const agentData = skills.map(s => ({
      id: s.id,
      title: s.title,
      creator: s.creator,
      tags: s.tags.split(',').map(t => t.trim()),
      price_sol: s.price,
      description: s.description,
      downloads: s.downloads || 0,
      endpoint: `/api/skills/${s.id}`
    }));
    
    res.json({
      name: "skillstore.md",
      version: "1.0.0",
      updated: new Date().toISOString(),
      skills: agentData
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// GET /skills.md - Markdown version for agents
app.get('/skills.md', async (req, res) => {
  try {
    const skills = await db.getSkills();
    let md = `# skillstore.md - Skill Directory\n\n`;
    md += `Updated: ${new Date().toISOString()}\n\n`;
    md += `## Skills\n\n`;
    
    skills.forEach(s => {
      md += `### ${s.title}\n`;
      md += `- **Creator:** ${s.creator}\n`;
      md += `- **Price:** ${s.price} SOL\n`;
      md += `- **Tags:** ${s.tags}\n`;
      md += `- **Description:** ${s.description}\n`;
      md += `- **Endpoint:** \`/api/skills/${s.id}\`\n\n`;
    });
    
    res.type('text/markdown').send(md);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Failed to fetch skills');
  }
});

// ============================================
// API ROUTES - AGENT KEYS
// ============================================

// POST /api/agent-keys - Generate new agent API key
app.post('/api/agent-keys', async (req, res) => {
  const { wallet, message, signature } = req.body;
  
  if (!wallet || !message || !signature) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: wallet, message, signature' 
    });
  }
  
  try {
    // Validate message format
    if (!message.includes(wallet.slice(0, 8))) {
      return res.status(400).json({ success: false, error: 'Invalid message' });
    }
    
    // Check timestamp freshness
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (timestampMatch) {
      const timestamp = parseInt(timestampMatch[1]);
      const age = Date.now() - timestamp;
      if (age > 5 * 60 * 1000) {
        return res.status(400).json({ success: false, error: 'Message expired' });
      }
    }
    
    // Generate new key
    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    await db.createAgentKey(apiKey, wallet);
    
    res.json({ success: true, apiKey });
  } catch (err) {
    console.error('Error creating agent key:', err);
    res.status(500).json({ success: false, error: 'Failed to create key' });
  }
});

// GET /api/agent-keys - List keys for a wallet (requires auth)
app.get('/api/agent-keys', verifyAgentKey, async (req, res) => {
  try {
    const keys = await db.getAgentKeysByWallet(req.agentWallet);
    res.json({ success: true, keys });
  } catch (err) {
    console.error('Error fetching keys:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch keys' });
  }
});

// DELETE /api/agent-keys/:key - Revoke an API key
app.delete('/api/agent-keys/:key', verifyAgentKey, async (req, res) => {
  try {
    const revoked = await db.revokeAgentKey(req.params.key, req.agentWallet);
    
    if (!revoked) {
      return res.status(404).json({ success: false, error: 'Key not found or unauthorized' });
    }
    
    res.json({ success: true, message: 'Key revoked' });
  } catch (err) {
    console.error('Error revoking key:', err);
    res.status(500).json({ success: false, error: 'Failed to revoke key' });
  }
});

// ============================================
// API ROUTES - PURCHASES
// ============================================

// POST /api/purchases - Record a purchase
app.post('/api/purchases', async (req, res) => {
  try {
    const { buyerWallet, skillId, txSignature, pricePaid } = req.body;
    
    if (!buyerWallet || !skillId || !txSignature) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    const skill = await db.getSkillById(skillId);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    
    // Check for duplicate
    const existing = await db.getPurchase(buyerWallet, skillId);
    if (existing) {
      return res.status(400).json({ success: false, error: 'Already purchased' });
    }
    
    const purchase = {
      id: `purchase-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      buyerWallet,
      skillId,
      skillTitle: skill.title,
      creatorWallet: skill.wallet,
      txSignature,
      pricePaid: pricePaid || skill.price,
      purchasedAt: new Date().toISOString(),
      refunded: false,
    };
    
    await db.createPurchase(purchase);
    await db.updateSkillDownloads(skillId);
    
    res.status(201).json({ success: true, data: purchase });
  } catch (err) {
    console.error('Error creating purchase:', err);
    res.status(500).json({ success: false, error: 'Failed to create purchase' });
  }
});

// GET /api/my-skills - Get purchased skills (requires auth)
app.get('/api/my-skills', verifyAgentKey, async (req, res) => {
  try {
    const purchases = await db.getPurchasesByWallet(req.agentWallet);
    
    const mySkills = purchases.map(p => ({
      purchaseId: p.id,
      skillId: p.skillId,
      title: p.skillTitle,
      purchasedAt: p.purchasedAt,
      downloadUrl: `/api/skills/${p.skillId}/content`,
    }));
    
    res.json({ success: true, data: mySkills });
  } catch (err) {
    console.error('Error fetching purchases:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch purchases' });
  }
});

// GET /api/skills/:id/content - Download watermarked content
app.get('/api/skills/:id/content', verifyAgentKey, async (req, res) => {
  try {
    const skill = await db.getSkillById(req.params.id);
    if (!skill) {
      return res.status(404).json({ success: false, error: 'Skill not found' });
    }
    
    const purchase = await db.getPurchase(req.agentWallet, req.params.id);
    if (!purchase) {
      return res.status(403).json({ 
        success: false, 
        error: 'You do not own this skill',
        purchaseUrl: `/api/skills/${req.params.id}`
      });
    }
    
    // Watermark the content
    const watermarkedContent = watermark.watermarkSkill(skill.content, {
      wallet: req.agentWallet,
      skillId: skill.id,
      purchaseId: purchase.id,
      purchaseDate: purchase.purchasedAt,
    });
    
    res.type('text/markdown').send(watermarkedContent);
  } catch (err) {
    console.error('Error downloading content:', err);
    res.status(500).json({ success: false, error: 'Failed to download content' });
  }
});

// GET /api/purchases/verify/:wallet/:skillId - Check ownership
app.get('/api/purchases/verify/:wallet/:skillId', async (req, res) => {
  try {
    const owns = await db.walletOwnsSkill(req.params.wallet, req.params.skillId);
    res.json({ success: true, owns });
  } catch (err) {
    console.error('Error verifying ownership:', err);
    res.status(500).json({ success: false, error: 'Failed to verify' });
  }
});

// ============================================
// API ROUTES - WATERMARK VERIFICATION
// ============================================

// POST /api/verify-watermark - Verify a watermarked file
app.post('/api/verify-watermark', (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ success: false, error: 'No content provided' });
  }
  
  const result = watermark.verifyWatermark(content);
  res.json({ success: true, data: result });
});

// GET /verify/:fingerprint - Public verification page
app.get('/verify/:fingerprint', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'index.html'));
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// INITIALIZE AND START
// ============================================

async function start() {
  // Initialize database
  await db.init();
  
  // Seed default skills if empty
  await db.seedDefaultSkills(defaultSkills);
  
  // Start server
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         SKILLSTORE.MD SERVER              ║
╠═══════════════════════════════════════════╣
║  Local:    http://localhost:${PORT}          ║
║  API:      http://localhost:${PORT}/api/skills║
║  Index:    http://localhost:${PORT}/skills.json║
╚═══════════════════════════════════════════╝
    `);
  });
}

// Start if running directly
if (require.main === module) {
  start();
}

// Export for testing
module.exports = app;
