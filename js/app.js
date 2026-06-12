// ========== Configuration ==========
const AD_URL = 'https://www.example.com/ad'; // Replace with your ad URL
const RAPIDAPI_KEY_FALLBACK = ''; // Set your key for development (not used in production)
const MAX_CONCURRENT_DOWNLOADS = 3;

// ========== DOM Elements ==========
const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const themeToggleDrawer = document.getElementById('themeToggleDrawer');
const hamburgerBtn = document.getElementById('hamburgerBtn');
const sideDrawer = document.getElementById('sideDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const backToHomeBtn = document.getElementById('backToHomeBtn');
const mainContent = document.getElementById('mainContent');
const homeSection = document.getElementById('homeSection');
const blogSection = document.getElementById('blogSection');
const blogContent = document.getElementById('blogContent');
const modeSelector = document.getElementById('modeSelector');
const modeBtn = modeSelector.querySelector('.mode-btn');
const modeDropdown = modeSelector.querySelector('.mode-dropdown');
const modeOptions = document.querySelectorAll('.mode-option');

// Input containers
const singleInput = document.getElementById('singleInput');
const batchInput = document.getElementById('batchInput');
const channelInput = document.getElementById('channelInput');

// Single elements
const singleUrl = document.getElementById('singleUrl');
const singleDownloadBtn = document.getElementById('singleDownloadBtn');
const singleError = document.getElementById('singleError');
const resultCard = document.getElementById('resultCard');
const resultPlayer = document.getElementById('resultPlayer');
const resultTitle = document.getElementById('resultTitle');
const resultChannel = document.getElementById('resultChannel');
const downloadHdBtn = document.getElementById('downloadHdBtn');
const downloadMp3Btn = document.getElementById('downloadMp3Btn');
const newLinkBtn = document.getElementById('newLinkBtn');

// Batch elements
const batchUrls = document.getElementById('batchUrls');
const batchFetchBtn = document.getElementById('batchFetchBtn');
const batchProgress = document.getElementById('batchProgress');
const batchList = document.getElementById('batchList');
const batchActions = document.getElementById('batchActions');
const batchDownloadSelectedBtn = document.getElementById('batchDownloadSelectedBtn');
const batchSummary = document.getElementById('batchSummary');

// Channel elements
const channelUrl = document.getElementById('channelUrl');
const channelFetchBtn = document.getElementById('channelFetchBtn');
const channelProgress = document.getElementById('channelProgress');
const channelList = document.getElementById('channelList');
const channelActions = document.getElementById('channelActions');
const channelDownloadSelectedBtn = document.getElementById('channelDownloadSelectedBtn');
const channelSummary = document.getElementById('channelSummary');

// History
const historySection = document.getElementById('historySection');
const historyList = document.getElementById('historyList');

// Steps animation
const stepCards = document.querySelectorAll('.step-card');
const qaItems = document.querySelectorAll('.qa-item');

// Toast & Modal
const toastContainer = document.getElementById('toastContainer');
const modalOverlay = document.getElementById('modalOverlay');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');

// ========== State ==========
let currentMode = 'single';
let currentVideoData = null; // single result
let batchVideos = [];
let channelVideos = [];
let downloadHistory = JSON.parse(localStorage.getItem('ytDownloadHistory') || '[]');
let adOpenedSession = false;
let activeDownloads = {};

// ========== Themes ==========
function setTheme(theme) {
  html.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  const icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
  themeToggle.innerHTML = `<i class="fas ${icon}"></i>`;
  if (themeToggleDrawer) {
    themeToggleDrawer.innerHTML = `<i class="fas ${icon}"></i> ${theme === 'dark' ? 'Light' : 'Dark'} Mode`;
  }
}

function toggleTheme() {
  const current = html.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setTheme(savedTheme);
themeToggle.addEventListener('click', toggleTheme);
themeToggleDrawer?.addEventListener('click', toggleTheme);

// ========== Side Drawer ==========
function openDrawer() {
  sideDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
}

function closeDrawer() {
  sideDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

hamburgerBtn.addEventListener('click', openDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// Drawer navigation links
document.querySelectorAll('.drawer-link[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navigateTo(page);
    closeDrawer();
  });
});

// ========== Mode Dropdown ==========
modeBtn.addEventListener('click', () => modeDropdown.classList.toggle('open'));
document.addEventListener('click', (e) => {
  if (!modeSelector.contains(e.target)) modeDropdown.classList.remove('open');
});

modeOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    currentMode = opt.dataset.mode;
    modeBtn.innerHTML = `${opt.innerHTML} <i class="fas fa-chevron-down"></i>`;
    modeDropdown.classList.remove('open');
    updateInputVisibility();
  });
});

