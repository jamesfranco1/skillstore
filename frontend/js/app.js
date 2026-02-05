/**
 * Skillstore Application
 * Old-school file browser with keyboard navigation
 */

const App = {
  // State
  skills: [],
  filteredSkills: [],
  purchases: [],
  currentSkill: null,
  
  // Browser state
  activePanel: 'tree', // 'tree' or 'list'
  treeIndex: 0,
  listIndex: 0,
  selectedCategory: 'all',
  selectedSort: 'newest',
  searchQuery: '',

  // Categories
  categories: ['all', 'security', 'automation', 'data', 'blockchain', 'llm', 'devops'],

  /**
   * Initialize
   */
  async init() {
    Wallet.onConnect = (address) => this.onWalletConnect(address);
    Wallet.onDisconnect = () => this.onWalletDisconnect();
    Wallet.onAccountChange = (address) => this.onWalletConnect(address);

    this.setupEventListeners();
    this.setupKeyboardNavigation();

    await Wallet.checkConnection();
    await this.loadSkills();

    // Focus tree by default
    document.getElementById('browserTree').focus();
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
      this.searchQuery = e.target.value;
      this.applyFilters();
    });

    // Tree items click
    document.querySelectorAll('.tree-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.treeIndex = index;
        this.selectTreeItem(item);
        document.getElementById('browserTree').focus();
      });
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

    // Panel focus tracking
    document.getElementById('browserTree').addEventListener('focus', () => {
      this.activePanel = 'tree';
      this.updatePanelHighlight();
    });

    document.getElementById('skillsList').addEventListener('focus', () => {
      this.activePanel = 'list';
      this.updatePanelHighlight();
    });
  },

  /**
   * Setup keyboard navigation
   */
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      const searchInput = document.getElementById('searchInput');
      const modal = document.getElementById('skillModal');

      // If modal is open, only handle escape
      if (!modal.hidden) {
        if (e.key === 'Escape') {
          this.closeModal();
        }
        return;
      }

      // Search shortcut
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        return;
      }

      // If typing in search, don't handle navigation
      if (document.activeElement === searchInput) {
        if (e.key === 'Escape') {
          searchInput.blur();
          document.getElementById('browserTree').focus();
        }
        if (e.key === 'Enter') {
          searchInput.blur();
          document.getElementById('skillsList').focus();
          this.listIndex = 0;
          this.updateListHighlight();
        }
        return;
      }

      // Navigation keys
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.navigateUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.navigateDown();
          break;
        case 'ArrowRight':
        case 'Tab':
          if (!e.shiftKey) {
            e.preventDefault();
            this.switchToList();
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this.switchToTree();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.selectCurrentItem();
          break;
        case 'Escape':
          this.closeModal();
          break;
      }
    });
  },

  /**
   * Navigate up in current panel
   */
  navigateUp() {
    if (this.activePanel === 'tree') {
      const items = document.querySelectorAll('.tree-item');
      this.treeIndex = Math.max(0, this.treeIndex - 1);
      this.updateTreeHighlight();
    } else {
      this.listIndex = Math.max(0, this.listIndex - 1);
      this.updateListHighlight();
    }
  },

  /**
   * Navigate down in current panel
   */
  navigateDown() {
    if (this.activePanel === 'tree') {
      const items = document.querySelectorAll('.tree-item');
      this.treeIndex = Math.min(items.length - 1, this.treeIndex + 1);
      this.updateTreeHighlight();
    } else {
      const items = document.querySelectorAll('.list-item');
      this.listIndex = Math.min(items.length - 1, this.listIndex + 1);
      this.updateListHighlight();
    }
  },

  /**
   * Switch focus to list panel
   */
  switchToList() {
    this.activePanel = 'list';
    document.getElementById('skillsList').focus();
    this.updatePanelHighlight();
    if (this.filteredSkills.length > 0 && this.listIndex < 0) {
      this.listIndex = 0;
      this.updateListHighlight();
    }
  },

  /**
   * Switch focus to tree panel
   */
  switchToTree() {
    this.activePanel = 'tree';
    document.getElementById('browserTree').focus();
    this.updatePanelHighlight();
  },

  /**
   * Select current item (enter/space)
   */
  selectCurrentItem() {
    if (this.activePanel === 'tree') {
      const items = document.querySelectorAll('.tree-item');
      if (items[this.treeIndex]) {
        this.selectTreeItem(items[this.treeIndex]);
      }
    } else {
      const skill = this.filteredSkills[this.listIndex];
      if (skill) {
        this.openSkillModal(skill.id);
      }
    }
  },

  /**
   * Select a tree item
   */
  selectTreeItem(item) {
    const category = item.dataset.category;
    const sort = item.dataset.sort;

    if (category) {
      // Update selected category
      document.querySelectorAll('.tree-folder').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      this.selectedCategory = category;
      this.updatePath();
    }

    if (sort) {
      // Update selected sort
      document.querySelectorAll('.tree-option').forEach(el => {
        el.querySelector('.tree-icon').innerHTML = '&#9675;'; // Empty circle
        el.classList.remove('selected');
      });
      item.querySelector('.tree-icon').innerHTML = '&#9679;'; // Filled circle
      item.classList.add('selected');
      this.selectedSort = sort;
    }

    this.applyFilters();
    this.listIndex = 0;
  },

  /**
   * Update tree highlight
   */
  updateTreeHighlight() {
    const items = document.querySelectorAll('.tree-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this.treeIndex);
    });

    // Scroll into view
    if (items[this.treeIndex]) {
      items[this.treeIndex].scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Update list highlight
   */
  updateListHighlight() {
    const items = document.querySelectorAll('.list-item');
    items.forEach((item, i) => {
      item.classList.toggle('active', i === this.listIndex);
    });

    // Scroll into view
    if (items[this.listIndex]) {
      items[this.listIndex].scrollIntoView({ block: 'nearest' });
    }
  },

  /**
   * Update panel highlight styling
   */
  updatePanelHighlight() {
    document.getElementById('browserTree').classList.toggle('focused', this.activePanel === 'tree');
    document.getElementById('skillsList').classList.toggle('focused', this.activePanel === 'list');
  },

  /**
   * Update path display
   */
  updatePath() {
    const pathEl = document.getElementById('browserPath');
    const catLabel = this.selectedCategory === 'all' ? 'all' : this.selectedCategory;
    pathEl.innerHTML = `
      <span class="path-segment path-root">/skills</span>
      <span class="path-segment">/${catLabel}</span>
    `;
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
      this.updateCategoryCounts();
    } catch (err) {
      console.error('Failed to load skills:', err);
      document.getElementById('skillsList').innerHTML = 
        '<div class="list-empty">Failed to load skills</div>';
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

    // Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(skill => {
        const text = `${skill.title} ${skill.description} ${skill.creator} ${skill.tags}`.toLowerCase();
        return text.includes(q);
      });
    }

    // Category
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(skill => {
        const tags = (skill.tags || '').toLowerCase();
        return tags.includes(this.selectedCategory);
      });
    }

    // Sort
    switch (this.selectedSort) {
      case 'popular':
        filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        break;
      case 'price-low':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
      default:
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    this.filteredSkills = filtered;
    this.renderSkills();
  },

  /**
   * Render skills list
   */
  renderSkills() {
    const container = document.getElementById('skillsList');
    const skills = this.filteredSkills;

    if (!skills.length) {
      container.innerHTML = '<div class="list-empty">No skills found</div>';
      return;
    }

    container.innerHTML = skills.map((skill, index) => {
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      const isActive = index === this.listIndex && this.activePanel === 'list';
      
      return `
        <div class="list-item ${isOwned ? 'owned' : ''} ${isActive ? 'active' : ''}" 
             data-id="${skill.id}" data-index="${index}">
          <span class="item-icon">&#9632;</span>
          <span class="item-name">${this.escapeHtml(skill.title)}</span>
          <span class="item-creator">${this.escapeHtml(skill.creator)}</span>
          <span class="item-price">${skill.price === 0 ? 'FREE' : skill.price + ' SOL'}</span>
          <span class="item-downloads">${skill.downloads || 0}</span>
        </div>
      `;
    }).join('');

    // Click handlers
    container.querySelectorAll('.list-item').forEach((item, index) => {
      item.addEventListener('click', () => {
        this.listIndex = index;
        this.updateListHighlight();
        this.openSkillModal(item.dataset.id);
      });
    });
  },

  /**
   * Update category counts
   */
  updateCategoryCounts() {
    document.getElementById('countAll').textContent = this.skills.length;

    this.categories.slice(1).forEach(cat => {
      const count = this.skills.filter(s => 
        (s.tags || '').toLowerCase().includes(cat)
      ).length;
      const el = document.getElementById('count' + cat.charAt(0).toUpperCase() + cat.slice(1));
      if (el) el.textContent = count;
    });
  },

  /**
   * Update stats
   */
  updateStats(stats) {
    if (!stats) return;
    document.getElementById('statTotal').textContent = stats.totalSkills || 0;
    document.getElementById('statCreators').textContent = stats.totalCreators || 0;
    document.getElementById('statDownloads').textContent = stats.totalDownloads || 0;
  },

  /**
   * Render my skills
   */
  renderMySkills() {
    const grid = document.getElementById('mySkillsGrid');

    if (!this.purchases.length) {
      grid.innerHTML = '<div class="empty-state"><p>No purchases yet</p></div>';
      return;
    }

    grid.innerHTML = this.purchases.map(purchase => `
      <div class="my-skill-card" data-id="${purchase.skillId}">
        <h3 style="font-family: VT323; font-size: 20px; margin-bottom: 8px;">${this.escapeHtml(purchase.skillTitle)}</h3>
        <div style="font-size: 14px; color: var(--text-dim); margin-bottom: 12px;">
          Purchased: ${new Date(purchase.purchasedAt).toLocaleDateString()}
        </div>
        <button class="btn btn-success" onclick="App.downloadSkill('${purchase.skillId}')">DOWNLOAD</button>
      </div>
    `).join('');
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

    document.getElementById('modalTags').innerHTML = tags.slice(0, 3).map(t => 
      `<span class="skill-tag">${this.escapeHtml(t)}</span>`
    ).join('');
    document.getElementById('modalPrice').textContent = skill.price === 0 ? 'FREE' : skill.price + ' SOL';
    document.getElementById('modalTitle').textContent = skill.title;
    document.getElementById('modalDesc').textContent = skill.description || 'No description.';
    document.getElementById('modalCreator').textContent = skill.creator;
    document.getElementById('modalDownloads').textContent = skill.downloads || 0;
    document.getElementById('modalDate').textContent = new Date(skill.createdAt).toLocaleDateString();

    const purchaseBtn = document.getElementById('modalPurchaseBtn');
    const downloadBtn = document.getElementById('modalDownloadBtn');

    if (isOwned) {
      purchaseBtn.hidden = true;
      downloadBtn.hidden = false;
    } else {
      purchaseBtn.hidden = false;
      downloadBtn.hidden = true;
      purchaseBtn.textContent = Wallet.address ? 'PURCHASE' : 'CONNECT WALLET';
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
    // Refocus browser
    if (this.activePanel === 'list') {
      document.getElementById('skillsList').focus();
    } else {
      document.getElementById('browserTree').focus();
    }
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
        throw new Error('Creator has not set a wallet');
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
   * Handle download
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
    uploadBtn.textContent = 'UPLOADING...';

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

      const category = document.getElementById('skillCategory').value;
      if (category && !skillData.tags.toLowerCase().includes(category)) {
        skillData.tags = category + ', ' + skillData.tags;
      }

      await API.createSkill(skillData);
      document.getElementById('uploadForm').reset();
      await this.loadSkills();
      
      alert('Skill uploaded!');
      window.location.hash = '#directory';

    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'Upload failed');
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'UPLOAD SKILL';
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
