const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Services
const agentKeys = require('./src/services/agent-keys');
const watermark = require('./src/services/watermark');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.'));

// Data files
const PURCHASES_FILE = path.join(__dirname, 'data', 'purchases.json');

// Data file path
const DATA_FILE = path.join(__dirname, 'data', 'skills.json');

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Default skills
const defaultSkills = [
  {
    id: "default-1",
    title: "Kubernetes Security Reviews",
    creator: "@kube-warden",
    wallet: null,
    tags: "kubernetes, security, audit",
    price: 2.4,
    description: "Cluster hardening, CIS benchmarks, incident response playbooks.",
    content: "# Kubernetes Security Reviews\n\nThis skill covers...",
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
    content: "# Prediction Market Research\n\nThis skill covers...",
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
    content: "# OpenClaw Workflow Automation\n\nThis skill covers...",
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
    content: "# LLM Red Teaming\n\nThis skill covers...",
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
    content: "# Web Scraping Pipelines\n\nThis skill covers...",
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
    content: "# Solana DeFi Integration\n\nThis skill covers...",
    downloads: 445,
    createdAt: "2025-12-25T00:00:00.000Z"
  }
];

// Load skills from file or use defaults
function loadSkills() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading skills:', err);
  }
  return defaultSkills;
}

// Save skills to file
function saveSkills(skills) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(skills, null, 2));
  } catch (err) {
    console.error('Error saving skills:', err);
  }
}

// Initialize skills
let skills = loadSkills();

// Load purchases from file
function loadPurchases() {
  try {
    if (fs.existsSync(PURCHASES_FILE)) {
      const data = fs.readFileSync(PURCHASES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading purchases:', err);
  }
  return [];
}

// Save purchases to file
function savePurchases(purchases) {
  try {
    fs.writeFileSync(PURCHASES_FILE, JSON.stringify(purchases, null, 2));
  } catch (err) {
    console.error('Error saving purchases:', err);
  }
}

// Initialize purchases
let purchases = loadPurchases();

// Middleware to verify agent API key
function verifyAgentKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing API key' });
  }
  
  const apiKey = authHeader.slice(7);
  const wallet = agentKeys.verifyAgentKey(apiKey);
  
  if (!wallet) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  
  req.agentWallet = wallet;
  next();
}

// Check if wallet owns a skill
function walletOwnsSkill(wallet, skillId) {
  return purchases.some(p => 
    p.buyerWallet === wallet && 
    p.skillId === skillId &&
    !p.refunded
  );
}

// API Routes

// GET /api/skills - Get all skills
app.get('/api/skills', (req, res) => {
  res.json({
    success: true,
    data: skills,
    stats: {
      total: skills.length,
      creators: new Set(skills.map(s => s.creator)).size,
      downloads: skills.reduce((sum, s) => sum + (s.downloads || 0), 0)
    }
  });
});

// GET /api/skills/:id - Get single skill
app.get('/api/skills/:id', (req, res) => {
  const skill = skills.find(s => s.id === req.params.id);
  if (!skill) {
    return res.status(404).json({ success: false, error: 'Skill not found' });
  }
  res.json({ success: true, data: skill });
});

