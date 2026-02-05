/**
 * Skillstore App
 */

const App = {
  skills: [],
  purchases: [],
  
  // State
  selectedCategory: 'all',
  searchQuery: '',
  selectedIndex: 0,
  filteredSkills: [],
  currentSkill: null,

  async init() {
    Wallet.onConnect = (addr) => this.onWalletConnect(addr);
    Wallet.onDisconnect = () => this.onWalletDisconnect();

    this.bindEvents();
    await Wallet.checkConnection();
    await this.loadSkills();
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

    // Category buttons
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.dataset.cat;
        this.selectedIndex = 0;
        this.updateCategoryButtons();
        this.filterAndRender();
      });
    });

    // Wallet button
    document.getElementById('walletBtn').addEventListener('click', () => {
      Wallet.address ? Wallet.disconnect() : Wallet.connect();
    });

    // Upload connect button
    document.getElementById('uploadConnectBtn').addEventListener('click', () => {
      Wallet.connect();
    });

    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });

    // Modal
    document.getElementById('modalClose').addEventListener('click', () => {
      this.closeModal();
    });

    document.querySelector('.modal-backdrop').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('modalPurchaseBtn').addEventListener('click', () => {
      this.handlePurchase();
    });

    document.getElementById('modalDownloadBtn').addEventListener('click', () => {
      this.handleDownload();
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
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
          this.closeModal();
          break;
        case '/':
          e.preventDefault();
          document.getElementById('searchInput').focus();
          break;
      }
    });
  },

  // === DATA ===

  async loadSkills() {
    try {
      const data = await API.getSkills();
      this.skills = data.skills || [];
      
      // Update stats
      document.getElementById('statSkills').textContent = this.skills.length;
      const creators = new Set(this.skills.map(s => s.creator));
      document.getElementById('statCreators').textContent = creators.size;
      const downloads = this.skills.reduce((sum, s) => sum + (s.downloads || 0), 0);
      document.getElementById('statDownloads').textContent = downloads;
      
      this.filterAndRender();
    } catch (err) {
      console.error('Failed to load skills:', err);
      document.getElementById('treeView').innerHTML = 
        '<div class="empty-state">Failed to load skills</div>';
    }
  },

  async loadPurchases() {
    if (!Wallet.address) return;
    try {
      const data = await API.getPurchases(Wallet.address);
      this.purchases = data.purchases || [];
      this.filterAndRender();
      this.renderMySkills();
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
    this.updateResultsInfo();
  },

  updateCategoryButtons() {
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === this.selectedCategory);
    });
  },

  updateResultsInfo() {
    let path = 'skills/';
    if (this.selectedCategory !== 'all') {
      path += this.selectedCategory + '/';
    }
    if (this.searchQuery) {
      path += '?' + this.searchQuery;
    }
    
    document.getElementById('resultsPath').textContent = path;
    document.getElementById('resultsCount').textContent = this.filteredSkills.length;
  },

  // === RENDER ===

  renderTree() {
    const container = document.getElementById('treeView');
    
    if (this.filteredSkills.length === 0) {
      container.innerHTML = '<div class="empty-state">No skills found</div>';
      return;
    }

    container.innerHTML = '';

    this.filteredSkills.forEach((skill, index) => {
      const isLast = index === this.filteredSkills.length - 1;
      const isSelected = index === this.selectedIndex;
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      const isFree = skill.price === 0;

      const prefix = isLast ? '\\--' : '|--';

      const el = document.createElement('div');
      el.className = `tree-node ${isSelected ? 'selected' : ''} ${isOwned ? 'owned' : ''}`;
      el.dataset.index = index;
      
      el.innerHTML = `
        <span class="tree-prefix">${prefix}</span>
        <span class="tree-name">${this.escapeHtml(skill.title)}</span>
        <div class="tree-meta">
          ${isOwned ? '<span class="tree-owned">OWNED</span>' : ''}
          <span class="tree-price ${isFree ? 'free' : ''}">${isFree ? 'FREE' : skill.price + ' SOL'}</span>
          <span class="tree-downloads">${skill.downloads || 0} downloads</span>
        </div>
      `;

      el.addEventListener('click', () => {
        this.selectedIndex = index;
        this.renderTree();
        this.showSkillModal(skill);
      });

      container.appendChild(el);
    });
  },

  renderMySkills() {
    const container = document.getElementById('mySkillsList');
    
    if (this.purchases.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No purchases yet</p></div>';
      return;
    }

    container.innerHTML = '';
    
    this.purchases.forEach(purchase => {
      const skill = this.skills.find(s => s.id === purchase.skillId);
      if (!skill) return;

      const el = document.createElement('div');
      el.className = 'tree-node owned';
      el.innerHTML = `
        <span class="tree-prefix">*</span>
        <span class="tree-name">${this.escapeHtml(skill.title)}</span>
        <div class="tree-meta">
          <span class="tree-owned">OWNED</span>
        </div>
      `;
      el.addEventListener('click', () => this.showSkillModal(skill));
      container.appendChild(el);
    });
  },

  // === NAVIGATION ===

  navigate(delta) {
    const max = this.filteredSkills.length - 1;
    this.selectedIndex = Math.max(0, Math.min(max, this.selectedIndex + delta));
    this.renderTree();
    
    const selected = document.querySelector('.tree-node.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  },

  selectCurrent() {
    const skill = this.filteredSkills[this.selectedIndex];
    if (skill) {
      this.showSkillModal(skill);
    }
  },

  // === MODAL ===

  showSkillModal(skill) {
    this.currentSkill = skill;
    const modal = document.getElementById('skillModal');
    const isOwned = this.purchases.some(p => p.skillId === skill.id);
    const isFree = skill.price === 0;
    const tags = (skill.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    // Tags
    document.getElementById('modalTags').innerHTML = tags.map((t, i) => 
      `<span class="skill-tag ${i === 0 ? 'category' : ''}">${this.escapeHtml(t)}</span>`
    ).join('');

    // Price
    document.getElementById('modalPrice').textContent = isFree ? 'FREE' : skill.price + ' SOL';

    // Title & desc
    document.getElementById('modalTitle').textContent = skill.title;
    document.getElementById('modalDesc').textContent = skill.description || 'No description provided.';

    // Meta
    document.getElementById('modalCreator').textContent = skill.creator;
    document.getElementById('modalDownloads').textContent = skill.downloads || 0;
    document.getElementById('modalDate').textContent = skill.createdAt 
      ? new Date(skill.createdAt).toLocaleDateString() 
      : 'Unknown';

    // Buttons
    const purchaseBtn = document.getElementById('modalPurchaseBtn');
    const downloadBtn = document.getElementById('modalDownloadBtn');
    const statusEl = document.getElementById('modalStatus');

    statusEl.hidden = true;

    if (isOwned || isFree) {
      purchaseBtn.hidden = true;
      downloadBtn.hidden = false;
    } else {
      purchaseBtn.hidden = false;
      downloadBtn.hidden = true;
      purchaseBtn.textContent = Wallet.address ? 'Purchase' : 'Connect Wallet';
    }

    modal.hidden = false;
  },

  closeModal() {
    document.getElementById('skillModal').hidden = true;
    this.currentSkill = null;
  },

  // === PURCHASE ===

  async handlePurchase() {
    if (!this.currentSkill) return;

    if (!Wallet.address) {
      await Wallet.connect();
      if (Wallet.address) {
        this.showSkillModal(this.currentSkill);
      }
      return;
    }

    const skill = this.currentSkill;
    const statusEl = document.getElementById('modalStatus');
    const btn = document.getElementById('modalPurchaseBtn');

    statusEl.hidden = false;
    statusEl.className = 'modal-status loading';
    statusEl.textContent = 'Creating transaction...';
    btn.disabled = true;

    try {
      if (!skill.creatorWallet) {
        throw new Error('Creator has not set a wallet');
      }

      statusEl.textContent = 'Confirm in Phantom...';
      const sig = await Solana.executePurchase(skill.creatorWallet, skill.price);

      statusEl.textContent = 'Recording purchase...';
      await API.createPurchase({
        buyerWallet: Wallet.address,
        skillId: skill.id,
        skillTitle: skill.title,
        txSignature: sig,
        pricePaid: skill.price
      });

      statusEl.className = 'modal-status success';
      statusEl.textContent = 'Purchase successful!';

      this.purchases.push({
        skillId: skill.id,
        skillTitle: skill.title,
        purchasedAt: new Date().toISOString()
      });

      setTimeout(() => {
        this.closeModal();
        this.showSkillModal(skill);
        this.renderTree();
        this.renderMySkills();
      }, 1500);

    } catch (err) {
      console.error('Purchase failed:', err);
      statusEl.className = 'modal-status error';
      statusEl.textContent = err.message || 'Purchase failed';
      btn.disabled = false;
    }
  },

  async handleDownload() {
    if (!this.currentSkill) return;
    const skill = this.currentSkill;

    try {
      let content;
      if (skill.price === 0) {
        const fullSkill = await API.getSkill(skill.id);
        content = fullSkill.content;
      } else {
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
      alert(err.message || 'Download failed');
    }
  },

  // === UPLOAD ===

  async handleUpload() {
    const btn = document.querySelector('#uploadForm button[type="submit"]');
    btn.textContent = 'Uploading...';
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
      document.getElementById('uploadForm').reset();
      await this.loadSkills();
      
      // Scroll to directory
      document.getElementById('directory').scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'Upload failed');
    }

    btn.textContent = 'Upload Skill';
    btn.disabled = false;
  },

  // === WALLET ===

  onWalletConnect(addr) {
    const btn = document.getElementById('walletBtn');
    btn.querySelector('.wallet-text').textContent = Wallet.shortenAddress(addr);
    btn.classList.add('connected');
    
    // Show auth elements
    document.querySelectorAll('[data-auth]').forEach(el => el.hidden = false);
    
    // Hide upload notice, show form
    document.getElementById('uploadNotice').hidden = true;
    document.getElementById('uploadFormContainer').hidden = false;
    
    this.loadPurchases();
  },

  onWalletDisconnect() {
    const btn = document.getElementById('walletBtn');
    btn.querySelector('.wallet-text').textContent = 'Connect Wallet';
    btn.classList.remove('connected');
    
    // Hide auth elements
    document.querySelectorAll('[data-auth]').forEach(el => el.hidden = true);
    
    // Show upload notice, hide form
    document.getElementById('uploadNotice').hidden = false;
    document.getElementById('uploadFormContainer').hidden = true;
    
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
