/**
 * Skillstore App
 */

const App = {
  skills: [],
  purchases: [],
  
  // State
  selectedCategory: null,
  selectedTag: null,
  searchQuery: '',
  selectedIndex: 0,
  filteredSkills: [],

  categories: [
    { id: 'all', name: 'all', icon: '*' },
    { id: 'security', name: 'security', icon: '!' },
    { id: 'automation', name: 'automation', icon: '>' },
    { id: 'data', name: 'data', icon: '#' },
    { id: 'blockchain', name: 'blockchain', icon: '$' },
    { id: 'llm', name: 'llm', icon: '@' },
    { id: 'devops', name: 'devops', icon: '%' },
    { id: 'other', name: 'other', icon: '?' }
  ],

  async init() {
    Wallet.onConnect = (addr) => this.onWalletConnect(addr);
    Wallet.onDisconnect = () => this.onWalletDisconnect();

    this.bindEvents();
    await Wallet.checkConnection();
    await this.loadSkills();
    
    this.renderCategories();
    this.renderPopularTags();
    this.renderTree();
  },

  bindEvents() {
    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.filterAndRender();
    });
    
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        this.searchQuery = '';
        this.filterAndRender();
        searchInput.blur();
      }
    });

    // Buttons
    document.getElementById('walletBtn').addEventListener('click', () => {
      Wallet.address ? Wallet.disconnect() : Wallet.connect();
    });

    document.getElementById('uploadBtn').addEventListener('click', () => {
      if (!Wallet.address) {
        Wallet.connect().then(() => {
          if (Wallet.address) this.showUploadModal();
        });
      } else {
        this.showUploadModal();
      }
    });

    document.getElementById('randomBtn').addEventListener('click', () => {
      this.showRandomSkill();
    });

    // Modals
    document.getElementById('modalClose').addEventListener('click', () => {
      this.closeSkillModal();
    });

    document.getElementById('uploadClose').addEventListener('click', () => {
      this.closeUploadModal();
    });

    document.getElementById('uploadCancel').addEventListener('click', () => {
      this.closeUploadModal();
    });

    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      // Don't capture when typing
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.navigate(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.navigate(1);
          break;
        case 'Enter':
          e.preventDefault();
          this.selectCurrent();
          break;
        case 'Escape':
          this.closeAllModals();
          break;
        case '/':
          e.preventDefault();
          document.getElementById('searchInput').focus();
          break;
      }
    });

    // Click outside modal to close
    document.getElementById('skillModal').addEventListener('click', (e) => {
      if (e.target.id === 'skillModal') this.closeSkillModal();
    });

    document.getElementById('uploadModal').addEventListener('click', (e) => {
      if (e.target.id === 'uploadModal') this.closeUploadModal();
    });
  },

  // === DATA ===

  async loadSkills() {
    try {
      const data = await API.getSkills();
      this.skills = data.skills || [];
      document.getElementById('statSkills').textContent = this.skills.length;
      this.filterAndRender();
    } catch (err) {
      console.error('Failed to load skills:', err);
    }
  },

  async loadPurchases() {
    if (!Wallet.address) return;
    try {
      const data = await API.getPurchases(Wallet.address);
      this.purchases = data.purchases || [];
    } catch (err) {
      console.error('Failed to load purchases:', err);
    }
  },

  // === FILTERING ===

  filterAndRender() {
    let filtered = [...this.skills];

    // Category filter
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      filtered = filtered.filter(s => {
        const tags = (s.tags || '').toLowerCase();
        return tags.includes(this.selectedCategory);
      });
    }

    // Tag filter
    if (this.selectedTag) {
      filtered = filtered.filter(s => {
        const tags = (s.tags || '').toLowerCase();
        return tags.includes(this.selectedTag);
      });
    }

    // Search filter
    if (this.searchQuery) {
      filtered = filtered.filter(s => {
        const text = `${s.title} ${s.description} ${s.tags} ${s.creator}`.toLowerCase();
        return text.includes(this.searchQuery);
      });
    }

    // Sort by downloads
    filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

    this.filteredSkills = filtered;
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, filtered.length - 1));
    
    this.renderTree();
    this.updateTreeHeader();
  },

  updateTreeHeader() {
    let path = 'skills/';
    if (this.selectedCategory && this.selectedCategory !== 'all') {
      path += this.selectedCategory + '/';
    }
    if (this.selectedTag) {
      path += '#' + this.selectedTag + '/';
    }
    if (this.searchQuery) {
      path += '?' + this.searchQuery;
    }
    
    document.getElementById('treePath').textContent = path;
    document.getElementById('treeCount').textContent = `(${this.filteredSkills.length})`;
  },

  // === RENDER ===

  renderCategories() {
    const container = document.getElementById('tagCloud');
    container.innerHTML = '';

    this.categories.forEach(cat => {
      const count = cat.id === 'all' 
        ? this.skills.length 
        : this.skills.filter(s => (s.tags || '').toLowerCase().includes(cat.id)).length;

      const el = document.createElement('div');
      el.className = `tag-item ${this.selectedCategory === cat.id || (!this.selectedCategory && cat.id === 'all') ? 'active' : ''}`;
      el.innerHTML = `
        <span class="tag-prefix">${cat.icon}</span>
        <span class="tag-name">${cat.name}/</span>
        <span class="tag-count">${count}</span>
      `;
      el.addEventListener('click', () => {
        this.selectedCategory = cat.id === 'all' ? null : cat.id;
        this.selectedTag = null;
        this.selectedIndex = 0;
        this.renderCategories();
        this.filterAndRender();
      });
      container.appendChild(el);
    });
  },

  renderPopularTags() {
    // Collect all tags
    const tagCounts = {};
    this.skills.forEach(s => {
      const tags = (s.tags || '').split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      tags.forEach(t => {
        // Skip category names
        if (!this.categories.find(c => c.id === t)) {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      });
    });

    // Sort by count and take top 10
    const sorted = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const container = document.getElementById('popularTags');
    container.innerHTML = '';

    sorted.forEach(([tag, count]) => {
      const el = document.createElement('span');
      el.className = `pop-tag ${this.selectedTag === tag ? 'active' : ''}`;
      el.textContent = '#' + tag;
      el.addEventListener('click', () => {
        this.selectedTag = this.selectedTag === tag ? null : tag;
        this.selectedIndex = 0;
        this.renderPopularTags();
        this.filterAndRender();
      });
      container.appendChild(el);
    });
  },

  renderTree() {
    const container = document.getElementById('treeView');
    
    if (this.filteredSkills.length === 0) {
      container.innerHTML = '<div class="tree-empty">no skills found</div>';
      return;
    }

    container.innerHTML = '';

    this.filteredSkills.forEach((skill, index) => {
      const isLast = index === this.filteredSkills.length - 1;
      const isSelected = index === this.selectedIndex;
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      const isFree = skill.price === 0;

      const prefix = isLast ? '\\-- ' : '|-- ';

      const el = document.createElement('div');
      el.className = `tree-node ${isSelected ? 'selected' : ''}`;
      el.dataset.index = index;
      
      el.innerHTML = `
        <span class="tree-prefix">${prefix}</span>
        <span class="tree-name">${this.escapeHtml(skill.title)}</span>
        <div class="tree-meta">
          ${isOwned ? '<span class="tree-owned">[owned]</span>' : ''}
          <span class="tree-price ${isFree ? 'free' : ''}">${isFree ? 'free' : skill.price + ' SOL'}</span>
          <span class="tree-downloads">${skill.downloads || 0} dl</span>
        </div>
      `;

      el.addEventListener('click', () => {
        this.selectedIndex = index;
        this.renderTree();
        this.showSkillDetail(skill);
      });

      container.appendChild(el);
    });
  },

  // === NAVIGATION ===

  navigate(delta) {
    const max = this.filteredSkills.length - 1;
    this.selectedIndex = Math.max(0, Math.min(max, this.selectedIndex + delta));
    this.renderTree();
    
    // Scroll into view
    const selected = document.querySelector('.tree-node.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  },

  selectCurrent() {
    const skill = this.filteredSkills[this.selectedIndex];
    if (skill) {
      this.showSkillDetail(skill);
    }
  },

  // === SKILL DETAIL ===

  showSkillDetail(skill) {
    const modal = document.getElementById('skillModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');

    const isOwned = this.purchases.some(p => p.skillId === skill.id);
    const isFree = skill.price === 0;
    const tags = (skill.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    title.textContent = skill.title;
    body.innerHTML = `
      <div class="skill-detail">
        <div class="skill-creator">by ${this.escapeHtml(skill.creator)}</div>
        <div class="skill-stats">
          <span class="skill-stat">price: <span class="${isFree ? 'free' : ''}">${isFree ? 'free' : skill.price + ' SOL'}</span></span>
          <span class="skill-stat">downloads: <span>${skill.downloads || 0}</span></span>
        </div>
        <div class="skill-desc">${this.escapeHtml(skill.description || 'No description provided.')}</div>
        <div class="skill-tags">
          ${tags.map(t => `<span class="skill-tag">#${this.escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="skill-actions">
          ${isOwned || isFree
            ? `<button class="btn-primary" id="actionBtn">[download]</button>`
            : `<button class="btn-primary" id="actionBtn">[${Wallet.address ? 'purchase' : 'connect to purchase'}]</button>`
          }
        </div>
        <div class="skill-status" id="actionStatus" hidden></div>
      </div>
    `;

    modal.hidden = false;

    document.getElementById('actionBtn').addEventListener('click', () => {
      if (isOwned || isFree) {
        this.handleDownload(skill);
      } else if (!Wallet.address) {
        Wallet.connect().then(() => {
          if (Wallet.address) {
            this.closeSkillModal();
            this.showSkillDetail(skill);
          }
        });
      } else {
        this.handlePurchase(skill);
      }
    });
  },

  closeSkillModal() {
    document.getElementById('skillModal').hidden = true;
  },

  showRandomSkill() {
    if (this.skills.length === 0) return;
    const skill = this.skills[Math.floor(Math.random() * this.skills.length)];
    this.showSkillDetail(skill);
  },

  // === PURCHASE ===

  async handlePurchase(skill) {
    const statusEl = document.getElementById('actionStatus');
    const btn = document.getElementById('actionBtn');

    statusEl.hidden = false;
    statusEl.className = 'skill-status';
    statusEl.textContent = 'creating transaction...';
    btn.disabled = true;

    try {
      if (!skill.creatorWallet) {
        throw new Error('creator has not set a wallet');
      }

      statusEl.textContent = 'confirm in phantom...';
      const sig = await Solana.executePurchase(skill.creatorWallet, skill.price);

      statusEl.textContent = 'recording purchase...';
      await API.createPurchase({
        buyerWallet: Wallet.address,
        skillId: skill.id,
        skillTitle: skill.title,
        txSignature: sig,
        pricePaid: skill.price
      });

      statusEl.className = 'skill-status success';
      statusEl.textContent = 'purchase successful!';

      this.purchases.push({
        skillId: skill.id,
        skillTitle: skill.title,
        purchasedAt: new Date().toISOString()
      });

      setTimeout(() => {
        this.closeSkillModal();
        this.showSkillDetail(skill);
      }, 1500);

    } catch (err) {
      console.error('Purchase failed:', err);
      statusEl.className = 'skill-status error';
      statusEl.textContent = err.message || 'purchase failed';
      btn.disabled = false;
    }
  },

  async handleDownload(skill) {
    try {
      let content;
      if (skill.price === 0) {
        // Free skill - get content directly
        const fullSkill = await API.getSkill(skill.id);
        content = fullSkill.content;
      } else {
        // Paid skill - need ownership check
        content = await API.getSkillContent(skill.id, Wallet.address);
      }
      
      const filename = `${skill.title}.md`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
      alert(err.message || 'download failed');
    }
  },

  // === UPLOAD ===

  showUploadModal() {
    document.getElementById('uploadModal').hidden = false;
    document.getElementById('skillTitle').focus();
  },

  closeUploadModal() {
    document.getElementById('uploadModal').hidden = true;
    document.getElementById('uploadForm').reset();
  },

  async handleUpload() {
    const btn = document.querySelector('#uploadForm button[type="submit"]');
    btn.textContent = '[uploading...]';
    btn.disabled = true;

    try {
      const data = {
        title: document.getElementById('skillTitle').value.trim(),
        price: parseFloat(document.getElementById('skillPrice').value) || 0,
        tags: document.getElementById('skillCategory').value + ', ' + 
              document.getElementById('skillTags').value.trim(),
        description: document.getElementById('skillDesc').value.trim(),
        content: document.getElementById('skillContent').value,
        creator: Wallet.shortenAddress(),
        creatorWallet: Wallet.address
      };

      await API.createSkill(data);
      this.closeUploadModal();
      await this.loadSkills();
      this.renderCategories();
      this.renderPopularTags();

    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'upload failed');
    }

    btn.textContent = '[submit]';
    btn.disabled = false;
  },

  // === MODALS ===

  closeAllModals() {
    this.closeSkillModal();
    this.closeUploadModal();
  },

  // === WALLET ===

  onWalletConnect(addr) {
    document.getElementById('walletStatus').textContent = Wallet.shortenAddress(addr);
    document.getElementById('walletStatus').classList.add('connected');
    document.getElementById('walletBtn').textContent = '[disconnect]';
    this.loadPurchases().then(() => this.renderTree());
  },

  onWalletDisconnect() {
    document.getElementById('walletStatus').textContent = 'not connected';
    document.getElementById('walletStatus').classList.remove('connected');
    document.getElementById('walletBtn').textContent = '[connect]';
    this.purchases = [];
    this.renderTree();
  },

  // === UTILS ===

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
