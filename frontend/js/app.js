/**
 * Skillstore Application
 */

const App = {
  // State
  skills: [],
  filteredSkills: [],
  purchases: [],
  currentSkill: null,
  
  // Filter state
  filters: {
    query: '',
    category: '',
    sort: 'newest',
    price: ''
  },

  /**
   * Initialize
   */
  async init() {
    // Wallet callbacks
    Wallet.onConnect = (address) => this.onWalletConnect(address);
    Wallet.onDisconnect = () => this.onWalletDisconnect();
    Wallet.onAccountChange = (address) => this.onWalletConnect(address);

    // Event listeners
    this.setupEventListeners();

    // Check wallet
    await Wallet.checkConnection();

    // Load skills
    await this.loadSkills();
  },

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Wallet
    document.getElementById('walletBtn').addEventListener('click', () => {
      Wallet.address ? Wallet.disconnect() : Wallet.connect();
    });

    document.getElementById('uploadConnectBtn').addEventListener('click', () => {
      Wallet.connect();
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.filters.query = e.target.value;
      this.applyFilters();
    });

    // Keyboard shortcut for search
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
      }
      if (e.key === 'Escape') {
        searchInput.blur();
        this.closeModal();
      }
    });

    // Filters
    document.getElementById('categoryFilter').addEventListener('change', (e) => {
      this.filters.category = e.target.value;
      this.applyFilters();
    });

    document.getElementById('sortFilter').addEventListener('change', (e) => {
      this.filters.sort = e.target.value;
      this.applyFilters();
    });

    document.getElementById('priceFilter').addEventListener('change', (e) => {
      this.filters.price = e.target.value;
      this.applyFilters();
    });

    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
    document.getElementById('modalPurchaseBtn').addEventListener('click', () => this.handlePurchase());
    document.getElementById('modalDownloadBtn').addEventListener('click', () => this.handleDownload());
  },

  /**
   * Wallet connected
   */
  async onWalletConnect(address) {
    const walletBtn = document.getElementById('walletBtn');
    walletBtn.classList.add('connected');
    walletBtn.querySelector('.wallet-text').textContent = Wallet.shortenAddress(address);

    document.querySelectorAll('[data-auth]').forEach(el => el.hidden = false);
    document.getElementById('uploadNotice').hidden = true;
    document.getElementById('uploadFormContainer').hidden = false;

    await this.loadPurchases();
    this.renderSkills();
  },

  /**
   * Wallet disconnected
   */
  onWalletDisconnect() {
    const walletBtn = document.getElementById('walletBtn');
    walletBtn.classList.remove('connected');
    walletBtn.querySelector('.wallet-text').textContent = 'Connect Wallet';

    document.querySelectorAll('[data-auth]').forEach(el => el.hidden = true);
    document.getElementById('uploadNotice').hidden = false;
    document.getElementById('uploadFormContainer').hidden = true;

    this.purchases = [];
    this.renderSkills();
  },

  /**
   * Load skills
   */
  async loadSkills() {
    try {
      const data = await API.getSkills();
      this.skills = data.skills || [];
      this.applyFilters();
      this.updateStats(data.stats);
    } catch (err) {
      console.error('Failed to load skills:', err);
      document.getElementById('skillsGrid').innerHTML = 
        '<div class="loading">Failed to load skills. Please try again.</div>';
    }
  },

  /**
   * Load purchases
   */
  async loadPurchases() {
    if (!Wallet.address) return;
    try {
      const data = await API.getPurchases(Wallet.address);
      this.purchases = data.purchases || [];
      this.renderMySkills();
    } catch (err) {
      console.error('Failed to load purchases:', err);
    }
  },

  /**
   * Apply filters and sort
   */
  applyFilters() {
    let filtered = [...this.skills];
    const { query, category, sort, price } = this.filters;

    // Search query
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(skill => {
        const searchText = `${skill.title} ${skill.description} ${skill.creator} ${skill.tags}`.toLowerCase();
        return searchText.includes(q);
      });
    }

    // Category filter
    if (category) {
      filtered = filtered.filter(skill => {
        const tags = (skill.tags || '').toLowerCase();
        return tags.includes(category.toLowerCase());
      });
    }

    // Price filter
    if (price) {
      filtered = filtered.filter(skill => {
        const p = skill.price;
        switch (price) {
          case 'free': return p === 0;
          case 'under-1': return p > 0 && p < 1;
          case '1-5': return p >= 1 && p <= 5;
          case 'over-5': return p > 5;
          default: return true;
        }
      });
    }

    // Sort
    switch (sort) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
      case 'popular':
        filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        break;
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
    }

    this.filteredSkills = filtered;
    this.renderSkills();
    this.renderActiveFilters();
  },

  /**
   * Render skills grid
   */
  renderSkills() {
    const grid = document.getElementById('skillsGrid');
    const skills = this.filteredSkills;

    // Update count
    document.getElementById('resultsCount').textContent = skills.length;

    if (!skills.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No skills match your search</p>
          <button class="btn btn-secondary" onclick="App.clearFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = skills.map(skill => {
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      const tags = (skill.tags || '').split(',').slice(0, 2);
      const category = tags[0]?.trim() || 'skill';
      
      return `
        <article class="skill-card ${isOwned ? 'owned' : ''}" data-id="${skill.id}">
          <div class="skill-header">
            <div class="skill-tags">
              <span class="skill-tag category">${this.escapeHtml(category)}</span>
              ${tags[1] ? `<span class="skill-tag">${this.escapeHtml(tags[1].trim())}</span>` : ''}
            </div>
            <span class="skill-price">${skill.price === 0 ? 'Free' : skill.price + ' SOL'}</span>
          </div>
          <h3>${this.escapeHtml(skill.title)}</h3>
          <p>${this.escapeHtml(skill.description || 'No description')}</p>
          <div class="skill-footer">
            <span class="skill-creator">${this.escapeHtml(skill.creator)}</span>
            <span class="skill-downloads">${skill.downloads || 0} downloads</span>
          </div>
        </article>
      `;
    }).join('');

    // Click handlers
    grid.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('click', () => this.openSkillModal(card.dataset.id));
    });
  },

  /**
   * Render active filter tags
   */
  renderActiveFilters() {
    const container = document.getElementById('activeFilters');
    const tags = [];

    if (this.filters.query) {
      tags.push({ label: `"${this.filters.query}"`, clear: () => {
        this.filters.query = '';
        document.getElementById('searchInput').value = '';
        this.applyFilters();
      }});
    }

    if (this.filters.category) {
      tags.push({ label: this.filters.category, clear: () => {
        this.filters.category = '';
        document.getElementById('categoryFilter').value = '';
        this.applyFilters();
      }});
    }

    if (this.filters.price) {
      const labels = { 'free': 'Free', 'under-1': '<1 SOL', '1-5': '1-5 SOL', 'over-5': '>5 SOL' };
      tags.push({ label: labels[this.filters.price], clear: () => {
        this.filters.price = '';
        document.getElementById('priceFilter').value = '';
        this.applyFilters();
      }});
    }

    container.innerHTML = tags.map((tag, i) => `
      <span class="filter-tag">
        ${tag.label}
        <button onclick="App.clearFilter(${i})">&times;</button>
      </span>
    `).join('');

    // Store clear functions
    this._filterClears = tags.map(t => t.clear);
  },

  /**
   * Clear single filter
   */
  clearFilter(index) {
    if (this._filterClears && this._filterClears[index]) {
      this._filterClears[index]();
    }
  },

  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters = { query: '', category: '', sort: 'newest', price: '' };
    document.getElementById('searchInput').value = '';
    document.getElementById('categoryFilter').value = '';
    document.getElementById('sortFilter').value = 'newest';
    document.getElementById('priceFilter').value = '';
    this.applyFilters();
  },

  /**
   * Render my skills
   */
  renderMySkills() {
    const grid = document.getElementById('mySkillsGrid');

    if (!this.purchases.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <p>No purchases yet</p>
          <a href="#directory" class="btn btn-secondary">Browse Directory</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.purchases.map(purchase => `
      <article class="skill-card owned" data-id="${purchase.skillId}">
        <div class="skill-header">
          <span class="skill-tag category">Owned</span>
        </div>
        <h3>${this.escapeHtml(purchase.skillTitle)}</h3>
        <div class="skill-footer">
          <span>${new Date(purchase.purchasedAt).toLocaleDateString()}</span>
          <button class="btn btn-success" onclick="event.stopPropagation(); App.downloadSkill('${purchase.skillId}')">
            Download
          </button>
        </div>
      </article>
    `).join('');
  },

  /**
   * Update stats
   */
  updateStats(stats) {
    if (!stats) return;
    document.getElementById('statSkills').textContent = stats.totalSkills || 0;
    document.getElementById('statCreators').textContent = stats.totalCreators || 0;
    document.getElementById('statDownloads').textContent = stats.totalDownloads || 0;
    
    // Count unique categories
    const categories = new Set();
    this.skills.forEach(s => {
      const cat = (s.tags || '').split(',')[0]?.trim();
      if (cat) categories.add(cat.toLowerCase());
    });
    document.getElementById('statCategories').textContent = categories.size;
  },

  /**
   * Open skill modal
   */
  openSkillModal(skillId) {
    const skill = this.skills.find(s => s.id === skillId);
    if (!skill) return;

    this.currentSkill = skill;
    const isOwned = this.purchases.some(p => p.skillId === skillId);
    const tags = (skill.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    // Populate
    document.getElementById('modalTags').innerHTML = tags.map(t => 
      `<span class="skill-tag">${this.escapeHtml(t)}</span>`
    ).join('');
    document.getElementById('modalPrice').textContent = skill.price === 0 ? 'Free' : skill.price + ' SOL';
    document.getElementById('modalTitle').textContent = skill.title;
    document.getElementById('modalDesc').textContent = skill.description || 'No description provided.';
    document.getElementById('modalCreator').textContent = skill.creator;
    document.getElementById('modalDownloads').textContent = skill.downloads || 0;
    document.getElementById('modalDate').textContent = new Date(skill.createdAt).toLocaleDateString();

    // Buttons
    const purchaseBtn = document.getElementById('modalPurchaseBtn');
    const downloadBtn = document.getElementById('modalDownloadBtn');

    if (isOwned) {
      purchaseBtn.hidden = true;
      downloadBtn.hidden = false;
    } else {
      purchaseBtn.hidden = false;
      downloadBtn.hidden = true;
      purchaseBtn.textContent = Wallet.address ? 'Purchase' : 'Connect Wallet';
    }

    document.getElementById('modalStatus').hidden = true;
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
      if (!this.currentSkill.creatorWallet) {
        throw new Error('Creator has not set a payment wallet');
      }

      statusEl.textContent = 'Confirm in Phantom...';
      const signature = await Solana.executePurchase(
        this.currentSkill.creatorWallet,
        this.currentSkill.price
      );

      statusEl.textContent = 'Recording purchase...';
      await API.createPurchase({
        buyerWallet: Wallet.address,
        skillId: this.currentSkill.id,
        txSignature: signature,
        pricePaid: this.currentSkill.price
      });

      statusEl.className = 'modal-status success';
      statusEl.textContent = 'Purchase successful!';

      this.purchases.push({
        skillId: this.currentSkill.id,
        skillTitle: this.currentSkill.title,
        purchasedAt: new Date().toISOString()
      });

      purchaseBtn.hidden = true;
      document.getElementById('modalDownloadBtn').hidden = false;

      this.renderSkills();
      this.renderMySkills();
      this.loadSkills();

    } catch (err) {
      console.error('Purchase failed:', err);
      statusEl.className = 'modal-status error';
      statusEl.textContent = err.message || 'Purchase failed';
    }

    purchaseBtn.disabled = false;
  },

  /**
   * Handle download from modal
   */
  async handleDownload() {
    if (!this.currentSkill) return;
    await this.downloadSkill(this.currentSkill.id);
  },

  /**
   * Download skill
   */
  async downloadSkill(skillId) {
    if (!Wallet.address) {
      await Wallet.connect();
      return;
    }

    try {
      const content = await API.getSkillContent(skillId, Wallet.address);
      const skill = this.skills.find(s => s.id === skillId);
      const filename = `${skill?.title || 'skill'}.md`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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
   * Handle upload
   */
  async handleUpload() {
    if (!Wallet.address) return;

    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    try {
      const skillData = {
        title: document.getElementById('skillTitle').value.trim(),
        price: parseFloat(document.getElementById('skillPrice').value) || 0,
        tags: document.getElementById('skillTags').value.trim(),
        description: document.getElementById('skillDesc').value.trim(),
        content: document.getElementById('skillContent').value,
        creator: Wallet.shortenAddress(),
        creatorWallet: Wallet.address
      };

      // Add category to tags if selected
      const category = document.getElementById('skillCategory').value;
      if (category && !skillData.tags.toLowerCase().includes(category)) {
        skillData.tags = category + ', ' + skillData.tags;
      }

      await API.createSkill(skillData);
      document.getElementById('uploadForm').reset();
      await this.loadSkills();
      
      alert('Skill uploaded successfully!');
      window.location.hash = '#directory';

    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'Upload failed');
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Skill';
  },

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
