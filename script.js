// API base URL
const API_URL = window.location.origin;

// State
let skills = [];
let walletAddress = null;
let uploadedFile = null;
let uploadedContent = '';
let myPurchases = []; // Skills owned by connected wallet
let agentApiKey = null; // Current agent API key (for session)
let currentSkill = null; // Currently viewing skill

// DOM Elements
const skillsGrid = document.getElementById('skillsGrid');
const searchInput = document.getElementById('skillSearch');
const statSkills = document.getElementById('statSkills');
const statCreators = document.getElementById('statCreators');
const statDownloads = document.getElementById('statDownloads');

// Wallet elements
const walletBtn = document.getElementById('walletBtn');
const walletNotice = document.getElementById('walletNotice');
const walletNoticeBtn = document.getElementById('walletNoticeBtn');
const uploadContainer = document.getElementById('uploadContainer');
const walletAddressEl = document.getElementById('walletAddress');

// Upload elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const filePreview = document.getElementById('filePreview');
const fileName = document.getElementById('fileName');
const fileContent = document.getElementById('fileContent');
const fileRemove = document.getElementById('fileRemove');
const uploadForm = document.getElementById('uploadForm');
const submitBtn = document.getElementById('submitBtn');
const uploadSuccess = document.getElementById('uploadSuccess');
const uploadAnother = document.getElementById('uploadAnother');

// My Skills elements
const mySkillsSection = document.getElementById('my-skills');
const mySkillsGrid = document.getElementById('mySkillsGrid');
const mySkillsEmpty = document.getElementById('mySkillsEmpty');
const generateKeyBtn = document.getElementById('generateKeyBtn');
const agentKeysPanel = document.getElementById('agentKeysPanel');
const agentKeysList = document.getElementById('agentKeysList');
const closeKeysPanel = document.getElementById('closeKeysPanel');
const createNewKeyBtn = document.getElementById('createNewKeyBtn');
const keyModal = document.getElementById('keyModal');
const newKeyDisplay = document.getElementById('newKeyDisplay');
const copyKeyBtn = document.getElementById('copyKeyBtn');
const closeKeyModal = document.getElementById('closeKeyModal');
const navAuthLinks = document.querySelectorAll('.nav-auth');

// Skill Modal elements
const skillModal = document.getElementById('skillModal');
const closeSkillModal = document.getElementById('closeSkillModal');
const modalTag = document.getElementById('modalTag');
const modalPrice = document.getElementById('modalPrice');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalCreator = document.getElementById('modalCreator');
const modalDownloads = document.getElementById('modalDownloads');
const purchaseBtn = document.getElementById('purchaseBtn');
const downloadBtn = document.getElementById('downloadBtn');
const purchaseStatus = document.getElementById('purchaseStatus');

// ============================================
// SKILLS API
// ============================================

async function fetchSkills() {
  try {
    const res = await fetch(`${API_URL}/api/skills`);
    const data = await res.json();
    
    if (data.success) {
      skills = data.data;
      renderSkills(skills);
      updateStats(data.stats);
    }
  } catch (err) {
    console.error('Error fetching skills:', err);
    skillsGrid.innerHTML = '<div class="loading">Failed to load skills. Make sure the server is running.</div>';
  }
}

function renderSkills(skillsToRender) {
  if (skillsToRender.length === 0) {
    skillsGrid.innerHTML = '<div class="loading">No skills found.</div>';
    return;
  }
  
  skillsGrid.innerHTML = skillsToRender.map(skill => {
    const isOwned = myPurchases.some(p => p.skillId === skill.id);
    return `
    <article class="skill-card pixel-box ${isOwned ? 'owned' : ''}" data-tags="${skill.tags}" data-id="${skill.id}">
      <div class="skill-header">
        <span class="skill-tag">${skill.tags.split(',')[0].trim()}</span>
        <span class="skill-price">${skill.price} SOL</span>
      </div>
      <h3>${skill.title}</h3>
      <p>${skill.description}</p>
      <div class="skill-footer">
        <span class="skill-creator">${skill.creator}</span>
        <button class="btn" onclick="viewSkill('${skill.id}')">${isOwned ? 'VIEW' : 'DETAILS'}</button>
      </div>
    </article>
  `}).join('');
}

function updateStats(stats) {
  statSkills.textContent = stats.total;
  statCreators.textContent = stats.creators;
  statDownloads.textContent = formatNumber(stats.downloads);
}

