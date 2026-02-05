/**
 * Skills Routes
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/skills
 * List all skills with stats
 */
router.get('/', async (req, res) => {
  try {
    const skills = await db.getSkills();
    const stats = await db.getStats();
    
    res.json({ skills, stats });
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

/**
 * GET /api/skills/:id
 * Get single skill (without content)
 */
router.get('/:id', async (req, res) => {
  try {
    const skill = await db.getSkillById(req.params.id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Don't include content in public response
    const { content, ...publicSkill } = skill;
    res.json(publicSkill);
  } catch (err) {
    console.error('Error fetching skill:', err);
    res.status(500).json({ error: 'Failed to fetch skill' });
  }
});

/**
 * GET /api/skills/:id/content
 * Get skill content (requires ownership)
 */
router.get('/:id/content', async (req, res) => {
  try {
    const { wallet } = req.query;
    
    if (!wallet) {
      return res.status(400).json({ error: 'Wallet address required' });
    }

    const skill = await db.getSkillById(req.params.id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Check ownership
    const owns = await db.checkOwnership(wallet, req.params.id);
    
    if (!owns) {
      return res.status(403).json({ error: 'You do not own this skill' });
    }

    // Increment download count
    await db.incrementDownloads(req.params.id);

    // Return content as markdown
    res.type('text/markdown').send(skill.content);
  } catch (err) {
    console.error('Error fetching content:', err);
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

/**
 * POST /api/skills
 * Create new skill
 */
router.post('/', async (req, res) => {
  try {
    const { title, creator, creatorWallet, tags, price, description, content } = req.body;

    // Validation
    if (!title || !creator || !price || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, creator, price, content' 
      });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'Price must be positive' });
    }

    const skill = await db.createSkill({
      title,
      creator,
      creatorWallet: creatorWallet || null,
      tags: tags || '',
      price: parseFloat(price),
      description: description || '',
      content
    });

    res.status(201).json(skill);
  } catch (err) {
    console.error('Error creating skill:', err);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

/**
 * GET /api/skills.json
 * Agent-friendly JSON endpoint
 */
router.get('.json', async (req, res) => {
  try {
    const skills = await db.getSkills();
    
    const agentFormat = skills.map(s => ({
      id: s.id,
      title: s.title,
      creator: s.creator,
      tags: s.tags ? s.tags.split(',').map(t => t.trim()) : [],
      price_sol: s.price,
      description: s.description,
      downloads: s.downloads,
      endpoint: `/api/skills/${s.id}`
    }));

    res.json({
      name: 'skillstore.md',
      version: '1.0.0',
      updated: new Date().toISOString(),
      skills: agentFormat
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

/**
 * GET /api/skills.md
 * Agent-friendly Markdown endpoint
 */
router.get('.md', async (req, res) => {
  try {
    const skills = await db.getSkills();
    
    let md = `# skillstore.md - Skill Directory\n\n`;
    md += `Updated: ${new Date().toISOString()}\n\n`;
    md += `## Available Skills\n\n`;

    for (const skill of skills) {
      md += `### ${skill.title}\n`;
      md += `- **Creator:** ${skill.creator}\n`;
      md += `- **Price:** ${skill.price} SOL\n`;
      md += `- **Tags:** ${skill.tags}\n`;
      md += `- **Description:** ${skill.description}\n`;
      md += `- **Endpoint:** \`/api/skills/${skill.id}\`\n\n`;
    }

    res.type('text/markdown').send(md);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).send('Failed to generate markdown');
  }
});

module.exports = router;

