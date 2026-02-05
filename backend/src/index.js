/**
 * Skillstore Backend
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./db');
const skillsRouter = require('./routes/skills');
const purchasesRouter = require('./routes/purchases');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

// API Routes
app.use('/api/skills', skillsRouter);
app.use('/api/purchases', purchasesRouter);

// Agent-friendly endpoints at root level
app.get('/api/skills.json', async (req, res) => {
  try {
    const skills = await db.getSkills();
    const stats = await db.getStats();
    
    res.json({
      name: 'skillstore.md',
      description: 'Skill marketplace for AI agents',
      version: '1.0.0',
      updated: new Date().toISOString(),
      endpoints: {
        list: '/api/skills',
        search: '/api/skills?q={query}',
        details: '/api/skills/{id}',
        purchase: 'POST /api/purchases'
      },
      stats: {
        total_skills: stats.totalSkills,
        total_creators: stats.totalCreators,
        total_sales: stats.totalSales
      },
      skills: skills.map(s => ({
        id: s.id,
        title: s.title,
        creator: s.creator,
        creator_wallet: s.creatorWallet,
        tags: s.tags ? s.tags.split(',').map(t => t.trim()) : [],
        price_sol: s.price,
        description: s.description,
        downloads: s.downloads || 0,
        created_at: s.createdAt
      }))
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to generate index' });
  }
});

app.get('/api/skills.md', async (req, res) => {
  try {
    const skills = await db.getSkills();
    const stats = await db.getStats();
    
    let md = `# skillstore.md\n\n`;
    md += `> Skill marketplace for AI agents\n\n`;
    md += `**${stats.totalSkills}** skills | **${stats.totalCreators}** creators | **${stats.totalSales}** sales\n\n`;
    md += `## API\n\n`;
    md += `- List: \`GET /api/skills\`\n`;
    md += `- Search: \`GET /api/skills?q={query}&tag={tag}&sort={sort}\`\n`;
    md += `- Details: \`GET /api/skills/{id}\`\n`;
    md += `- Purchase: \`POST /api/purchases\`\n\n`;
    md += `## Skills\n\n`;

    for (const skill of skills) {
      md += `### ${skill.title}\n\n`;
      md += `- **ID:** \`${skill.id}\`\n`;
      md += `- **Creator:** ${skill.creator}\n`;
      md += `- **Price:** ${skill.price === 0 ? 'Free' : skill.price + ' SOL'}\n`;
      md += `- **Tags:** ${skill.tags || 'none'}\n`;
      md += `- **Downloads:** ${skill.downloads || 0}\n`;
      if (skill.description) {
        md += `- **Description:** ${skill.description}\n`;
      }
      md += `\n`;
    }

    res.type('text/markdown').send(md);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Failed to generate markdown');
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve frontend for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// Start server
async function start() {
  try {
    // Initialize database
    await db.init();
    await db.seed();

    app.listen(PORT, () => {
      console.log(`
┌─────────────────────────────────────┐
│         SKILLSTORE.MD               │
├─────────────────────────────────────┤
│  Server:  http://localhost:${PORT}      │
│  API:     http://localhost:${PORT}/api  │
└─────────────────────────────────────┘
      `);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;