function formatNumber(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// View skill details
function viewSkill(id) {
  const skill = skills.find(s => s.id === id);
  if (!skill) return;
  
  currentSkill = skill;
  const isOwned = myPurchases.some(p => p.skillId === id);
  
  // Populate modal
  modalTag.textContent = skill.tags.split(',')[0].trim();
  modalPrice.textContent = skill.price + ' SOL';
  modalTitle.textContent = skill.title;
  modalDesc.textContent = skill.description;
  modalCreator.textContent = skill.creator;
  modalDownloads.textContent = skill.downloads || 0;
  
  // Show/hide buttons based on ownership
  if (isOwned) {
    purchaseBtn.hidden = true;
    downloadBtn.hidden = false;
  } else {
    purchaseBtn.hidden = false;
    downloadBtn.hidden = true;
    purchaseBtn.textContent = walletAddress ? 'PURCHASE' : 'CONNECT WALLET';
  }
  
  purchaseStatus.hidden = true;
  skillModal.hidden = false;
}

// Close skill modal
closeSkillModal.addEventListener('click', () => {
  skillModal.hidden = true;
  currentSkill = null;
});

// Click outside modal to close
skillModal.addEventListener('click', (e) => {
  if (e.target === skillModal) {
    skillModal.hidden = true;
    currentSkill = null;
  }
});

// Purchase button
purchaseBtn.addEventListener('click', async () => {
  if (!walletAddress) {
    connectWallet();
    return;
  }
  
  if (!currentSkill) return;
  
  // Show loading
  purchaseStatus.hidden = false;
  purchaseStatus.className = 'purchase-status loading';
  purchaseStatus.textContent = 'Processing purchase...';
  purchaseBtn.disabled = true;
  
  try {
    // For demo, simulate purchase by recording directly
    // In production, this would trigger Solana transaction first
    const res = await fetch(`${API_URL}/api/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buyerWallet: walletAddress,
        skillId: currentSkill.id,
        txSignature: 'demo_' + Date.now(), // Would be real tx sig
        pricePaid: currentSkill.price
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      purchaseStatus.className = 'purchase-status success';
      purchaseStatus.textContent = 'Purchase successful! You can now download.';
      
      // Update state
      myPurchases.push({
        purchaseId: data.data.id,
        skillId: currentSkill.id,
        title: currentSkill.title,
        purchasedAt: data.data.purchasedAt
      });
      
      // Update UI
      purchaseBtn.hidden = true;
      downloadBtn.hidden = false;
      renderSkills(skills);
      renderMySkills();
      fetchSkills(); // Refresh download count
    } else {
      purchaseStatus.className = 'purchase-status error';
      purchaseStatus.textContent = data.error || 'Purchase failed';
    }
  } catch (err) {
    console.error('Purchase error:', err);
    purchaseStatus.className = 'purchase-status error';
    purchaseStatus.textContent = 'Purchase failed. Please try again.';
  }
  
  purchaseBtn.disabled = false;
});

// Download button
downloadBtn.addEventListener('click', async () => {
  if (!currentSkill || !agentApiKey) {
    // Need to generate a key first
    await generateAgentKey();
    if (!agentApiKey) return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/skills/${currentSkill.id}/content`, {
      headers: { 'Authorization': `Bearer ${agentApiKey}` }
    });
    
    if (res.ok) {
      const content = await res.text();
      
      // Create download
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentSkill.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const data = await res.json();
      alert(data.error || 'Download failed');
    }
  } catch (err) {
    console.error('Download error:', err);
    alert('Download failed. Please try again.');
  }
});

// Search
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  const filtered = skills.filter(skill => {
    const text = `${skill.title} ${skill.description} ${skill.creator}`.toLowerCase();
    return text.includes(query) || skill.tags.toLowerCase().includes(query);
  });
  renderSkills(filtered);
});

// ============================================
// PHANTOM WALLET
// ============================================

function getProvider() {
  if ('phantom' in window) {
    const provider = window.phantom?.solana;
    if (provider?.isPhantom) {
      return provider;
    }
  }
  return null;
}

async function connectWallet() {
  const provider = getProvider();
  
  if (!provider) {
    window.open('https://phantom.app/', '_blank');
    return;
  }
  
  try {
    const resp = await provider.connect();
    walletAddress = resp.publicKey.toString();
    onWalletConnected();
  } catch (err) {
    console.error('Wallet connection failed:', err);
  }
}

function disconnectWallet() {
  const provider = getProvider();
  if (provider) {
    provider.disconnect();
  }
  walletAddress = null;
  agentApiKey = null;
  myPurchases = [];
  onWalletDisconnected();
}

async function onWalletConnected() {
  // Update header button
  walletBtn.classList.add('connected');
  walletBtn.querySelector('.wallet-text').textContent = shortenAddress(walletAddress);
  
  // Show upload form, hide notice
  walletNotice.hidden = true;
  uploadContainer.hidden = false;
  walletAddressEl.textContent = walletAddress;
  
  // Show My Skills nav link
  navAuthLinks.forEach(el => el.hidden = false);
  mySkillsSection.hidden = false;
  
  // Load purchases and generate temp API key
  await loadMyPurchases();
  
  // Re-render skills to show owned badges
  renderSkills(skills);
}

