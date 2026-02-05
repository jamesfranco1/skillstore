/**
 * API Client
 * Handles all communication with the backend
 */

const API = {
  baseUrl: window.location.origin,

  /**
   * Fetch all skills
   */
  async getSkills() {
    const res = await fetch(`${this.baseUrl}/api/skills`);
    if (!res.ok) throw new Error('Failed to fetch skills');
    return res.json();
  },

  /**
   * Fetch single skill by ID
   */
  async getSkill(id) {
    const res = await fetch(`${this.baseUrl}/api/skills/${id}`);
    if (!res.ok) throw new Error('Skill not found');
    return res.json();
  },

  /**
   * Create a new skill
   */
  async createSkill(skillData) {
    const res = await fetch(`${this.baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skillData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create skill');
    }
    return res.json();
  },

  /**
   * Record a purchase
   */
  async createPurchase(purchaseData) {
    const res = await fetch(`${this.baseUrl}/api/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(purchaseData)
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to record purchase');
    }
    return res.json();
  },

  /**
   * Get purchases for a wallet
   */
  async getPurchases(wallet) {
    const res = await fetch(`${this.baseUrl}/api/purchases?wallet=${wallet}`);
    if (!res.ok) throw new Error('Failed to fetch purchases');
    return res.json();
  },

  /**
   * Check if wallet owns a skill
   */
  async checkOwnership(wallet, skillId) {
    const res = await fetch(`${this.baseUrl}/api/purchases/check?wallet=${wallet}&skillId=${skillId}`);
    if (!res.ok) return { owns: false };
    return res.json();
  },

  /**
   * Get skill content (for owners)
   */
  async getSkillContent(skillId, wallet) {
    const res = await fetch(`${this.baseUrl}/api/skills/${skillId}/content?wallet=${wallet}`);
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Access denied');
    }
    return res.text();
  },

  /**
   * Verify a transaction on-chain
   */
  async verifyTransaction(signature) {
    const res = await fetch(`${this.baseUrl}/api/verify-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signature })
    });
    if (!res.ok) throw new Error('Transaction verification failed');
    return res.json();
  }
};

window.API = API;