function updateInputVisibility() {
  [singleInput, batchInput, channelInput].forEach(el => el.classList.remove('active'));
  if (currentMode === 'single') singleInput.classList.add('active');
  else if (currentMode === 'batch') batchInput.classList.add('active');
  else if (currentMode === 'channel') channelInput.classList.add('active');
}

// ========== Navigation ==========
function navigateTo(page) {
  if (page === 'blog') {
    homeSection.style.display = 'none';
    blogSection.style.display = 'block';
    backToHomeBtn.style.display = 'flex';
    loadBlog();
  } else {
    homeSection.style.display = 'block';
    blogSection.style.display = 'none';
    backToHomeBtn.style.display = 'none';
    if (page === 'qa') {
      document.getElementById('qaSection').scrollIntoView({ behavior: 'smooth' });
    }
  }
}

document.querySelectorAll('.nav-link[data-page], .footer-links a[data-page]').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo(link.dataset.page);
  });
});

backToHomeBtn.addEventListener('click', (e) => {
  e.preventDefault();
  navigateTo('home');
});

// ========== Blog Loading ==========
async function loadBlog() {
  if (blogContent.innerHTML !== '<div class="loading">Loading blog...</div>') return;
  try {
    const res = await fetch('/content/blog.html');
    if (res.ok) {
      blogContent.innerHTML = await res.text();
    } else {
      blogContent.innerHTML = '<p>Blog content not found.</p>';
    }
  } catch {
    blogContent.innerHTML = '<p>Failed to load blog.</p>';
  }
}

// ========== Modal (Legal Pages) ==========
function openModal(content) {
  modalContent.innerHTML = content;
  modalOverlay.style.display = 'flex';
}

function closeModal() {
  modalOverlay.style.display = 'none';
}

modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

document.querySelectorAll('.modal-link').forEach(link => {
  link.addEventListener('click', async (e) => {
    e.preventDefault();
    const page = link.dataset.modal;
    try {
      const res = await fetch(`/content/${page}.html`);
      if (res.ok) {
        const text = await res.text();
        openModal(text);
      }
    } catch {
      openModal('<p>Content not available.</p>');
    }
  });
});

// ========== Toast ==========
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  const icon = type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========== API Calls ==========
async function fetchVideoInfo(url) {
  try {
    const response = await fetch('/api/youtube-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch video');
    return data;
  } catch (err) {
    throw err;
  }
}

async function fetchChannelVideos(channelUrl) {
  try {
    const response = await fetch('/api/youtube-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: channelUrl })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch channel');
    return data.videos || [];
  } catch (err) {
    throw err;
  }
}

// ========== Download with Progress ==========
async function downloadFile(url, type, videoTitle, updateProgressCb) {
  // Return true if success
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Network error');
    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body.getReader();
    let received = 0;
    let chunks = [];
    let lastTime = Date.now();
    let lastReceived = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      if (timeDiff >= 0.5) {
        const speed = (received - lastReceived) / timeDiff;
        updateProgressCb(received, total, speed);
        lastTime = now;
        lastReceived = received;
      }
    }
    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const extension = type === 'mp3' ? 'mp3' : 'mp4';
    a.download = `${videoTitle || 'video'}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  } catch (err) {
    // Fallback: open in new tab (no progress)
    window.open(url, '_blank');
    return false;
  }
}

// ========== Single Video Download ==========
singleDownloadBtn.addEventListener('click', async () => {
  let url = singleUrl.value.trim();
  if (!url) {
    try {
      const clipText = await navigator.clipboard.readText();
      if (isValidYouTubeUrl(clipText)) url = clipText;
    } catch {}
  }
  if (!isValidYouTubeUrl(url)) {
    showError('Please paste a valid YouTube URL.');
    return;
  }
  await handleSingleDownload(url);
});

// Auto-detect paste
singleUrl.addEventListener('input', async (e) => {
  const val = e.target.value.trim();
  if (isValidYouTubeUrl(val)) {
    await handleSingleDownload(val);
  }
});

async function handleSingleDownload(url) {
  clearError();
  showLoading(singleDownloadBtn, true);
  try {
    const data = await fetchVideoInfo(url);
    currentVideoData = data;
    displayResult(data);
    hideHero();
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(singleDownloadBtn, false);
  }
}

function displayResult(data) {
  resultCard.style.display = 'block';
  const videoId = extractYouTubeId(data.url || singleUrl.value);
  resultPlayer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>`;
  resultTitle.textContent = data.title;
  resultTitle.title = 'Click to copy full title';
  resultChannel.textContent = data.channel;
  downloadHdBtn.dataset.url = data.downloads?.hd || data.url;
  downloadMp3Btn.dataset.url = data.downloads?.mp3 || '';
  downloadMp3Btn.style.display = data.downloads?.mp3 ? 'inline-flex' : 'none';
}