function onWalletDisconnected() {
  // Update header button
  walletBtn.classList.remove('connected');
  walletBtn.querySelector('.wallet-text').textContent = 'CONNECT WALLET';
  
  // Hide upload form, show notice
  walletNotice.hidden = false;
  uploadContainer.hidden = true;
  
  // Hide My Skills nav link
  navAuthLinks.forEach(el => el.hidden = true);
  mySkillsSection.hidden = true;
  
  // Re-render skills without owned badges
  renderSkills(skills);
}

function shortenAddress(address) {
  return address.slice(0, 4) + '...' + address.slice(-4);
}

// Wallet button click handler
walletBtn.addEventListener('click', () => {
  if (walletAddress) {
    disconnectWallet();
  } else {
    connectWallet();
  }
});

// Wallet notice button
walletNoticeBtn.addEventListener('click', connectWallet);

// Check for existing connection on load
async function checkExistingConnection() {
  const provider = getProvider();
  if (provider) {
    try {
      const resp = await provider.connect({ onlyIfTrusted: true });
      walletAddress = resp.publicKey.toString();
      onWalletConnected();
    } catch (err) {
      // Not connected, that's fine
    }
  }
}

// ============================================
// MY SKILLS / PURCHASES
// ============================================

async function loadMyPurchases() {
  // First, generate or retrieve API key
  await generateAgentKey();
  
  if (!agentApiKey) {
    mySkillsGrid.innerHTML = '<div class="loading">Failed to authenticate.</div>';
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/my-skills`, {
      headers: { 'Authorization': `Bearer ${agentApiKey}` }
    });
    
    const data = await res.json();
    
    if (data.success) {
      myPurchases = data.data;
      renderMySkills();
    }
  } catch (err) {
    console.error('Error loading purchases:', err);
    mySkillsGrid.innerHTML = '<div class="loading">Failed to load purchases.</div>';
  }
}

function renderMySkills() {
  if (myPurchases.length === 0) {
    mySkillsGrid.innerHTML = '';
    mySkillsEmpty.hidden = false;
    return;
  }
  
  mySkillsEmpty.hidden = true;
  mySkillsGrid.innerHTML = myPurchases.map(purchase => `
    <div class="my-skill-card pixel-box">
      <h3>${purchase.title}</h3>
      <div class="my-skill-meta">
        Purchased: ${new Date(purchase.purchasedAt).toLocaleDateString()}
      </div>
      <div class="my-skill-actions">
        <button class="btn btn-download" onclick="downloadSkill('${purchase.skillId}', '${purchase.title}')">DOWNLOAD</button>
        <button class="btn btn-secondary" onclick="viewSkill('${purchase.skillId}')">VIEW</button>
      </div>
    </div>
  `).join('');
}

async function downloadSkill(skillId, title) {
  if (!agentApiKey) {
    await generateAgentKey();
    if (!agentApiKey) return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/skills/${skillId}/content`, {
      headers: { 'Authorization': `Bearer ${agentApiKey}` }
    });
    
    if (res.ok) {
      const content = await res.text();
      
      // Create download
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const data = await res.json();
      alert(data.error || 'Download failed');
    }
  } catch (err) {
    console.error('Download error:', err);
    alert('Download failed. Please try again.');
  }
}

// ============================================
// AGENT API KEYS
// ============================================

async function generateAgentKey() {
  if (!walletAddress) return null;
  
  const provider = getProvider();
  if (!provider) return null;
  
  try {
    const message = `Skillstore Agent Key Request\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
    const encodedMessage = new TextEncoder().encode(message);
    
    const signedMessage = await provider.signMessage(encodedMessage, 'utf8');
    const signature = btoa(String.fromCharCode(...signedMessage.signature));
    
    const res = await fetch(`${API_URL}/api/agent-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: walletAddress,
        message,
        signature
      })
    });
    
    const data = await res.json();
    
    if (data.success && data.apiKey) {
      agentApiKey = data.apiKey;
      return agentApiKey;
    }
  } catch (err) {
    console.error('Failed to generate agent key:', err);
  }
  
  return null;
}

// Show agent keys panel
generateKeyBtn.addEventListener('click', async () => {
  agentKeysPanel.hidden = false;
  await loadAgentKeys();
});

// Close agent keys panel
closeKeysPanel.addEventListener('click', () => {
  agentKeysPanel.hidden = true;
});

// Create new key
createNewKeyBtn.addEventListener('click', async () => {
  const newKey = await generateAgentKey();
  
  if (newKey) {
    newKeyDisplay.textContent = newKey;
    keyModal.hidden = false;
    await loadAgentKeys();
  } else {
    alert('Failed to generate key. Please try again.');
  }
});

