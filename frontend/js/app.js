/**
 * Skillstore - Terminal Tree Browser
 */

const App = {
  skills: [],
  purchases: [],
  tree: [],
  flatTree: [],
  selectedIndex: 0,
  expandedNodes: new Set(['root']),
  searchQuery: '',

  categories: [
    { id: 'security', label: 'security' },
    { id: 'automation', label: 'automation' },
    { id: 'data', label: 'data' },
    { id: 'blockchain', label: 'blockchain' },
    { id: 'llm', label: 'llm' },
    { id: 'devops', label: 'devops' },
    { id: 'other', label: 'other' }
  ],

  async init() {
    Wallet.onConnect = (addr) => this.onWalletConnect(addr);
    Wallet.onDisconnect = () => this.onWalletDisconnect();

    this.setupEventListeners();
    this.setupKeyboard();

    await Wallet.checkConnection();
    await this.loadSkills();

    document.getElementById('treeContainer').focus();
  },

  setupEventListeners() {
    document.getElementById('walletBtn').addEventListener('click', () => {
      Wallet.address ? Wallet.disconnect() : Wallet.connect();
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.buildTree();
      this.render();
    });

    document.getElementById('detailBack').addEventListener('click', () => this.closeDetail());
    document.getElementById('detailPurchase').addEventListener('click', () => this.handlePurchase());
    document.getElementById('detailDownload').addEventListener('click', () => this.handleDownload());

    document.getElementById('uploadBack').addEventListener('click', () => this.closeUpload());
    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });
  },

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      const searchInput = document.getElementById('searchInput');
      const detailPanel = document.getElementById('detailPanel');
      const uploadPanel = document.getElementById('uploadPanel');

      // If panels are open
      if (!detailPanel.hidden) {
        if (e.key === 'Escape' || e.key === 'Backspace') {
          e.preventDefault();
          this.closeDetail();
        }
        return;
      }

      if (!uploadPanel.hidden) {
        if (e.key === 'Escape') {
          this.closeUpload();
        }
        return;
      }

      // Search focus
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        return;
      }

      // Exit search
      if (document.activeElement === searchInput) {
        if (e.key === 'Escape') {
          searchInput.blur();
          document.getElementById('treeContainer').focus();
        }
        return;
      }

      // Upload shortcut
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        this.openUpload();
        return;
      }

      // Navigation
      switch (e.key) {
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          this.navigate(-1);
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          this.navigate(1);
          break;
        case 'ArrowRight':
        case 'l':
          e.preventDefault();
          this.expandSelected();
          break;
        case 'ArrowLeft':
        case 'h':
          e.preventDefault();
          this.collapseSelected();
          break;
        case 'Enter':
          e.preventDefault();
          this.selectCurrent();
          break;
        case 'Home':
          e.preventDefault();
          this.selectedIndex = 0;
          this.render();
          break;
        case 'End':
          e.preventDefault();
          this.selectedIndex = this.flatTree.length - 1;
          this.render();
          break;
        case 'PageUp':
          e.preventDefault();
          this.navigate(-10);
          break;
        case 'PageDown':
          e.preventDefault();
          this.navigate(10);
          break;
      }
    });
  },

  navigate(delta) {
    this.selectedIndex = Math.max(0, Math.min(this.flatTree.length - 1, this.selectedIndex + delta));
    this.render();
    this.scrollToSelected();
  },

  scrollToSelected() {
    const row = document.querySelector('.tree-row.selected');
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
    }
  },

  expandSelected() {
    const node = this.flatTree[this.selectedIndex];
    if (node && node.type === 'category') {
      this.expandedNodes.add(node.id);
      this.buildFlatTree();
      this.render();
    } else if (node && node.type === 'skill') {
      this.openDetail(node.skill);
    }
  },

  collapseSelected() {
    const node = this.flatTree[this.selectedIndex];
    if (node && node.type === 'category' && this.expandedNodes.has(node.id)) {
      this.expandedNodes.delete(node.id);
      this.buildFlatTree();
      this.render();
    } else if (node && node.parentId) {
      // Go to parent
      const parentIndex = this.flatTree.findIndex(n => n.id === node.parentId);
      if (parentIndex >= 0) {
        this.selectedIndex = parentIndex;
        this.render();
      }
    }
  },

  selectCurrent() {
    const node = this.flatTree[this.selectedIndex];
    if (!node) return;

    if (node.type === 'category') {
      if (this.expandedNodes.has(node.id)) {
        this.expandedNodes.delete(node.id);
      } else {
        this.expandedNodes.add(node.id);
      }
      this.buildFlatTree();
      this.render();
    } else if (node.type === 'skill') {
      this.openDetail(node.skill);
    }
  },

  async loadSkills() {
    try {
      const data = await API.getSkills();
      this.skills = data.skills || [];
      this.buildTree();
      this.render();
      this.updateStats(data.stats);
    } catch (err) {
      console.error('Failed to load skills:', err);
      document.getElementById('treeContainer').innerHTML = 
        '<div class="tree-loading">Failed to load skills</div>';
    }
  },

  async loadPurchases() {
    if (!Wallet.address) return;
    try {
      const data = await API.getPurchases(Wallet.address);
      this.purchases = data.purchases || [];
      this.render();
    } catch (err) {
      console.error('Failed to load purchases:', err);
    }
  },

  buildTree() {
    // Group skills by category
    const categorized = {};
    
    this.categories.forEach(cat => {
      categorized[cat.id] = [];
    });

    this.skills.forEach(skill => {
      // Filter by search
      if (this.searchQuery) {
        const text = `${skill.title} ${skill.description} ${skill.creator} ${skill.tags}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return;
      }

      // Find category
      const tags = (skill.tags || '').toLowerCase();
      let placed = false;
      
      for (const cat of this.categories) {
        if (cat.id !== 'other' && tags.includes(cat.id)) {
          categorized[cat.id].push(skill);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        categorized['other'].push(skill);
      }
    });

    // Build tree structure
    this.tree = this.categories
      .map(cat => ({
        id: cat.id,
        type: 'category',
        label: cat.label,
        children: categorized[cat.id].sort((a, b) => 
          new Date(b.createdAt) - new Date(a.createdAt)
        )
      }))
      .filter(cat => cat.children.length > 0 || !this.searchQuery);

    this.buildFlatTree();
    
    // Update search count
    if (this.searchQuery) {
      const count = this.skills.filter(s => {
        const text = `${s.title} ${s.description} ${s.creator} ${s.tags}`.toLowerCase();
        return text.includes(this.searchQuery);
      }).length;
      document.getElementById('searchCount').textContent = `${count} found`;
    } else {
      document.getElementById('searchCount').textContent = '';
    }
  },

  buildFlatTree() {
    this.flatTree = [];
    
    this.tree.forEach((category, catIndex) => {
      const isLast = catIndex === this.tree.length - 1;
      
      this.flatTree.push({
        id: category.id,
        type: 'category',
        label: category.label,
        count: category.children.length,
        depth: 0,
        isExpanded: this.expandedNodes.has(category.id),
        isLast
      });

      if (this.expandedNodes.has(category.id)) {
        category.children.forEach((skill, skillIndex) => {
          const isLastSkill = skillIndex === category.children.length - 1;
          const isOwned = this.purchases.some(p => p.skillId === skill.id);
          
          this.flatTree.push({
            id: skill.id,
            type: 'skill',
            label: skill.title,
            skill: skill,
            parentId: category.id,
            depth: 1,
            isLast: isLastSkill,
            isOwned,
            price: skill.price,
            downloads: skill.downloads || 0
          });
        });
      }
    });

    // Adjust selection if needed
    if (this.selectedIndex >= this.flatTree.length) {
      this.selectedIndex = Math.max(0, this.flatTree.length - 1);
    }
  },

  render() {
    const container = document.getElementById('treeContainer');
    
    if (this.flatTree.length === 0) {
      container.innerHTML = this.searchQuery 
        ? '<div class="tree-loading">No results found</div>'
        : '<div class="tree-loading">No skills yet</div>';
      return;
    }

    container.innerHTML = this.flatTree.map((node, index) => {
      const isSelected = index === this.selectedIndex;
      
      if (node.type === 'category') {
        return `
          <div class="tree-node">
            <div class="tree-row ${isSelected ? 'selected' : ''}" 
                 data-depth="${node.depth}" 
                 data-index="${index}">
              <span class="tree-toggle ${node.isExpanded ? 'expanded' : 'collapsed'}"></span>
              <span class="tree-icon folder"></span>
              <span class="tree-label category">${node.label}/</span>
              <span class="tree-meta">
                <span class="tree-downloads">(${node.count})</span>
              </span>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="tree-node">
            <div class="tree-row ${isSelected ? 'selected' : ''}" 
                 data-depth="${node.depth}" 
                 data-index="${index}">
              <span class="tree-toggle ${node.isLast ? 'last' : 'none'}"></span>
              <span class="tree-icon file"></span>
              <span class="tree-label">${this.escapeHtml(node.label)}</span>
              <span class="tree-meta">
                ${node.isOwned ? '<span class="tree-owned">[OWNED]</span>' : ''}
                <span class="tree-price">${node.price === 0 ? 'FREE' : node.price + ' SOL'}</span>
                <span class="tree-downloads">${node.downloads}</span>
              </span>
            </div>
          </div>
        `;
      }
    }).join('');

    // Click handlers
    container.querySelectorAll('.tree-row').forEach(row => {
      row.addEventListener('click', () => {
        this.selectedIndex = parseInt(row.dataset.index);
        this.selectCurrent();
      });
    });
  },

  updateStats(stats) {
    const total = stats?.totalSkills || this.skills.length;
    document.getElementById('footerStats').textContent = `${total} skills`;
  },

  // === DETAIL PANEL ===

  openDetail(skill) {
    this.currentSkill = skill;
    const isOwned = this.purchases.some(p => p.skillId === skill.id);

    document.getElementById('detailTitle').textContent = skill.title;
    document.getElementById('detailPrice').textContent = skill.price === 0 ? 'FREE' : skill.price + ' SOL';
    document.getElementById('detailCreator').textContent = skill.creator;
    document.getElementById('detailDownloads').textContent = skill.downloads || 0;
    document.getElementById('detailDate').textContent = new Date(skill.createdAt).toLocaleDateString();
    document.getElementById('detailDesc').textContent = skill.description || 'No description.';

    const tags = (skill.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    document.getElementById('detailTags').innerHTML = tags.map(t => 
      `<span class="detail-tag">${this.escapeHtml(t)}</span>`
    ).join('');

    const purchaseBtn = document.getElementById('detailPurchase');
    const downloadBtn = document.getElementById('detailDownload');

    if (isOwned) {
      purchaseBtn.hidden = true;
      downloadBtn.hidden = false;
    } else {
      purchaseBtn.hidden = false;
      downloadBtn.hidden = true;
      purchaseBtn.textContent = Wallet.address ? 'PURCHASE' : 'CONNECT WALLET';
    }

    document.getElementById('detailStatus').hidden = true;
    document.getElementById('detailPanel').hidden = false;
  },

  closeDetail() {
    document.getElementById('detailPanel').hidden = true;
    this.currentSkill = null;
    document.getElementById('treeContainer').focus();
  },

  async handlePurchase() {
    if (!this.currentSkill) return;

    if (!Wallet.address) {
      await Wallet.connect();
      return;
    }

    const statusEl = document.getElementById('detailStatus');
    const btn = document.getElementById('detailPurchase');

    statusEl.hidden = false;
    statusEl.className = 'detail-status loading';
    statusEl.textContent = 'Creating transaction...';
    btn.disabled = true;

    try {
      if (!this.currentSkill.creatorWallet) {
        throw new Error('Creator has not set a wallet');
      }

      statusEl.textContent = 'Confirm in Phantom...';
      const sig = await Solana.executePurchase(
        this.currentSkill.creatorWallet,
        this.currentSkill.price
      );

      statusEl.textContent = 'Recording purchase...';
      await API.createPurchase({
        buyerWallet: Wallet.address,
        skillId: this.currentSkill.id,
        txSignature: sig,
        pricePaid: this.currentSkill.price
      });

      statusEl.className = 'detail-status success';
      statusEl.textContent = 'Purchase successful!';

      this.purchases.push({
        skillId: this.currentSkill.id,
        skillTitle: this.currentSkill.title,
        purchasedAt: new Date().toISOString()
      });

      btn.hidden = true;
      document.getElementById('detailDownload').hidden = false;

      this.buildFlatTree();
      this.render();

    } catch (err) {
      console.error('Purchase failed:', err);
      statusEl.className = 'detail-status error';
      statusEl.textContent = err.message || 'Purchase failed';
    }

    btn.disabled = false;
  },

  async handleDownload() {
    if (!this.currentSkill || !Wallet.address) return;

    try {
      const content = await API.getSkillContent(this.currentSkill.id, Wallet.address);
      const filename = `${this.currentSkill.title}.md`.toLowerCase().replace(/[^a-z0-9]+/g, '-');

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

  // === UPLOAD PANEL ===

  openUpload() {
    if (!Wallet.address) {
      Wallet.connect();
      return;
    }
    document.getElementById('uploadPanel').hidden = false;
  },

  closeUpload() {
    document.getElementById('uploadPanel').hidden = true;
    document.getElementById('treeContainer').focus();
  },

  async handleUpload() {
    const btn = document.querySelector('#uploadForm button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'UPLOADING...';

    try {
      const skillData = {
        title: document.getElementById('skillTitle').value.trim(),
        price: parseFloat(document.getElementById('skillPrice').value) || 0,
        tags: document.getElementById('skillCategory').value + ', ' + document.getElementById('skillTags').value.trim(),
        description: document.getElementById('skillDesc').value.trim(),
        content: document.getElementById('skillContent').value,
        creator: Wallet.shortenAddress(),
        creatorWallet: Wallet.address
      };

      await API.createSkill(skillData);
      document.getElementById('uploadForm').reset();
      this.closeUpload();
      await this.loadSkills();
      alert('Skill uploaded!');

    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'Upload failed');
    }

    btn.disabled = false;
    btn.textContent = 'UPLOAD';
  },

  // === WALLET ===

  onWalletConnect(addr) {
    document.getElementById('walletStatus').textContent = `[ ${Wallet.shortenAddress(addr)} ]`;
    document.getElementById('walletStatus').classList.add('connected');
    document.getElementById('walletBtn').textContent = 'DISCONNECT';
    this.loadPurchases();
  },

  onWalletDisconnect() {
    document.getElementById('walletStatus').textContent = '[ NOT CONNECTED ]';
    document.getElementById('walletStatus').classList.remove('connected');
    document.getElementById('walletBtn').textContent = 'CONNECT';
    this.purchases = [];
    this.buildFlatTree();
    this.render();
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
