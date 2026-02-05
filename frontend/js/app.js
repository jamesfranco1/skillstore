/**
 * Skillstore - Command Line Interface
 */

const App = {
  skills: [],
  purchases: [],
  
  // View state
  view: 'home', // 'home', 'tree', 'skill', 'search', 'upload'
  treeData: [],
  treeExpanded: new Set(),
  selectedIndex: -1,
  currentSkill: null,
  commandHistory: [],
  historyIndex: -1,

  categories: ['security', 'automation', 'data', 'blockchain', 'llm', 'devops', 'other'],

  async init() {
    Wallet.onConnect = (addr) => this.onWalletConnect(addr);
    Wallet.onDisconnect = () => this.onWalletDisconnect();

    this.setupEventListeners();
    await Wallet.checkConnection();
    await this.loadSkills();
  },

  setupEventListeners() {
    const cli = document.getElementById('cliInput');
    
    cli.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.executeCommand(cli.value.trim());
        cli.value = '';
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1, cli);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1, cli);
      }
    });

    document.addEventListener('keydown', (e) => {
      const cli = document.getElementById('cliInput');
      
      // Don't capture if typing in input
      if (document.activeElement.tagName === 'INPUT' || 
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.tagName === 'SELECT') {
        if (e.key === 'Escape') {
          cli.blur();
          if (this.view === 'upload') {
            this.hideUpload();
          }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          this.navigateTree(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          this.navigateTree(1);
          break;
        case 'Enter':
          e.preventDefault();
          this.selectTreeItem();
          break;
        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          this.goBack();
          break;
        case '/':
          e.preventDefault();
          cli.focus();
          break;
      }
    });

    document.getElementById('walletBtn').addEventListener('click', () => {
      Wallet.address ? Wallet.disconnect() : Wallet.connect();
    });

    document.getElementById('uploadCancel').addEventListener('click', () => {
      this.hideUpload();
    });

    document.getElementById('uploadForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleUpload();
    });
  },

  navigateHistory(delta, input) {
    if (this.commandHistory.length === 0) return;
    
    this.historyIndex = Math.max(-1, Math.min(
      this.commandHistory.length - 1,
      this.historyIndex + delta
    ));
    
    if (this.historyIndex >= 0) {
      input.value = this.commandHistory[this.historyIndex];
    } else {
      input.value = '';
    }
  },

  executeCommand(cmd) {
    if (!cmd) return;

    this.commandHistory.unshift(cmd);
    this.historyIndex = -1;

    const parts = cmd.toLowerCase().split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'help':
      case '?':
        this.showHelp();
        break;
      case 'tree':
      case 'ls':
      case 'dir':
        this.showTree();
        break;
      case 'find':
      case 'search':
      case 'grep':
        this.search(args);
        break;
      case 'cd':
        this.cdCategory(args);
        break;
      case 'cat':
      case 'open':
      case 'view':
        this.viewSkill(args);
        break;
      case 'clear':
      case 'cls':
        this.clearOutput();
        break;
      case 'upload':
      case 'new':
        this.showUpload();
        break;
      case 'connect':
        Wallet.connect();
        break;
      case 'disconnect':
        Wallet.disconnect();
        break;
      case 'random':
        this.randomSkill();
        break;
      case 'top':
        this.topSkills(parseInt(args) || 10);
        break;
      case 'home':
        this.goHome();
        break;
      default:
        this.output(`command not found: ${command}`, 'dim');
        this.output(`type 'help' for available commands`, 'dim');
    }
  },

  showHelp() {
    this.clearOutput();
    this.output('Available commands:', 'bright');
    this.output('');
    this.output('  tree, ls        Show skill directory tree');
    this.output('  cd <category>   Browse category (security, llm, etc)');
    this.output('  find <query>    Search skills');
    this.output('  cat <name>      View skill details');
    this.output('  top [n]         Show top n downloaded skills');
    this.output('  random          Show a random skill');
    this.output('  upload          Upload a new skill');
    this.output('  connect         Connect Solana wallet');
    this.output('  clear           Clear output');
    this.output('  home            Go back to start');
    this.output('');
    this.output('Navigation:', 'dim');
    this.output('  Up/Down arrows to navigate tree');
    this.output('  Enter to select, Esc to go back');
  },

  showTree(category = null) {
    this.view = 'tree';
    this.selectedIndex = 0;
    this.treeExpanded = new Set(category ? [category] : []);
    
    this.buildTreeData(category);
    this.renderTree();
  },

  buildTreeData(filterCategory = null) {
    this.treeData = [];

    // Group skills by category
    const grouped = {};
    this.categories.forEach(cat => grouped[cat] = []);

    this.skills.forEach(skill => {
      const tags = (skill.tags || '').toLowerCase();
      let placed = false;
      
      for (const cat of this.categories) {
        if (cat !== 'other' && tags.includes(cat)) {
          grouped[cat].push(skill);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        grouped['other'].push(skill);
      }
    });

    // Build flat tree data
    const cats = filterCategory ? [filterCategory] : this.categories;
    
    cats.forEach((cat, catIndex) => {
      const skills = grouped[cat];
      if (skills.length === 0 && !filterCategory) return;

      const isLast = catIndex === cats.length - 1 || 
        cats.slice(catIndex + 1).every(c => grouped[c].length === 0);
      const isExpanded = this.treeExpanded.has(cat);

      this.treeData.push({
        type: 'category',
        id: cat,
        name: cat + '/',
        count: skills.length,
        prefix: isLast ? '└── ' : '├── ',
        isExpanded
      });

      if (isExpanded) {
        skills.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
        
        skills.forEach((skill, skillIndex) => {
          const isLastSkill = skillIndex === skills.length - 1;
          const linePrefix = isLast ? '    ' : '│   ';
          const itemPrefix = isLastSkill ? '└── ' : '├── ';
          const isOwned = this.purchases.some(p => p.skillId === skill.id);

          this.treeData.push({
            type: 'skill',
            id: skill.id,
            name: skill.title,
            skill: skill,
            prefix: linePrefix + itemPrefix,
            price: skill.price,
            downloads: skill.downloads || 0,
            isOwned
          });
        });
      }
    });
  },

  renderTree() {
    const output = document.getElementById('output');
    
    let html = `<div class="output-line dim">skills/</div>`;
    
    this.treeData.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;
      
      if (item.type === 'category') {
        const toggle = item.isExpanded ? '[-]' : '[+]';
        html += `
          <div class="tree-line ${isSelected ? 'selected' : ''}" data-index="${index}">
            <span class="tree-prefix">${item.prefix}</span>
            <span class="tree-name folder">${toggle} ${item.name}</span>
            <span class="tree-meta">(${item.count})</span>
          </div>
        `;
      } else {
        html += `
          <div class="tree-line ${isSelected ? 'selected' : ''}" data-index="${index}">
            <span class="tree-prefix">${item.prefix}</span>
            <span class="tree-name">${this.escapeHtml(item.name)}</span>
            <span class="tree-meta">
              ${item.isOwned ? '<span class="tree-owned">[owned]</span>' : ''}
              <span class="tree-price">${item.price === 0 ? 'free' : item.price + ' SOL'}</span>
              ${item.downloads}dl
            </span>
          </div>
        `;
      }
    });

    if (this.treeData.length === 0) {
      html += `<div class="output-line dim">  (empty)</div>`;
    }

    output.innerHTML = html;

    // Click handlers
    output.querySelectorAll('.tree-line').forEach(line => {
      line.addEventListener('click', () => {
        this.selectedIndex = parseInt(line.dataset.index);
        this.renderTree();
        this.selectTreeItem();
      });
    });
  },

  navigateTree(delta) {
    if (this.view !== 'tree' && this.view !== 'search') return;
    
    const maxIndex = this.treeData.length - 1;
    this.selectedIndex = Math.max(0, Math.min(maxIndex, this.selectedIndex + delta));
    this.renderTree();
    
    // Scroll selected into view
    const selected = document.querySelector('.tree-line.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  },

  selectTreeItem() {
    const item = this.treeData[this.selectedIndex];
    if (!item) return;

    if (item.type === 'category') {
      // Toggle expand/collapse
      if (this.treeExpanded.has(item.id)) {
        this.treeExpanded.delete(item.id);
      } else {
        this.treeExpanded.add(item.id);
      }
      this.buildTreeData();
      this.renderTree();
    } else if (item.type === 'skill') {
      this.showSkillDetail(item.skill);
    }
  },

  cdCategory(cat) {
    if (!cat) {
      this.showTree();
      return;
    }
    
    const category = this.categories.find(c => c.startsWith(cat.toLowerCase()));
    if (category) {
      this.showTree(category);
    } else {
      this.output(`category not found: ${cat}`, 'dim');
    }
  },

  search(query) {
    if (!query) {
      this.output('usage: find <search query>', 'dim');
      return;
    }

    this.view = 'search';
    this.selectedIndex = 0;

    const q = query.toLowerCase();
    const results = this.skills.filter(skill => {
      const text = `${skill.title} ${skill.description} ${skill.creator} ${skill.tags}`.toLowerCase();
      return text.includes(q);
    });

    this.treeData = results.map((skill, index) => {
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      return {
        type: 'skill',
        id: skill.id,
        name: skill.title,
        skill: skill,
        prefix: index === results.length - 1 ? '└── ' : '├── ',
        price: skill.price,
        downloads: skill.downloads || 0,
        isOwned
      };
    });

    this.clearOutput();
    this.output(`search results for "${query}": ${results.length} found`, 'dim');
    this.output('');
    this.renderTree();
  },

  viewSkill(name) {
    if (!name) {
      this.output('usage: cat <skill name>', 'dim');
      return;
    }

    const q = name.toLowerCase();
    const skill = this.skills.find(s => 
      s.title.toLowerCase().includes(q) || s.id === name
    );

    if (skill) {
      this.showSkillDetail(skill);
    } else {
      this.output(`skill not found: ${name}`, 'dim');
    }
  },

  showSkillDetail(skill) {
    this.view = 'skill';
    this.currentSkill = skill;
    const isOwned = this.purchases.some(p => p.skillId === skill.id);
    const tags = (skill.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    const output = document.getElementById('output');
    output.innerHTML = `
      <div class="skill-detail">
        <div class="skill-title">${this.escapeHtml(skill.title)}</div>
        <div class="skill-meta">
          <span>creator: ${this.escapeHtml(skill.creator)}</span>
          <span>price: ${skill.price === 0 ? 'free' : skill.price + ' SOL'}</span>
          <span>downloads: ${skill.downloads || 0}</span>
        </div>
        <div class="skill-desc">${this.escapeHtml(skill.description || 'No description.')}</div>
        <div class="skill-tags">
          ${tags.map(t => `<span class="skill-tag">${this.escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="skill-actions">
          ${isOwned 
            ? `<button class="action-btn success" id="downloadBtn">[download]</button>` 
            : `<button class="action-btn primary" id="purchaseBtn">[${Wallet.address ? 'purchase' : 'connect wallet'}]</button>`
          }
          <button class="action-btn" id="backBtn">[back]</button>
        </div>
        <div class="skill-status" id="skillStatus" hidden></div>
      </div>
    `;

    document.getElementById('backBtn').addEventListener('click', () => this.goBack());
    
    if (isOwned) {
      document.getElementById('downloadBtn').addEventListener('click', () => this.handleDownload());
    } else {
      document.getElementById('purchaseBtn').addEventListener('click', () => this.handlePurchase());
    }
  },

  topSkills(n) {
    const top = [...this.skills]
      .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
      .slice(0, n);

    this.view = 'search';
    this.selectedIndex = 0;
    
    this.treeData = top.map((skill, index) => {
      const isOwned = this.purchases.some(p => p.skillId === skill.id);
      return {
        type: 'skill',
        id: skill.id,
        name: skill.title,
        skill: skill,
        prefix: `${(index + 1).toString().padStart(2, ' ')}. `,
        price: skill.price,
        downloads: skill.downloads || 0,
        isOwned
      };
    });

    this.clearOutput();
    this.output(`top ${n} skills by downloads:`, 'dim');
    this.output('');
    this.renderTree();
  },

  randomSkill() {
    if (this.skills.length === 0) {
      this.output('no skills available', 'dim');
      return;
    }
    
    const skill = this.skills[Math.floor(Math.random() * this.skills.length)];
    this.showSkillDetail(skill);
  },

  goBack() {
    if (this.view === 'skill') {
      this.showTree();
    } else if (this.view === 'search') {
      this.showTree();
    } else if (this.view === 'upload') {
      this.hideUpload();
    } else {
      this.goHome();
    }
  },

  goHome() {
    this.view = 'home';
    document.getElementById('output').innerHTML = `
      <div class="output-line dim">Type 'tree' to browse skills, 'help' for commands</div>
    `;
    document.getElementById('hero').hidden = false;
  },

  clearOutput() {
    document.getElementById('output').innerHTML = '';
    document.getElementById('hero').hidden = true;
  },

  output(text, className = '') {
    const output = document.getElementById('output');
    const line = document.createElement('div');
    line.className = `output-line ${className}`;
    line.textContent = text;
    output.appendChild(line);
  },

  // === UPLOAD ===

  showUpload() {
    if (!Wallet.address) {
      this.output('connect wallet first: type "connect"', 'dim');
      return;
    }
    
    this.view = 'upload';
    document.getElementById('hero').hidden = true;
    document.getElementById('output').hidden = true;
    document.getElementById('uploadSection').hidden = false;
    document.getElementById('skillTitle').focus();
  },

  hideUpload() {
    document.getElementById('uploadSection').hidden = true;
    document.getElementById('output').hidden = false;
    this.view = 'home';
    document.getElementById('hero').hidden = false;
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
      document.getElementById('uploadForm').reset();
      this.hideUpload();
      await this.loadSkills();
      this.output('skill uploaded successfully', 'green');

    } catch (err) {
      console.error('Upload failed:', err);
      this.output(`upload failed: ${err.message}`, 'accent');
    }

    btn.textContent = '[submit]';
    btn.disabled = false;
  },

  // === PURCHASE/DOWNLOAD ===

  async handlePurchase() {
    if (!this.currentSkill) return;

    if (!Wallet.address) {
      await Wallet.connect();
      if (Wallet.address) {
        this.showSkillDetail(this.currentSkill);
      }
      return;
    }

    const statusEl = document.getElementById('skillStatus');
    const btn = document.getElementById('purchaseBtn');

    statusEl.hidden = false;
    statusEl.className = 'skill-status loading';
    statusEl.textContent = 'creating transaction...';
    btn.disabled = true;

    try {
      if (!this.currentSkill.creatorWallet) {
        throw new Error('creator has not set a wallet');
      }

      statusEl.textContent = 'confirm in phantom...';
      const sig = await Solana.executePurchase(
        this.currentSkill.creatorWallet,
        this.currentSkill.price
      );

      statusEl.textContent = 'recording purchase...';
      await API.createPurchase({
        buyerWallet: Wallet.address,
        skillId: this.currentSkill.id,
        txSignature: sig,
        pricePaid: this.currentSkill.price
      });

      statusEl.className = 'skill-status success';
      statusEl.textContent = 'purchase successful!';

      this.purchases.push({
        skillId: this.currentSkill.id,
        skillTitle: this.currentSkill.title,
        purchasedAt: new Date().toISOString()
      });

      // Refresh view
      setTimeout(() => this.showSkillDetail(this.currentSkill), 1000);

    } catch (err) {
      console.error('Purchase failed:', err);
      statusEl.className = 'skill-status error';
      statusEl.textContent = err.message || 'purchase failed';
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
      alert(err.message || 'download failed');
    }
  },

  // === DATA LOADING ===

  async loadSkills() {
    try {
      const data = await API.getSkills();
      this.skills = data.skills || [];
      document.getElementById('skillCount').textContent = this.skills.length;
    } catch (err) {
      console.error('Failed to load skills:', err);
      this.output('failed to load skills', 'accent');
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

  // === WALLET ===

  onWalletConnect(addr) {
    document.getElementById('walletInfo').textContent = Wallet.shortenAddress(addr);
    document.getElementById('walletInfo').classList.add('connected');
    document.getElementById('walletBtn').textContent = '[disconnect]';
    this.loadPurchases();
  },

  onWalletDisconnect() {
    document.getElementById('walletInfo').textContent = 'not connected';
    document.getElementById('walletInfo').classList.remove('connected');
    document.getElementById('walletBtn').textContent = '[connect]';
    this.purchases = [];
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