// POST /api/skills - Create new skill
app.post('/api/skills', (req, res) => {
  const { title, creator, wallet, tags, price, description, content } = req.body;
  
  // Validation
  if (!title || !creator || !tags || !price || !content) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: title, creator, tags, price, content' 
    });
  }
  
  const newSkill = {
    id: `skill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  
  skills.unshift(newSkill);
  saveSkills(skills);
  
  res.status(201).json({ success: true, data: newSkill });
});

// POST /api/skills/:id/download - Increment download count
app.post('/api/skills/:id/download', (req, res) => {
  const skill = skills.find(s => s.id === req.params.id);
  if (!skill) {
    return res.status(404).json({ success: false, error: 'Skill not found' });
  }
  
  skill.downloads = (skill.downloads || 0) + 1;
  saveSkills(skills);
  
  res.json({ success: true, data: skill });
});

// GET /skills.json - Agent-friendly endpoint
app.get('/skills.json', (req, res) => {
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
});

// GET /skills.md - Markdown version for agents
app.get('/skills.md', (req, res) => {
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
});

// ============================================================================
// AGENT API KEY ENDPOINTS
// ============================================================================

// POST /api/agent-keys - Generate new agent API key
app.post('/api/agent-keys', (req, res) => {
  const { wallet, message, signature } = req.body;
  
  if (!wallet || !message || !signature) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields: wallet, message, signature' 
    });
  }
  
  try {
    const apiKey = agentKeys.createAgentKey(wallet, message, signature);
    res.json({ success: true, apiKey });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/agent-keys - List keys for a wallet (requires auth)
app.get('/api/agent-keys', verifyAgentKey, (req, res) => {
  const keys = agentKeys.getWalletKeys(req.agentWallet);
  res.json({ success: true, keys });
});

// DELETE /api/agent-keys/:key - Revoke an API key
app.delete('/api/agent-keys/:key', verifyAgentKey, (req, res) => {
  const revoked = agentKeys.revokeAgentKey(req.params.key, req.agentWallet);
  
  if (!revoked) {
    return res.status(404).json({ success: false, error: 'Key not found or unauthorized' });
  }
  
  res.json({ success: true, message: 'Key revoked' });
});

// ============================================================================
// PURCHASE ENDPOINTS
// ============================================================================

// POST /api/purchases - Record a purchase (called after on-chain payment)
app.post('/api/purchases', (req, res) => {
  const { buyerWallet, skillId, txSignature, pricePaid } = req.body;
  
  if (!buyerWallet || !skillId || !txSignature) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields' 
    });
  }
  
  // Check skill exists
  const skill = skills.find(s => s.id === skillId);
  if (!skill) {
    return res.status(404).json({ success: false, error: 'Skill not found' });
  }
  
  // Check for duplicate purchase
  if (walletOwnsSkill(buyerWallet, skillId)) {
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
  
  purchases.push(purchase);
  savePurchases(purchases);
  
  // Increment download count
  skill.downloads = (skill.downloads || 0) + 1;
  saveSkills(skills);
  
  res.status(201).json({ success: true, data: purchase });
});

// GET /api/my-skills - Get purchased skills for wallet (requires auth)
app.get('/api/my-skills', verifyAgentKey, (req, res) => {
  const myPurchases = purchases.filter(p => 
    p.buyerWallet === req.agentWallet && !p.refunded
  );
  
  const mySkills = myPurchases.map(p => {
    const skill = skills.find(s => s.id === p.skillId);
    return {
      purchaseId: p.id,
      skillId: p.skillId,
      title: p.skillTitle,
      purchasedAt: p.purchasedAt,
      downloadUrl: `/api/skills/${p.skillId}/content`,
    };
  });
  
  res.json({ success: true, data: mySkills });
});

// GET /api/skills/:id/content - Download watermarked skill content
app.get('/api/skills/:id/content', verifyAgentKey, (req, res) => {
  const skill = skills.find(s => s.id === req.params.id);
  
  if (!skill) {
    return res.status(404).json({ success: false, error: 'Skill not found' });
  }
  
  // Check ownership
  const purchase = purchases.find(p => 
    p.buyerWallet === req.agentWallet && 
    p.skillId === req.params.id &&
    !p.refunded
  );
  
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
});

// GET /api/purchases/verify/:wallet/:skillId - Check if wallet owns skill
app.get('/api/purchases/verify/:wallet/:skillId', (req, res) => {
  const owns = walletOwnsSkill(req.params.wallet, req.params.skillId);
  res.json({ success: true, owns });
});

// ============================================================================
// WATERMARK VERIFICATION
// ============================================================================

// POST /api/verify-watermark - Verify a watermarked file
app.post('/api/verify-watermark', (req, res) => {
  const { content } = req.body;
  
  if (!content) {
    return res.status(400).json({ success: false, error: 'No content provided' });
  }
  
  const result = watermark.verifyWatermark(content);
  
  // If we found a license ID, look up the purchase
  if (result.licenseId) {
    const purchase = purchases.find(p => p.id === result.licenseId);
    if (purchase) {
      result.purchaseInfo = {
        skillId: purchase.skillId,
        purchasedAt: purchase.purchasedAt,
        isValid: !purchase.refunded,
      };
    }
  }
  
  res.json({ success: true, data: result });
});

// GET /verify/:fingerprint - Public verification page
app.get('/verify/:fingerprint', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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