// Copy key to clipboard
copyKeyBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(newKeyDisplay.textContent).then(() => {
    copyKeyBtn.textContent = 'COPIED!';
    setTimeout(() => {
      copyKeyBtn.textContent = 'COPY';
    }, 2000);
  });
});

// Close key modal
closeKeyModal.addEventListener('click', () => {
  keyModal.hidden = true;
});

async function loadAgentKeys() {
  if (!agentApiKey) {
    await generateAgentKey();
  }
  
  if (!agentApiKey) {
    agentKeysList.innerHTML = '<div class="loading">Failed to authenticate.</div>';
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/api/agent-keys`, {
      headers: { 'Authorization': `Bearer ${agentApiKey}` }
    });
    
    const data = await res.json();
    
    if (data.success) {
      if (data.keys.length === 0) {
        agentKeysList.innerHTML = '<p style="color: var(--text-dim);">No API keys yet. Create one below.</p>';
      } else {
        agentKeysList.innerHTML = data.keys.map(key => `
          <div class="agent-key-item">
            <div class="agent-key-info">
              <span class="agent-key-value">${key.key}</span>
              <span class="agent-key-meta">
                Created: ${new Date(key.createdAt).toLocaleDateString()}
                ${key.lastUsed ? `• Last used: ${new Date(key.lastUsed).toLocaleDateString()}` : ''}
              </span>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error loading keys:', err);
    agentKeysList.innerHTML = '<div class="loading">Failed to load keys.</div>';
  }
}

// ============================================
// FILE UPLOAD
// ============================================

// Click to upload
dropzone.addEventListener('click', () => fileInput.click());

// Drag and drop
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.md')) {
    handleFile(file);
  }
});

// File input change
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) {
    handleFile(fileInput.files[0]);
  }
});

function handleFile(file) {
  uploadedFile = file;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedContent = e.target.result;
    
    // Show preview
    fileName.textContent = file.name;
    fileContent.textContent = uploadedContent.slice(0, 1000) + (uploadedContent.length > 1000 ? '\n...' : '');
    
    dropzone.hidden = true;
    filePreview.hidden = false;
    
    updateSubmitButton();
  };
  reader.readAsText(file);
}

// Remove file
fileRemove.addEventListener('click', () => {
  uploadedFile = null;
  uploadedContent = '';
  fileInput.value = '';
  
  dropzone.hidden = false;
  filePreview.hidden = true;
  
  updateSubmitButton();
});

// Update submit button state
function updateSubmitButton() {
  const title = document.getElementById('skillTitle').value.trim();
  const creator = document.getElementById('skillCreator').value.trim();
  const tags = document.getElementById('skillTags').value.trim();
  const price = document.getElementById('skillPrice').value;
  
  submitBtn.disabled = !(uploadedFile && title && creator && tags && price);
}

// Form input listeners
['skillTitle', 'skillCreator', 'skillTags', 'skillPrice'].forEach(id => {
  document.getElementById(id).addEventListener('input', updateSubmitButton);
});

// Form submission
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  submitBtn.disabled = true;
  submitBtn.textContent = 'UPLOADING...';
  
  const skillData = {
    title: document.getElementById('skillTitle').value.trim(),
    creator: document.getElementById('skillCreator').value.trim(),
    wallet: walletAddress,
    tags: document.getElementById('skillTags').value.trim(),
    price: parseFloat(document.getElementById('skillPrice').value),
    description: document.getElementById('skillDesc').value.trim() || 'No description provided.',
    content: uploadedContent
  };
  
  try {
    const res = await fetch(`${API_URL}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(skillData)
    });
    
    const data = await res.json();
    
    if (data.success) {
      // Show success
      document.querySelector('.upload-grid').hidden = true;
      document.querySelector('.wallet-connected').hidden = true;
      uploadSuccess.hidden = false;
      
      // Reset form
      uploadForm.reset();
      uploadedFile = null;
      uploadedContent = '';
      fileInput.value = '';
      dropzone.hidden = false;
      filePreview.hidden = true;
      
      // Refresh skills
      fetchSkills();
    } else {
      alert('Upload failed: ' + data.error);
    }
  } catch (err) {
    console.error('Upload error:', err);
    alert('Upload failed. Make sure the server is running.');
  }
  
  submitBtn.disabled = false;
  submitBtn.textContent = 'UPLOAD SKILL';
});

// Upload another
uploadAnother.addEventListener('click', () => {
  document.querySelector('.upload-grid').hidden = false;
  document.querySelector('.wallet-connected').hidden = false;
  uploadSuccess.hidden = true;
  updateSubmitButton();
});

// ============================================
// INIT
// ============================================

// Load skills on page load
fetchSkills();

// Check for existing wallet connection
checkExistingConnection();

// Make functions available globally
window.viewSkill = viewSkill;
window.downloadSkill = downloadSkill;
