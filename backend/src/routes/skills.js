/**
 * Skills Routes
 */

const express = require('express');
const db = require('../db');

const router = express.Router();

/**
 * GET /api/skills
 * List skills with optional search/filter
 * 
 * Query params:
 *   q        - Search query (searches title, description, tags, creator)
 *   tag      - Filter by tag/category
 *   category - Alias for tag
 *   sort     - Sort order: newest, popular, price-low, price-high
 *   minPrice - Minimum price
 *   maxPrice - Maximum price
 *   limit    - Number of results (default: 50)
 *   offset   - Pagination offset
 */
router.get('/', async (req, res) => {
  try {
    const { 
      q, 
      tag, 
      category, 
      sort = 'newest', 
      minPrice, 
      maxPrice,
      limit = 50,
      offset = 0 
    } = req.query;

    let skills = await db.getSkills();
    
    // Search
    if (q) {
      const query = q.toLowerCase();
      skills = skills.filter(skill => {
        const searchable = `${skill.title} ${skill.description} ${skill.tags} ${skill.creator}`.toLowerCase();
        return searchable.includes(query);
      });
    }

    // Tag/category filter
    const tagFilter = tag || category;
    if (tagFilter) {
      const filterLower = tagFilter.toLowerCase();
      skills = skills.filter(skill => {
        const tags = (skill.tags || '').toLowerCase();
        return tags.includes(filterLower);
      });
    }

    // Price filter
    if (minPrice !== undefined) {
      skills = skills.filter(skill => skill.price >= parseFloat(minPrice));
    }
    if (maxPrice !== undefined) {
      skills = skills.filter(skill => skill.price <= parseFloat(maxPrice));
    }

    // Sort
    switch (sort) {
      case 'popular':
        skills.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        break;
      case 'price-low':
        skills.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        skills.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
      default:
        skills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Get total before pagination
    const total = skills.length;

    // Pagination
    const limitNum = Math.min(parseInt(limit) || 50, 100);
    const offsetNum = parseInt(offset) || 0;
    skills = skills.slice(offsetNum, offsetNum + limitNum);

    // Stats
    const stats = await db.getStats();
    stats.totalDownloads = await db.getTotalDownloads();

    res.json({ 
      skills,
      total,
      limit: limitNum,
      offset: offsetNum,
      stats
    });
  } catch (err) {
    console.error('Error fetching skills:', err);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

/**
 * GET /api/search
 * Dedicated search endpoint for agents
 * 
 * Query params:
 *   q - Search query (required)
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const skills = await db.searchSkills(q);

    res.json({
      query: q,
      count: skills.length,
      results: skills.map(s => ({
        id: s.id,
        title: s.title,
        creator: s.creator,
        tags: s.tags ? s.tags.split(',').map(t => t.trim()) : [],
        price_sol: s.price,
        description: s.description,
        downloads: s.downloads,
        relevance: s.relevance // If using weighted search
      }))
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * GET /api/skills/:id
 * Get single skill metadata
 */
router.get('/:id', async (req, res) => {
  try {
    const skill = await db.getSkillById(req.params.id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    // Don't include content
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

    const owns = await db.checkOwnership(wallet, req.params.id);
    
    if (!owns) {
      return res.status(403).json({ error: 'You do not own this skill' });
    }

    await db.incrementDownloads(req.params.id);
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

    if (!title || !creator || !content) {
      return res.status(400).json({ 
        error: 'Missing required fields: title, creator, content' 
      });
    }

    const skill = await db.createSkill({
      title,
      creator,
      creatorWallet: creatorWallet || null,
      tags: tags || '',
      price: parseFloat(price) || 0,
      description: description || '',
      content
    });

    res.status(201).json(skill);
  } catch (err) {
    console.error('Error creating skill:', err);
    res.status(500).json({ error: 'Failed to create skill' });
  }
});

module.exports = router;
