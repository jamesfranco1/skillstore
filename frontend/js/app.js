/**
 * Main Application
 */

const App = {
  skills: [],
  purchases: [],
  currentSkill: null,

  /**
   * Initialize the application
   */
  async init() {
    // Setup wallet callbacks
    Wallet.onConnect = (address) => this.onWalletConnect(address);
    Wallet.onDisconnect = () => this.onWalletDisconnect();
    Wallet.onAccountChange = (address) => this.onWalletConnect(address);

    // Setup event listeners
    this.setupEventListeners();

    // Check for existing wallet connection
    await Wallet.checkConnection();

    // Load skills
    await this.loadSkills();
  },

  /**
   * Setup DOM event listeners
   */
  setupEventListeners() {
    // Wallet button
    document.getElementById('walletBtn').addEventListener('click', () => {
      if (Wallet.address) {
        Wallet.disconnect();
      } else {
        Wallet.connect();
      }
    });

    // Upload connect button
    document.getElementById('uploadConnectBtn').addEventListener('click', () => {
      Wallet.connect();
    });

    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterSkills(e.target.value);
    });

    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });

    // Modal close
    document.getElementById('modalClose').addEventListener('click', () => {
      this.closeModal();
    });

    // Modal backdrop click
    document.querySelector('.modal-backdrop').addEventListener('click', () => {
      this.closeModal();
    });

    // Purchase button
    document.getElementById('modalPurchaseBtn').addEventListener('click', () => {
      this.handlePurchase();
    });

    // Download button
    document.getElementById('modalDownloadBtn').addEventListener('click', () => {
      this.handleDownload();
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  },

  /**
   * Handle wallet connect
   */
  async onWalletConnect(address) {
    // Update wallet button
    const walletBtn = document.getElementById('walletBtn');
    walletBtn.classList.add('connected');
    walletBtn.querySelector('.wallet-text').textContent = Wallet.shortenAddress(address);

    // Show auth-required elements
    document.querySelectorAll('[data-auth]').forEach(el => {
      el.hidden = false;
    });

    // Show upload form, hide notice
    document.getElementById('uploadNotice').hidden = true;
    document.getElementById('uploadFormContainer').hidden = false;

    // Load purchases
    await this.loadPurchases();

    // Re-render skills to show owned badges
    this.renderSkills(this.skills);
  },

  /**
   * Handle wallet disconnect
   */
  onWalletDisconnect() {
    // Update wallet button
    const walletBtn = document.getElementById('walletBtn');
    walletBtn.classList.remove('connected');
    walletBtn.querySelector('.wallet-text').textContent = 'Connect Wallet';

    // Hide auth-required elements
    document.querySelectorAll('[data-auth]').forEach(el => {
      el.hidden = true;
    });

    // Hide upload form, show notice
    document.getElementById('uploadNotice').hidden = false;
    document.getElementById('uploadFormContainer').hidden = true;

    // Clear purchases
    this.purchases = [];
    this.renderSkills(this.skills);
  },

  /**
   * Load skills from API
   */
  async loadSkills() {
    try {
      const data = await API.getSkills();
      this.skills = data.skills;
      this.renderSkills(this.skills);
      this.updateStats(data.stats);
    } catch (err) {
      console.error('Failed to load skills:', err);
      document.getElementById('skillsGrid').innerHTML = 
        '<div class="loading">Failed to load skills</div>';
    }
  },

  /**
   * Load purchases for connected wallet
   */
  async loadPurchases() {
    if (!Wallet.address) return;

    try {
      const data = await API.getPurchases(Wallet.address);
      this.purchases = data.purchases;
      this.renderMySkills();
    } catch (err) {
      console.error('Failed to load purchases:', err);
    }
  },

  /**
   * Render skills grid
   */
  renderSkills(skills) {
    const grid = document.getElementById('skillsGrid');

    if (!skills.length) {
      grid.innerHTML = '<div class="loading">No skills found</div>';
      return;
    }

    grid.innerHTML = skills.map(skill => {
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      return `
        <article class="skill-card ${isOwned ? 'owned' : ''}" data-id="${skill.id}">
          <div class="skill-header">
            <span class="skill-tag">${this.getFirstTag(skill.tags)}</span>
            <span class="skill-price">${skill.price} SOL</span>
          </div>
          <h3>${this.escapeHtml(skill.title)}</h3>
          <p>${this.escapeHtml(skill.description || 'No description')}</p>
          <div class="skill-footer">
            <span class="skill-creator">${this.escapeHtml(skill.creator)}</span>
            <button class="btn btn-secondary">${isOwned ? 'View' : 'Details'}</button>
          </div>
        </article>
      `;
    }).join('');

    // Add click handlers
    grid.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('click', () => {
        const skillId = card.dataset.id;
        this.openSkillModal(skillId);
      });
    });
  },

  /**
   * Render my skills (purchases)
   */
  renderMySkills() {
    const grid = document.getElementById('mySkillsGrid');

    if (!this.purchases.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No purchases yet</p>
          <a href="#directory" class="btn">Browse Directory</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.purchases.map(purchase => {
      const skill = this.skills.find(s => s.id === purchase.skillId);
      return `
        <article class="skill-card owned" data-id="${purchase.skillId}">
          <div class="skill-header">
            <span class="skill-tag">${skill ? this.getFirstTag(skill.tags) : 'skill'}</span>
            <span class="skill-price">Owned</span>
          </div>
          <h3>${this.escapeHtml(purchase.skillTitle)}</h3>
          <div class="skill-footer">
            <span class="skill-creator">Purchased ${new Date(purchase.purchasedAt).toLocaleDateString()}</span>
            <button class="btn btn-success" onclick="App.downloadSkill('${purchase.skillId}')">Download</button>
          </div>
        </article>
      `;
    }).join('');
  },

  /**
   * Update stats display
   */
  updateStats(stats) {
    document.getElementById('statSkills').textContent = stats.totalSkills || 0;
    document.getElementById('statCreators').textContent = stats.totalCreators || 0;
    document.getElementById('statSales').textContent = stats.totalSales || 0;
  },

  /**
   * Filter skills by search query
   */
  filterSkills(query) {
    const q = query.toLowerCase().trim();
    
    if (!q) {
      this.renderSkills(this.skills);
      return;
    }

    const filtered = this.skills.filter(skill => {
      const searchable = `${skill.title} ${skill.description} ${skill.creator} ${skill.tags}`.toLowerCase();
      return searchable.includes(q);
    });

    this.renderSkills(filtered);
  },

  /**
   * Open skill detail modal
   */
  openSkillModal(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    this.currentSkill = skill;
    const isOwned = this.purchases.some(p => p.skillId === skillId);

    // Populate modal
    document.getElementById('modalTag').textContent = this.getFirstTag(skill.tags);
    document.getElementById('modalPrice').textContent = `${skill.price} SOL`;
    document.getElementById('modalTitle').textContent = skill.title;
    document.getElementById('modalDesc').textContent = skill.description || 'No description provided.';
    document.getElementById('modalCreator').textContent = skill.creator;
    document.getElementById('modalDownloads').textContent = skill.downloads || 0;

    // Show/hide buttons
    const purchaseBtn = document.getElementById('modalPurchaseBtn');
    const downloadBtn = document.getElementById('modalDownloadBtn');
    const statusEl = document.getElementById('modalStatus');

    if (isOwned) {
      purchaseBtn.hidden = true;
      downloadBtn.hidden = false;
    } else {
      purchaseBtn.hidden = false;
      downloadBtn.hidden = true;
      purchaseBtn.textContent = Wallet.address ? 'Purchase' : 'Connect Wallet';
    }

    statusEl.hidden = true;
    document.getElementById('skillModal').hidden = false;
  },

  /**
   * Close modal
   */
  closeModal() {
    document.getElementById('skillModal').hidden = true;
    this.currentSkill = null;
  },

  /**
   * Handle purchase
   */
  async handlePurchase() {
    if (!this.currentSkill) return;

    // Connect wallet if not connected
    if (!Wallet.address) {
      await Wallet.connect();
      return;
    }

    const statusEl = document.getElementById('modalStatus');
    const purchaseBtn = document.getElementById('modalPurchaseBtn');
    
    statusEl.hidden = false;
    statusEl.className = 'modal-status loading';
    statusEl.textContent = 'Creating transaction...';
    purchaseBtn.disabled = true;

    try {
      // Check if creator has a wallet set
      if (!this.currentSkill.creatorWallet) {
        throw new Error('Creator has not set a payment wallet');
      }

      // Execute Solana transaction
      statusEl.textContent = 'Confirm in Phantom...';
      const signature = await Solana.executePurchase(
        this.currentSkill.creatorWallet,
        this.currentSkill.price
      );

      // Record purchase in backend
      statusEl.textContent = 'Recording purchase...';
      await API.createPurchase({
        buyerWallet: Wallet.address,
        skillId: this.currentSkill.id,
        txSignature: signature,
        pricePaid: this.currentSkill.price
      });

      // Success
      statusEl.className = 'modal-status success';
      statusEl.textContent = 'Purchase successful!';

      // Update UI
      this.purchases.push({
        skillId: this.currentSkill.id,
        skillTitle: this.currentSkill.title,
        purchasedAt: new Date().toISOString()
      });

      document.getElementById('modalPurchaseBtn').hidden = true;
      document.getElementById('modalDownloadBtn').hidden = false;

      this.renderSkills(this.skills);
      this.renderMySkills();
      this.loadSkills(); // Refresh download count

    } catch (err) {
      console.error('Purchase failed:', err);
      statusEl.className = 'modal-status error';
      statusEl.textContent = err.message || 'Purchase failed';
    }

    purchaseBtn.disabled = false;
  },

  /**
   * Handle download
   */
  async handleDownload() {
    if (!this.currentSkill) return;
    await this.downloadSkill(this.currentSkill.id);
  },

  /**
   * Download a skill
   */
  async downloadSkill(skillId) {
    if (!Wallet.address) {
      await Wallet.connect();
      return;
    }

    try {
      const content = await API.getSkillContent(skillId, Wallet.address);
      const skill = this.skills.find(s => s.id === skillId);
      const filename = `${skill?.title || 'skill'}.md`.toLowerCase().replace(/\s+/g, '-');

      // Create download
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Download failed:', err);
      alert(err.message || 'Download failed');
    }
  },

  /**
   * Handle skill upload
   */
  async handleUpload() {
    if (!Wallet.address) return;

    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    try {
      const skillData = {
        title: document.getElementById('skillTitle').value.trim(),
        price: parseFloat(document.getElementById('skillPrice').value),
        tags: document.getElementById('skillTags').value.trim(),
        description: document.getElementById('skillDesc').value.trim(),
        content: document.getElementById('skillContent').value,
        creator: Wallet.shortenAddress(),
        creatorWallet: Wallet.address
      };

      await API.createSkill(skillData);

      // Reset form
      document.getElementById('uploadForm').reset();

      // Reload skills
      await this.loadSkills();

      alert('Skill uploaded successfully!');

    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'Upload failed');
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Skill';
  },

  /**
   * Helper: Get first tag from comma-separated list
   */
  getFirstTag(tags) {
    if (!tags) return 'skill';
    return tags.split(',')[0].trim();
  },

  /**
   * Helper: Escape HTML
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Export for console debugging
window.App = App;

