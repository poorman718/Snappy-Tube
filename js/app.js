/* =====================================================================
   YourTube — app.js
   All client-side functionality: theming, navigation, the three
   download modes, real-time download progress, history, blog/legal
   pages, toasts, ad integration, and small UI interactions.
   ===================================================================== */

(() => {
  'use strict';

  /* ===================================================================
     0. CONFIG — replace these for your own deployment
     =================================================================== */
  const AD_URL = 'https://example.com/ad-landing-page'; // <-- replace with your ad/monetization URL
  const API_VIDEO_INFO = '/api/youtube-download';        // single video info + download links
  const API_CHANNEL = '/api/youtube-channel';            // channel uploads list
  const BATCH_FETCH_DELAY = 1200;                        // ms between batch/channel detail fetches
  const CONCURRENT_DOWNLOADS = 3;                        // simultaneous downloads in batch/channel mode
  const HISTORY_TTL = 24 * 60 * 60 * 1000;               // 24 hours
  const HISTORY_KEY = 'yt_download_history';
  const THEME_KEY = 'yt_theme';

  /* ===================================================================
     1. DOM HELPERS
     =================================================================== */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ===================================================================
     2. TOASTS
     =================================================================== */
  const toastContainer = $('#toastContainer');

  function showToast(message, type = 'info', duration = 3500) {
    const icons = {
      success: 'fa-circle-check',
      error: 'fa-circle-exclamation',
      info: 'fa-circle-info',
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
  }

  /* ===================================================================
     3. THEME TOGGLE
     =================================================================== */
  const root = document.documentElement;

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function toggleTheme() {
    const current = root.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
  }

  (function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) {
      setTheme(saved);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  })();

  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#drawerThemeToggle').addEventListener('click', toggleTheme);

  /* ===================================================================
     4. MOBILE DRAWER
     =================================================================== */
  const drawer = $('#sideDrawer');
  const drawerOverlay = $('#drawerOverlay');

  function openDrawer() {
    drawer.classList.add('active');
    drawerOverlay.classList.add('active');
  }
  function closeDrawer() {
    drawer.classList.remove('active');
    drawerOverlay.classList.remove('active');
  }

  $('#hamburgerBtn').addEventListener('click', openDrawer);
  $('#drawerCloseBtn').addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  /* ===================================================================
     5. TOOLS NAV DROPDOWN
     =================================================================== */
  const toolsDropdownToggle = $('#toolsDropdownToggle');
  const toolsDropdownWrapper = toolsDropdownToggle.closest('.nav-dropdown');

  toolsDropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toolsDropdownWrapper.classList.toggle('open');
    toolsDropdownToggle.setAttribute('aria-expanded', toolsDropdownWrapper.classList.contains('open'));
  });

  document.addEventListener('click', (e) => {
    if (!toolsDropdownWrapper.contains(e.target)) {
      toolsDropdownWrapper.classList.remove('open');
      toolsDropdownToggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* ===================================================================
     6. PAGE NAVIGATION (Home / Q&A / Blog)
     =================================================================== */
  const heroSection = $('#heroSection');
  const stepsSection = $('#stepsSection');
  const qaSection = $('#qaSection');
  const blogPage = $('#blogPage');
  const backHomeBtn = $('#backHomeBtn');
  const historyPanel = $('#historyPanel');

  // All the "home" sections that should be visible together
  const homeSections = () => $$('#heroSection, #singleContainer, #batchContainer, #channelContainer, #resultCard, #historyPanel, #stepsSection, #qaSection');

  function showHome() {
    homeSections().forEach((el) => {
      // respect existing hidden states for input containers/result card —
      // only force-show hero, steps, qa and history (history governed separately)
      if (['heroSection', 'stepsSection', 'qaSection'].includes(el.id)) {
        el.hidden = false;
      }
    });
    // restore correct mode container visibility
    applyModeVisibility();
    refreshHistoryVisibility();
    blogPage.hidden = true;
    backHomeBtn.hidden = true;
    setActiveNav('home');
  }

  function showBlog() {
    heroSection.hidden = true;
    $('#singleContainer').hidden = true;
    $('#batchContainer').hidden = true;
    $('#channelContainer').hidden = true;
    $('#resultCard').hidden = true;
    historyPanel.hidden = true;
    stepsSection.hidden = true;
    qaSection.hidden = true;
    blogPage.hidden = false;
    backHomeBtn.hidden = false;
    setActiveNav('blog');
    loadBlogContent();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setActiveNav(name) {
    $$('.nav-link[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  }

  $$('[data-nav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = el.dataset.nav;
      if (target === 'blog') {
        e.preventDefault();
        showBlog();
        closeDrawer();
      } else if (target === 'home') {
        e.preventDefault();
        showHome();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        closeDrawer();
      } else if (target === 'qa') {
        // allow normal anchor scroll, but ensure we are on the home view
        if (!blogPage.hidden) {
          e.preventDefault();
          showHome();
          setTimeout(() => qaSection.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        closeDrawer();
      }
    });
  });

  $('#brandLink').addEventListener('click', (e) => { e.preventDefault(); showHome(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#drawerBrandLink').addEventListener('click', (e) => { e.preventDefault(); showHome(); closeDrawer(); });
  backHomeBtn.addEventListener('click', showHome);

  /* ===================================================================
     7. MODE SWITCH (Single / Batch / Channel)
     =================================================================== */
  const modeSwitch = $('.mode-switch');
  const modeDropdownToggle = $('#modeDropdownToggle');
  const modeDropdownMenu = $('#modeDropdownMenu');
  const modeLabel = $('#modeLabel');
  const modeIcon = $('.mode-icon');

  const modeMeta = {
    single: { label: 'Single Video Download', icon: 'fa-video' },
    batch: { label: 'Batch Download (multiple URLs)', icon: 'fa-layer-group' },
    channel: { label: 'Channel Download', icon: 'fa-tv' },
  };

  let currentMode = 'single';

  function applyModeVisibility() {
    $('#singleContainer').hidden = currentMode !== 'single';
    $('#batchContainer').hidden = currentMode !== 'batch';
    $('#channelContainer').hidden = currentMode !== 'channel';
  }

  function setMode(mode) {
    currentMode = mode;
    modeLabel.textContent = modeMeta[mode].label;
    modeIcon.className = `fa-solid ${modeMeta[mode].icon} mode-icon`;
    $$('.mode-option').forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
    applyModeVisibility();
    modeSwitch.classList.remove('open');
  }

  modeDropdownToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    modeSwitch.classList.toggle('open');
    modeDropdownToggle.setAttribute('aria-expanded', modeSwitch.classList.contains('open'));
  });

  $$('.mode-option').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  document.addEventListener('click', (e) => {
    if (!modeSwitch.contains(e.target)) {
      modeSwitch.classList.remove('open');
    }
  });

  /* ===================================================================
     8. URL VALIDATION HELPERS
     =================================================================== */
  const YT_VIDEO_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i;
  const YT_CHANNEL_REGEX = /youtube\.com\/(?:@[\w.-]+|channel\/[\w-]+|c\/[\w-]+|user\/[\w-]+)/i;

  function isValidYouTubeUrl(url) {
    return YT_VIDEO_REGEX.test((url || '').trim());
  }

  function isValidChannelUrl(url) {
    return YT_CHANNEL_REGEX.test((url || '').trim());
  }

  function extractVideoId(url) {
    const match = (url || '').match(YT_VIDEO_REGEX);
    return match ? match[1] : null;
  }

  /* ===================================================================
     9. AD INTEGRATION
     =================================================================== */
  function openAd() {
    try {
      window.open(AD_URL, '_blank');
    } catch (err) {
      /* popup blockers may prevent this — fail silently */
    }
  }

  /* ===================================================================
     10. API CALLS
     =================================================================== */
  async function fetchVideoInfo(url) {
    const res = await fetch(API_VIDEO_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function fetchChannelVideos(channelUrl) {
    const res = await fetch(API_CHANNEL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: channelUrl }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }
    return res.json();
  }

  /* ===================================================================
     11. DOWNLOAD HISTORY (localStorage, 24h TTL)
     =================================================================== */
  const historyList = $('#historyList');

  function loadHistory() {
    try {
      const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const now = Date.now();
      return raw.filter((item) => now - item.createdAt < HISTORY_TTL);
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  }

  function refreshHistoryVisibility() {
    const items = loadHistory();
    historyPanel.hidden = items.length === 0;
  }

  function renderHistory() {
    const items = loadHistory();
    historyPanel.hidden = items.length === 0;
    historyList.innerHTML = '';

    items
      .slice()
      .reverse()
      .forEach((item) => {
        const el = document.createElement('div');
        el.className = 'history-item';
        el.dataset.id = item.id;

        const progressHtml = item.completed
          ? `<span class="history-badge"><i class="fa-solid fa-circle-check"></i> Completed</span>`
          : `<div style="flex:1;min-width:120px;">
               <div class="history-progress-bar"><div class="history-progress-fill" style="width:${item.progress || 0}%"></div></div>
               <div class="history-progress-meta">
                 <span>${(item.loadedMb || 0).toFixed(1)} / ${(item.totalMb || 0).toFixed(1)} MB</span>
                 <span>${item.speed || '0 KB/s'}</span>
               </div>
             </div>`;

        el.innerHTML = `
          <img class="history-item-thumb" src="${item.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'">
          <div class="history-item-info">
            <div class="history-item-title">${escapeHtml(item.title || 'Untitled video')}</div>
            <div class="history-item-channel">${escapeHtml(item.channel || '')} &middot; ${item.type === 'audio' ? 'MP3' : 'Video'}</div>
          </div>
          ${item.completed ? progressHtml : ''}
          ${!item.completed ? progressHtml : ''}
          <button class="history-delete-btn" aria-label="Remove from history"><i class="fa-solid fa-trash"></i></button>
        `;

        el.querySelector('.history-delete-btn').addEventListener('click', () => {
          const updated = loadHistory().filter((h) => h.id !== item.id);
          saveHistory(updated);
          renderHistory();
        });

        historyList.appendChild(el);
      });
  }

  function addHistoryItem(data) {
    const items = loadHistory();
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: data.title,
      channel: data.channel,
      thumbnail: data.thumbnail,
      type: data.type || 'video',
      createdAt: Date.now(),
      completed: false,
      progress: 0,
      loadedMb: 0,
      totalMb: 0,
      speed: '0 KB/s',
    };
    items.push(entry);
    saveHistory(items);
    renderHistory();
    return entry.id;
  }

  function updateHistoryItem(id, patch) {
    const items = loadHistory();
    const idx = items.findIndex((h) => h.id === id);
    if (idx === -1) return;
    items[idx] = { ...items[idx], ...patch };
    saveHistory(items);
    renderHistory();
  }

  // Periodically prune expired items
  setInterval(() => {
    const before = loadHistory();
    const after = before.filter((item) => Date.now() - item.createdAt < HISTORY_TTL);
    if (after.length !== before.length) {
      saveHistory(after);
      renderHistory();
    }
  }, 60 * 1000);

  function escapeHtml(str = '') {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===================================================================
     12. DOWNLOAD WITH REAL-TIME PROGRESS
     =================================================================== */

  /**
   * Streams a file from `url`, updates `buttonEl`'s text every 0.5s with
   * size/speed info, and saves the resulting blob via an <a download>.
   * Also keeps an associated history item in sync.
   */
  async function downloadWithProgress(url, filename, buttonEl, historyId) {
    const originalHtml = buttonEl.innerHTML;
    const textSpan = buttonEl.querySelector('.btn-text') || buttonEl;
    buttonEl.disabled = true;

    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) {
        throw new Error('Download failed');
      }

      const contentLength = response.headers.get('Content-Length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body.getReader();

      let receivedBytes = 0;
      let lastTimestamp = performance.now();
      let lastBytes = 0;
      const chunks = [];

      let updateTimer = setInterval(() => {
        const now = performance.now();
        const elapsedSec = (now - lastTimestamp) / 1000 || 1;
        const bytesSinceLast = receivedBytes - lastBytes;
        const speedBytesPerSec = bytesSinceLast / elapsedSec;
        const speedLabel = formatSpeed(speedBytesPerSec);

        const totalMb = totalBytes / (1024 * 1024);
        const loadedMb = receivedBytes / (1024 * 1024);

        if (totalBytes) {
          textSpan.textContent = `${loadedMb.toFixed(1)} / ${totalMb.toFixed(1)} MB · ${speedLabel}`;
        } else {
          textSpan.textContent = `${loadedMb.toFixed(1)} MB · ${speedLabel}`;
        }

        if (historyId) {
          updateHistoryItem(historyId, {
            loadedMb,
            totalMb,
            speed: speedLabel,
            progress: totalBytes ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0,
          });
        }

        lastTimestamp = now;
        lastBytes = receivedBytes;
      }, 500);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
      }

      clearInterval(updateTimer);

      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      if (historyId) {
        updateHistoryItem(historyId, {
          completed: true,
          progress: 100,
          loadedMb: receivedBytes / (1024 * 1024),
          totalMb: totalBytes ? totalBytes / (1024 * 1024) : receivedBytes / (1024 * 1024),
        });
      }

      showToast('Download complete!', 'success');
    } catch (err) {
      showToast(`Download failed: ${err.message}`, 'error');
      if (historyId) {
        updateHistoryItem(historyId, { completed: true, progress: 0, speed: 'Failed' });
      }
    } finally {
      buttonEl.disabled = false;
      buttonEl.innerHTML = originalHtml;
    }
  }

  function formatSpeed(bytesPerSec) {
    if (!isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 KB/s';
    if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }

  function safeFilename(title, ext) {
    const cleaned = (title || 'video').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 80);
    return `${cleaned || 'video'}.${ext}`;
  }

  /* ===================================================================
     13. SINGLE VIDEO MODE
     =================================================================== */
  const singleUrlInput = $('#singleUrlInput');
  const singlePasteBtn = $('#singlePasteBtn');
  const singleError = $('#singleError');
  const resultCard = $('#resultCard');
  const resultPreview = $('#resultPreview');
  const resultTitle = $('#resultTitle');
  const resultChannel = $('#resultChannel');
  const downloadVideoBtn = $('#downloadVideoBtn');
  const downloadAudioBtn = $('#downloadAudioBtn');
  const newLinkBtn = $('#newLinkBtn');

  let currentVideoData = null;

  function showSingleError(message) {
    singleError.textContent = message;
    singleError.hidden = false;
  }
  function clearSingleError() {
    singleError.hidden = true;
    singleError.textContent = '';
  }

  function showResultCard(data) {
    currentVideoData = data;
    heroSection.hidden = true;
    $('#singleContainer').hidden = true;
    resultCard.hidden = false;

    const videoId = extractVideoId(data.url || singleUrlInput.value);

    if (videoId) {
      resultPreview.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}" title="${escapeHtml(data.title || '')}" allowfullscreen loading="lazy"></iframe>`;
    } else {
      resultPreview.innerHTML = `
        <img src="${data.thumbnail || ''}" alt="${escapeHtml(data.title || '')}" />
        <div class="play-overlay"><i class="fa-solid fa-circle-play"></i></div>
      `;
    }

    resultTitle.textContent = data.title || 'Untitled video';
    resultChannel.textContent = data.channel || '';

    downloadAudioBtn.hidden = !data.audioUrl;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetToInput() {
    resultCard.hidden = true;
    heroSection.hidden = false;
    $('#singleContainer').hidden = false;
    singleUrlInput.value = '';
    clearSingleError();
    currentVideoData = null;
  }

  newLinkBtn.addEventListener('click', resetToInput);

  // click title to copy
  resultTitle.addEventListener('click', async () => {
    if (!currentVideoData) return;
    try {
      await navigator.clipboard.writeText(currentVideoData.title || '');
      showToast('Title copied to clipboard', 'success');
    } catch {
      showToast('Could not copy title', 'error');
    }
  });

  async function handleSingleFetch(url) {
    clearSingleError();
    if (!isValidYouTubeUrl(url)) {
      showSingleError('Please enter a valid YouTube video URL.');
      return;
    }

    singlePasteBtn.disabled = true;
    const originalText = singlePasteBtn.querySelector('span').textContent;
    singlePasteBtn.querySelector('span').textContent = 'Fetching…';

    try {
      const data = await fetchVideoInfo(url);
      data.url = url;
      showResultCard(data);
    } catch (err) {
      showSingleError(err.message || 'Could not fetch video details. Please try again.');
    } finally {
      singlePasteBtn.disabled = false;
      singlePasteBtn.querySelector('span').textContent = originalText;
    }
  }

  // "Paste & Download" button: try clipboard first, fall back to typed value
  singlePasteBtn.addEventListener('click', async () => {
    let url = singleUrlInput.value.trim();

    try {
      const clipboardText = await navigator.clipboard.readText();
      if (isValidYouTubeUrl(clipboardText)) {
        url = clipboardText.trim();
        singleUrlInput.value = url;
      }
    } catch {
      /* clipboard access denied — fall back to typed value */
    }

    if (!url) {
      showSingleError('Paste a YouTube link or type one into the field above.');
      return;
    }

    handleSingleFetch(url);
  });

  // Auto-detect paste in the input field
  singleUrlInput.addEventListener('paste', () => {
    setTimeout(() => {
      const value = singleUrlInput.value.trim();
      if (isValidYouTubeUrl(value)) {
        handleSingleFetch(value);
      }
    }, 0);
  });

  // Single download buttons
  downloadVideoBtn.addEventListener('click', () => {
    if (!currentVideoData || !currentVideoData.downloadUrl) {
      showToast('No download link available for this video.', 'error');
      return;
    }
    openAd();
    const historyId = addHistoryItem({
      title: currentVideoData.title,
      channel: currentVideoData.channel,
      thumbnail: currentVideoData.thumbnail,
      type: 'video',
    });
    downloadWithProgress(
      currentVideoData.downloadUrl,
      safeFilename(currentVideoData.title, 'mp4'),
      downloadVideoBtn,
      historyId
    );
  });

  downloadAudioBtn.addEventListener('click', () => {
    if (!currentVideoData || !currentVideoData.audioUrl) {
      showToast('No audio link available for this video.', 'error');
      return;
    }
    openAd();
    const historyId = addHistoryItem({
      title: currentVideoData.title,
      channel: currentVideoData.channel,
      thumbnail: currentVideoData.thumbnail,
      type: 'audio',
    });
    downloadWithProgress(
      currentVideoData.audioUrl,
      safeFilename(currentVideoData.title, 'mp3'),
      downloadAudioBtn,
      historyId
    );
  });

  /* ===================================================================
     14. BATCH DOWNLOAD MODE
     =================================================================== */
  const batchUrlsInput = $('#batchUrlsInput');
  const batchFetchBtn = $('#batchFetchBtn');
  const batchError = $('#batchError');
  const batchProgressText = $('#batchProgressText');
  const batchVideoList = $('#batchVideoList');
  const batchListActions = $('#batchListActions');
  const batchDownloadBtn = $('#batchDownloadBtn');
  const batchDownloadProgress = $('#batchDownloadProgress');

  let batchItems = []; // { url, status: 'pending'|'ok'|'error', data, selected, el }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function renderVideoListItem(container, item, onRetry) {
    const el = document.createElement('div');
    el.className = 'video-item';

    if (item.status === 'ok') {
      el.innerHTML = `
        <input type="checkbox" class="video-item-checkbox" checked />
        <img class="video-item-thumb" src="${item.data.thumbnail || ''}" alt="" onerror="this.style.visibility='hidden'">
        <div class="video-item-info">
          <div class="video-item-title">${escapeHtml(item.data.title || 'Untitled video')}</div>
          <div class="video-item-channel">${escapeHtml(item.data.channel || '')}</div>
        </div>
      `;
      const checkbox = el.querySelector('.video-item-checkbox');
      checkbox.addEventListener('change', () => {
        item.selected = checkbox.checked;
      });
      item.selected = true;
    } else if (item.status === 'pending') {
      el.innerHTML = `
        <input type="checkbox" class="video-item-checkbox" disabled />
        <div class="video-item-thumb"></div>
        <div class="video-item-info">
          <div class="video-item-title">${escapeHtml(item.url)}</div>
          <div class="video-item-channel">Fetching…</div>
        </div>
      `;
    } else {
      el.innerHTML = `
        <input type="checkbox" class="video-item-checkbox" disabled />
        <div class="video-item-thumb"></div>
        <div class="video-item-info">
          <div class="video-item-title">${escapeHtml(item.url)}</div>
          <div class="video-item-channel">Failed to fetch</div>
        </div>
        <div class="video-item-status error">
          ❌ <button class="retry-btn">Retry</button>
        </div>
      `;
      el.querySelector('.retry-btn').addEventListener('click', () => onRetry(item, el));
    }

    item.el = el;
    container.appendChild(el);
    return el;
  }

  async function fetchSingleForList(item, retried = false) {
    try {
      const data = await fetchVideoInfo(item.url);
      item.status = 'ok';
      item.data = data;
    } catch (err) {
      if (!retried) {
        await sleep(800);
        return fetchSingleForList(item, true);
      }
      item.status = 'error';
    }
  }

  async function runFetchQueue(items, container, progressEl) {
    progressEl.hidden = false;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progressEl.textContent = `Fetching ${i + 1} of ${items.length} videos…`;

      // show a "fetching…" placeholder row first
      renderVideoListItem(container, item, retryItem);

      await fetchSingleForList(item);

      // re-render this item in place now that we know the result
      refreshListItem(container, item);

      if (i < items.length - 1) {
        await sleep(BATCH_FETCH_DELAY);
      }
    }

    progressEl.hidden = true;
  }

  // Rebuild a single item's DOM node in-place
  function refreshListItem(container, item) {
    const placeholder = document.createElement('div');
    renderVideoListItem(placeholder, item, retryItem);
    const newNode = placeholder.firstElementChild;
    if (item.el && item.el.parentNode === container) {
      container.replaceChild(newNode, item.el);
    } else {
      container.appendChild(newNode);
    }
    item.el = newNode;
  }

  async function retryItem(item, _el) {
    item.status = 'pending';
    refreshListItem(item.el.parentNode, item);
    await fetchSingleForList(item, false);
    refreshListItem(item.el.parentNode, item);
    updateListActionsVisibility();
  }

  function updateListActionsVisibility() {
    const anyOk = batchItems.some((i) => i.status === 'ok');
    batchListActions.hidden = !anyOk;
    channelListActions.hidden = !channelItems.some((i) => i.status === 'ok');
  }

  batchFetchBtn.addEventListener('click', async () => {
    batchError.hidden = true;
    const lines = batchUrlsInput.value
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      batchError.hidden = false;
      batchError.textContent = 'Paste at least one YouTube URL, one per line.';
      return;
    }

    const invalid = lines.filter((l) => !isValidYouTubeUrl(l));
    if (invalid.length === lines.length) {
      batchError.hidden = false;
      batchError.textContent = 'None of the pasted lines look like valid YouTube URLs.';
      return;
    }

    batchVideoList.innerHTML = '';
    batchItems = lines
      .filter((l) => isValidYouTubeUrl(l))
      .map((url) => ({ url, status: 'pending', selected: false, el: null }));

    if (invalid.length) {
      showToast(`Skipped ${invalid.length} invalid line(s).`, 'info');
    }

    batchFetchBtn.disabled = true;
    batchListActions.hidden = true;
    await runFetchQueue(batchItems, batchVideoList, batchProgressText);
    batchFetchBtn.disabled = false;
    updateListActionsVisibility();

    const okCount = batchItems.filter((i) => i.status === 'ok').length;
    showToast(`Fetched ${okCount} of ${batchItems.length} videos.`, okCount ? 'success' : 'error');
  });

  /* ---- concurrent downloads for batch/channel lists ---- */
  async function downloadSelectedFromList(items, progressLabelEl, downloadBtn) {
    const selected = items.filter((i) => i.status === 'ok' && i.selected && i.data);
    if (selected.length === 0) {
      showToast('Select at least one video to download.', 'error');
      return;
    }

    downloadBtn.disabled = true;
    let completed = 0;
    let failed = 0;
    let adOpened = false;

    progressLabelEl.textContent = `0 / ${selected.length} completed`;

    const queue = [...selected];

    async function worker() {
      while (queue.length) {
        const item = queue.shift();
        if (!adOpened) {
          openAd();
          adOpened = true;
        }

        const data = item.data;
        const historyId = addHistoryItem({
          title: data.title,
          channel: data.channel,
          thumbnail: data.thumbnail,
          type: 'video',
        });

        try {
          if (!data.downloadUrl) throw new Error('No download link');
          await downloadWithProgressSilent(data.downloadUrl, safeFilename(data.title, 'mp4'), historyId);
          completed++;
        } catch {
          failed++;
          updateHistoryItem(historyId, { completed: true, progress: 0, speed: 'Failed' });
        }

        progressLabelEl.textContent = `${completed + failed} / ${selected.length} completed`;
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENT_DOWNLOADS, selected.length) }, worker);
    await Promise.all(workers);

    downloadBtn.disabled = false;
    showToast(`Downloaded ${completed} of ${selected.length} videos${failed ? `, ${failed} failed` : ''}.`, failed ? 'info' : 'success');
  }

  // Variant of downloadWithProgress without a button (used for concurrent batch/channel downloads)
  async function downloadWithProgressSilent(url, filename, historyId) {
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error('Download failed');

    const contentLength = response.headers.get('Content-Length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
    const reader = response.body.getReader();

    let receivedBytes = 0;
    let lastTimestamp = performance.now();
    let lastBytes = 0;
    const chunks = [];

    const timer = setInterval(() => {
      const now = performance.now();
      const elapsedSec = (now - lastTimestamp) / 1000 || 1;
      const speed = formatSpeed((receivedBytes - lastBytes) / elapsedSec);
      updateHistoryItem(historyId, {
        loadedMb: receivedBytes / (1024 * 1024),
        totalMb: totalBytes / (1024 * 1024),
        speed,
        progress: totalBytes ? Math.min(100, (receivedBytes / totalBytes) * 100) : 0,
      });
      lastTimestamp = now;
      lastBytes = receivedBytes;
    }, 500);

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
      }
    } finally {
      clearInterval(timer);
    }

    const blob = new Blob(chunks);
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    updateHistoryItem(historyId, {
      completed: true,
      progress: 100,
      loadedMb: receivedBytes / (1024 * 1024),
      totalMb: totalBytes ? totalBytes / (1024 * 1024) : receivedBytes / (1024 * 1024),
    });
  }

  batchDownloadBtn.addEventListener('click', () => downloadSelectedFromList(batchItems, batchDownloadProgress, batchDownloadBtn));

  /* ===================================================================
     15. CHANNEL DOWNLOAD MODE
     =================================================================== */
  const channelUrlInput = $('#channelUrlInput');
  const channelFetchBtn = $('#channelFetchBtn');
  const channelError = $('#channelError');
  const channelProgressText = $('#channelProgressText');
  const channelVideoList = $('#channelVideoList');
  const channelListActions = $('#channelListActions');
  const channelDownloadBtn = $('#channelDownloadBtn');
  const channelDownloadProgress = $('#channelDownloadProgress');

  let channelItems = [];

  channelFetchBtn.addEventListener('click', async () => {
    channelError.hidden = true;
    const url = channelUrlInput.value.trim();

    if (!isValidChannelUrl(url)) {
      channelError.hidden = false;
      channelError.textContent = 'Please enter a valid YouTube channel URL (e.g. youtube.com/@channelname).';
      return;
    }

    channelFetchBtn.disabled = true;
    channelVideoList.innerHTML = '';
    channelListActions.hidden = true;
    channelProgressText.hidden = false;
    channelProgressText.textContent = 'Fetching channel videos…';

    try {
      const { videos } = await fetchChannelVideos(url);
      if (!videos || videos.length === 0) {
        throw new Error('No videos found for this channel.');
      }

      channelItems = videos.slice(0, 50).map((v) => ({
        url: typeof v === 'string' ? v : v.url,
        status: 'pending',
        selected: false,
        el: null,
      }));

      await runFetchQueue(channelItems, channelVideoList, channelProgressText);
      updateListActionsVisibility();

      const okCount = channelItems.filter((i) => i.status === 'ok').length;
      showToast(`Fetched ${okCount} of ${channelItems.length} videos.`, okCount ? 'success' : 'error');
    } catch (err) {
      channelProgressText.hidden = true;
      channelError.hidden = false;
      channelError.textContent = err.message || 'Could not fetch this channel.';
    } finally {
      channelFetchBtn.disabled = false;
    }
  });

  channelDownloadBtn.addEventListener('click', () => downloadSelectedFromList(channelItems, channelDownloadProgress, channelDownloadBtn));

  /* ===================================================================
     16. Q&A ACCORDION
     =================================================================== */
  $$('.qa-item').forEach((item) => {
    const question = item.querySelector('.qa-question');
    const answer = item.querySelector('.qa-answer');

    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');

      // close all
      $$('.qa-item').forEach((other) => {
        other.classList.remove('open');
        other.querySelector('.qa-question').setAttribute('aria-expanded', 'false');
        other.querySelector('.qa-answer').style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('open');
        question.setAttribute('aria-expanded', 'true');
        answer.style.maxHeight = `${answer.scrollHeight}px`;
      }
    });
  });

  /* ===================================================================
     17. STEP CARD SCROLL ANIMATIONS
     =================================================================== */
  const stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          stepObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  $$('.step-card').forEach((card) => stepObserver.observe(card));

  /* ===================================================================
     18. BLOG PAGE
     =================================================================== */
  const blogContent = $('#blogContent');
  let blogLoaded = false;

  async function loadBlogContent() {
    if (blogLoaded) return;
    try {
      const res = await fetch('/content/blog.html');
      if (!res.ok) throw new Error('Failed to load');
      blogContent.innerHTML = await res.text();
      blogLoaded = true;
    } catch {
      blogContent.innerHTML = '<p class="loading-text">Could not load articles right now. Please try again later.</p>';
    }
  }

  /* ===================================================================
     19. LEGAL / ABOUT MODALS
     =================================================================== */
  const modalOverlay = $('#modalOverlay');
  const modalBody = $('#modalBody');
  const modalClose = $('#modalClose');

  const modalSources = {
    disclaimer: '/content/disclaimer.html',
    privacy: '/content/privacy.html',
    terms: '/content/terms.html',
    about: '/content/about.html',
  };

  async function openModal(key) {
    modalBody.innerHTML = '<p class="loading-text">Loading…</p>';
    modalOverlay.classList.add('active');
    try {
      const res = await fetch(modalSources[key]);
      if (!res.ok) throw new Error('Failed to load');
      modalBody.innerHTML = await res.text();
    } catch {
      modalBody.innerHTML = '<p>Could not load this page right now. Please try again later.</p>';
    }
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  $$('[data-modal]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(el.dataset.modal);
    });
  });

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  /* ===================================================================
     20. INIT
     =================================================================== */
  setMode('single');
  applyModeVisibility();
  renderHistory();
})();