function hideHero() {
  document.querySelector('.hero').style.display = 'none';
}

function showHero() {
  document.querySelector('.hero').style.display = '';
  resultCard.style.display = 'none';
  currentVideoData = null;
}

newLinkBtn.addEventListener('click', showHero);

downloadHdBtn.addEventListener('click', () => startSingleDownload('hd'));
downloadMp3Btn.addEventListener('click', () => startSingleDownload('mp3'));

async function startSingleDownload(type) {
  if (!currentVideoData) return;
  if (!adOpenedSession) {
    window.open(AD_URL, '_blank');
    adOpenedSession = true;
  }
  const url = type === 'hd' ? currentVideoData.downloads?.hd : currentVideoData.downloads?.mp3;
  if (!url) {
    showToast('Download link not available', 'error');
    return;
  }
  const btn = type === 'hd' ? downloadHdBtn : downloadMp3Btn;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  let downloadEntry = addToHistory(currentVideoData, type);
  const updateProgress = (received, total, speed) => {
    const progress = total ? (received / total) * 100 : 0;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${formatBytes(received)}/${formatBytes(total)} · ${formatSpeed(speed)}`;
    updateHistoryProgress(downloadEntry.id, received, total, speed);
  };
  try {
    await downloadFile(url, type, currentVideoData.title, updateProgress);
    btn.innerHTML = originalText;
    btn.disabled = false;
    completeHistory(downloadEntry.id);
    showToast('Download complete!');
  } catch {
    btn.innerHTML = originalText;
    btn.disabled = false;
    failHistory(downloadEntry.id);
    showToast('Download failed', 'error');
  }
}

// ========== Batch Mode ==========
batchFetchBtn.addEventListener('click', async () => {
  const lines = batchUrls.value.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return showToast('Paste at least one URL', 'error');
  batchVideos = [];
  batchList.innerHTML = '';
  batchActions.style.display = 'none';
  batchProgress.style.display = 'block';
  for (let i = 0; i < lines.length; i++) {
    const url = lines[i].trim();
    batchProgress.textContent = `Fetching ${i + 1} of ${lines.length} videos…`;
    try {
      if (!isValidYouTubeUrl(url)) throw new Error('Invalid URL');
      const data = await fetchVideoInfo(url);
      batchVideos.push({ ...data, url, status: 'ok' });
    } catch (err) {
      batchVideos.push({ url, status: 'error', error: err.message });
    }
    // delay between requests
    if (i < lines.length - 1) await new Promise(resolve => setTimeout(resolve, 1200));
  }
  batchProgress.style.display = 'none';
  renderBatchList();
});

function renderBatchList() {
  batchList.innerHTML = batchVideos.map((vid, idx) => {
    const checked = vid.status === 'ok' ? 'checked' : '';
    const disabled = vid.status !== 'ok' ? 'disabled' : '';
    return `
      <div class="batch-item">
        <input type="checkbox" ${checked} ${disabled} data-index="${idx}">
        <img src="${vid.thumbnail || ''}" onerror="this.src='data:image/svg+xml,...'">
        <div class="info">
          <div class="title">${vid.title || vid.url}</div>
          <div class="channel">${vid.channel || ''}</div>
        </div>
        ${vid.status === 'error' ? `<button class="retry-btn" data-index="${idx}">❌ Retry</button>` : ''}
      </div>
    `;
  }).join('');

  batchActions.style.display = 'flex';
  document.querySelectorAll('.batch-item .retry-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = e.target.dataset.index;
      await retryBatchVideo(idx);
    });
  });
}

async function retryBatchVideo(idx) {
  const vid = batchVideos[idx];
  try {
    const data = await fetchVideoInfo(vid.url);
    batchVideos[idx] = { ...data, url: vid.url, status: 'ok' };
  } catch (err) {
    batchVideos[idx].error = err.message;
  }
  renderBatchList();
}

batchDownloadSelectedBtn.addEventListener('click', () => startBatchDownload());

async function startBatchDownload() {
  const checkboxes = batchList.querySelectorAll('input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return showToast('Select at least one video', 'error');
  if (!adOpenedSession) {
    window.open(AD_URL, '_blank');
    adOpenedSession = true;
  }
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
  batchDownloadSelectedBtn.disabled = true;
  let completed = 0;
  const total = selectedIndices.length;
  const queue = selectedIndices.slice();
  const running = new Set();

  const updateSummary = () => {
    batchSummary.textContent = `Downloaded ${completed} of ${total}`;
  };
  updateSummary();

  const worker = async (idx) => {
    const vid = batchVideos[idx];
    const downloadEntry = addToHistory(vid, 'hd');
    try {
      const url = vid.downloads?.hd || vid.url;
      await downloadFile(url, 'hd', vid.title, (received, total, speed) => {
        updateHistoryProgress(downloadEntry.id, received, total, speed);
      });
      completeHistory(downloadEntry.id);
      completed++;
      updateSummary();
    } catch {
      failHistory(downloadEntry.id);
    }
  };

  const processNext = async () => {
    if (queue.length === 0) return;
    const idx = queue.shift();
    running.add(idx);
    await worker(idx);
    running.delete(idx);
    await processNext();
  };

  const concurrency = Math.min(MAX_CONCURRENT_DOWNLOADS, queue.length);
  const tasks = Array(concurrency).fill().map(() => processNext());
  await Promise.all(tasks);
  batchDownloadSelectedBtn.disabled = false;
  showToast(`Batch download finished: ${completed} of ${total} successful`);
}

// ========== Channel Mode ==========
channelFetchBtn.addEventListener('click', async () => {
  const url = channelUrl.value.trim();
  if (!url) return showToast('Enter a channel URL', 'error');
  channelVideos = [];
  channelList.innerHTML = '';
  channelActions.style.display = 'none';
  channelProgress.style.display = 'block';
  channelProgress.textContent = 'Fetching channel videos…';
  try {
    const videoUrls = await fetchChannelVideos(url);
    channelProgress.textContent = `Found ${videoUrls.length} videos. Fetching details…`;
    for (let i = 0; i < videoUrls.length; i++) {
      channelProgress.textContent = `Fetching details ${i + 1} of ${videoUrls.length}`;
      try {
        const data = await fetchVideoInfo(videoUrls[i]);
        channelVideos.push({ ...data, url: videoUrls[i], status: 'ok' });
      } catch {
        channelVideos.push({ url: videoUrls[i], status: 'error' });
      }
      if (i < videoUrls.length - 1) await new Promise(r => setTimeout(r, 1200));
    }
    channelProgress.style.display = 'none';
    renderChannelList();
  } catch (err) {
    channelProgress.style.display = 'none';
    showToast(err.message, 'error');
  }
});

function renderChannelList() {
  channelList.innerHTML = channelVideos.map((vid, idx) => {
    const checked = vid.status === 'ok' ? 'checked' : '';
    const disabled = vid.status !== 'ok' ? 'disabled' : '';
    return `
      <div class="batch-item">
        <input type="checkbox" ${checked} ${disabled} data-index="${idx}">
        <img src="${vid.thumbnail || ''}" onerror="this.src='data:image/svg+xml,...'">
        <div class="info">
          <div class="title">${vid.title || vid.url}</div>
          <div class="channel">${vid.channel || ''}</div>
        </div>
        ${vid.status === 'error' ? `<button class="retry-btn" data-index="${idx}">❌ Retry</button>` : ''}
      </div>
    `;
  }).join('');
  channelActions.style.display = 'flex';
  document.querySelectorAll('#channelList .retry-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = e.target.dataset.index;
      await retryChannelVideo(idx);
    });
  });
}

async function retryChannelVideo(idx) {
  const vid = channelVideos[idx];
  try {
    const data = await fetchVideoInfo(vid.url);
    channelVideos[idx] = { ...data, url: vid.url, status: 'ok' };
  } catch {
    channelVideos[idx].error = 'Failed';
  }
  renderChannelList();
}

channelDownloadSelectedBtn.addEventListener('click', async () => {
  const checkboxes = channelList.querySelectorAll('input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return showToast('Select at least one video', 'error');
  if (!adOpenedSession) {
    window.open(AD_URL, '_blank');
    adOpenedSession = true;
  }
  const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
  channelDownloadSelectedBtn.disabled = true;
  let completed = 0;
  const total = selectedIndices.length;
  const queue = selectedIndices.slice();
  const updateSummary = () => {
    channelSummary.textContent = `Downloaded ${completed} of ${total}`;
  };
  updateSummary();

  const worker = async (idx) => {
    const vid = channelVideos[idx];
    const downloadEntry = addToHistory(vid, 'hd');
    try {
      const url = vid.downloads?.hd || vid.url;
      await downloadFile(url, 'hd', vid.title, (received, total, speed) => {
        updateHistoryProgress(downloadEntry.id, received, total, speed);
      });
      completeHistory(downloadEntry.id);
      completed++;
      updateSummary();
    } catch {
      failHistory(downloadEntry.id);
    }
  };

  const processNext = async () => {
    if (queue.length === 0) return;
    const idx = queue.shift();
    await worker(idx);
    await processNext();
  };

  const concurrency = Math.min(MAX_CONCURRENT_DOWNLOADS, queue.length);
  const tasks = Array(concurrency).fill().map(() => processNext());
  await Promise.all(tasks);
  channelDownloadSelectedBtn.disabled = false;
  showToast(`Channel download finished: ${completed} of ${total} successful`);
});

// ========== History ==========
function addToHistory(video, type) {
  const id = Date.now().toString() + Math.random();
  const entry = {
    id,
    title: video.title || video.url,
    channel: video.channel || '',
    thumbnail: video.thumbnail || '',
    type,
    received: 0,
    total: 0,
    speed: 0,
    status: 'downloading',
    timestamp: Date.now()
  };
  downloadHistory.push(entry);
  saveHistory();
  renderHistory();
  return entry;
}

function updateHistoryProgress(id, received, total, speed) {
  const entry = downloadHistory.find(e => e.id === id);
  if (!entry) return;
  entry.received = received;
  entry.total = total;
  entry.speed = speed;
  saveHistory();
  renderHistory();
}

function completeHistory(id) {
  const entry = downloadHistory.find(e => e.id === id);
  if (entry) entry.status = 'completed';
  saveHistory();
  renderHistory();
}

function failHistory(id) {
  const entry = downloadHistory.find(e => e.id === id);
  if (entry) entry.status = 'failed';
  saveHistory();
  renderHistory();
}

function deleteHistory(id) {
  downloadHistory = downloadHistory.filter(e => e.id !== id);
  saveHistory();
  renderHistory();
}

function saveHistory() {
  localStorage.setItem('ytDownloadHistory', JSON.stringify(downloadHistory));
}

function renderHistory() {
  // auto-delete entries older than 24h
  const now = Date.now();
  downloadHistory = downloadHistory.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);
  saveHistory();
  if (downloadHistory.length === 0) {
    historySection.style.display = 'none';
    return;
  }
  historySection.style.display = 'block';
  historyList.innerHTML = downloadHistory.map(entry => `
    <div class="history-item">
      <img src="${entry.thumbnail || ''}" onerror="this.style.display='none'">
      <div style="flex:1">
        <div class="title">${entry.title}</div>
        <div class="channel">${entry.channel}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${entry.total ? (entry.received/entry.total)*100 : 0}%"></div>
        </div>
        <div style="font-size:0.8rem;">${formatBytes(entry.received)} / ${formatBytes(entry.total)} · ${formatSpeed(entry.speed)}</div>
        ${entry.status === 'completed' ? '<span class="badge" style="background:var(--primary);color:white;">✅ Completed</span>' : ''}
      </div>
      <button class="delete-btn" data-id="${entry.id}"><i class="fas fa-trash"></i></button>
    </div>
  `).join('');

  document.querySelectorAll('.history-item .delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteHistory(btn.dataset.id));
  });
}

// ========== Helpers ==========
function isValidYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]{11}/.test(url);
}

function extractYouTubeId(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return match ? match[1] : '';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
  return formatBytes(bytesPerSec) + '/s';
}

function showLoading(btn, loading) {
  btn.disabled = loading;
  btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> Loading...' : btn.dataset.originalText || btn.innerHTML;
  if (!loading) btn.dataset.originalText = '';
}

function showError(msg) {
  singleError.textContent = msg;
  singleError.style.display = 'block';
}

function clearError() {
  singleError.style.display = 'none';
}

// ========== Scroll Animations ==========
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.2 });

stepCards.forEach(card => observer.observe(card));

// ========== Q&A Accordion ==========
document.querySelectorAll('.qa-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const answer = btn.nextElementSibling;
    answer.classList.toggle('open');
    btn.querySelector('i').classList.toggle('fa-chevron-up');
  });
});

// ========== Initial history render ==========
renderHistory();
