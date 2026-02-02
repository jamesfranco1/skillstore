// API base URL
const API_URL = window.location.origin;

// State
let skills = [];
let walletAddress = null;
let uploadedFile = null;
let uploadedContent = '';

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
  
  skillsGrid.innerHTML = skillsToRender.map(skill => `
    <article class="skill-card pixel-box" data-tags="${skill.tags}" data-id="${skill.id}">
      <div class="skill-header">
        <span class="skill-tag">${skill.tags.split(',')[0].trim()}</span>
        <span class="skill-price">${skill.price} SOL</span>
      </div>
      <h3>${skill.title}</h3>
      <p>${skill.description}</p>
      <div class="skill-footer">
        <span class="skill-creator">${skill.creator}</span>
        <button class="btn" onclick="viewSkill('${skill.id}')">VIEW</button>
      </div>
    </article>
  `).join('');
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

async function viewSkill(id) {
  // Increment download count
  try {
    await fetch(`${API_URL}/api/skills/${id}/download`, { method: 'POST' });
    // Refresh skills to update count
    fetchSkills();
  } catch (err) {
    console.error('Error:', err);
  }
  
  // For now, just alert - could open a modal
  const skill = skills.find(s => s.id === id);
  if (skill) {
    alert(`${skill.title}\n\nCreator: ${skill.creator}\nPrice: ${skill.price} SOL\n\n${skill.description}`);
  }
}

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
  onWalletDisconnected();
}

function onWalletConnected() {
  // Update header button
  walletBtn.classList.add('connected');
  walletBtn.querySelector('.wallet-text').textContent = shortenAddress(walletAddress);
  
  // Show upload form, hide notice
  walletNotice.hidden = true;
  uploadContainer.hidden = false;
  walletAddressEl.textContent = walletAddress;
}

function onWalletDisconnected() {
  // Update header button
  walletBtn.classList.remove('connected');
  walletBtn.querySelector('.wallet-text').textContent = 'CONNECT WALLET';
  
  // Hide upload form, show notice
  walletNotice.hidden = false;
  uploadContainer.hidden = true;
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

// Make viewSkill available globally
window.viewSkill = viewSkill;
