/* ═══════════════════════════════════════════════
   인생네컷 – Photo Booth App Logic
   ══════════════════════════════════════════════ */

'use strict';

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
const state = {
  stream: null,
  shots: [null, null, null, null],   // ImageBitmap or ImageData per slot
  currentSlot: 0,
  isShooting: false,
  retakeIdx: null,                   // null = normal 4-shot, number = retake single
  selectedFrame: 'none',
  caption: '',
  mirror: true,
};

// ──────────────────────────────────────────────
// DOM references
// ──────────────────────────────────────────────
const screens = {
  landing: document.getElementById('screen-landing'),
  error:   document.getElementById('screen-error'),
  shoot:   document.getElementById('screen-shoot'),
  result:  document.getElementById('screen-result'),
};

const preview        = document.getElementById('preview');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNum   = document.getElementById('countdown-num');
const flashOverlay   = document.getElementById('flash-overlay');
const progressLabel  = document.getElementById('progress-label');
const hiddenCanvas   = document.getElementById('hidden-canvas');
const resultCanvas   = document.getElementById('result-canvas');

const btnStart       = document.getElementById('btn-start');
const btnRetry       = document.getElementById('btn-retry');
const btnShoot       = document.getElementById('btn-shoot');
const btnResetShots  = document.getElementById('btn-reset-shots');
const btnDownload    = document.getElementById('btn-download');
const btnRedo        = document.getElementById('btn-redo');
const chkMirror      = document.getElementById('chk-mirror');
const selTimer       = document.getElementById('sel-timer');
const selFrame       = document.getElementById('sel-frame');
const txtCaption     = document.getElementById('txt-caption');

const slots          = Array.from(document.querySelectorAll('.slot'));
const frameBtns      = Array.from(document.querySelectorAll('.frame-btn'));
const retakeBtns     = Array.from(document.querySelectorAll('.btn-retake'));

// ──────────────────────────────────────────────
// Screen navigation
// ──────────────────────────────────────────────
function showScreen(name) {
  Object.entries(screens).forEach(([k, el]) => {
    el.classList.toggle('active', k === name);
  });
}

// ──────────────────────────────────────────────
// Camera
// ──────────────────────────────────────────────
async function startCamera() {
  try {
    if (state.stream) stopCamera();
    const constraints = {
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    };
    state.stream = await navigator.mediaDevices.getUserMedia(constraints);
    preview.srcObject = state.stream;
    await new Promise(res => { preview.onloadedmetadata = res; });
    preview.play();
    applyMirror();
    showScreen('shoot');
  } catch (err) {
    console.error('Camera error:', err);
    document.getElementById('error-msg').textContent =
      err.name === 'NotAllowedError'
        ? '카메라 권한이 거부됐어요.\n브라우저 주소창의 카메라 아이콘을 눌러 허용해주세요.'
        : 'HTTPS 또는 localhost 환경에서 열어주세요.\n' + err.message;
    showScreen('error');
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
}

function applyMirror() {
  preview.classList.toggle('mirror', state.mirror);
}

// ──────────────────────────────────────────────
// Capture a single frame from the video to canvas
// Returns a canvas element (offscreen)
// ──────────────────────────────────────────────
function captureFrame() {
  const vw = preview.videoWidth;
  const vh = preview.videoHeight;
  const c  = document.createElement('canvas');
  c.width  = vw;
  c.height = vh;
  const ctx = c.getContext('2d');
  if (state.mirror) {
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(preview, 0, 0, vw, vh);
  return c;
}

// ──────────────────────────────────────────────
// Countdown helper
// ──────────────────────────────────────────────
function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

async function runCountdown(seconds) {
  if (seconds === 0) return;
  countdownOverlay.classList.remove('hidden');
  for (let i = seconds; i >= 1; i--) {
    countdownNum.textContent = i;
    // Re-trigger animation
    countdownNum.style.animation = 'none';
    void countdownNum.offsetWidth;
    countdownNum.style.animation = '';
    await wait(1000);
  }
  countdownOverlay.classList.add('hidden');
}

function triggerFlash() {
  flashOverlay.classList.remove('hidden', 'flash-anim');
  void flashOverlay.offsetWidth;
  flashOverlay.classList.add('flash-anim');
  setTimeout(() => flashOverlay.classList.add('hidden'), 400);
}

// ──────────────────────────────────────────────
// Slot UI helpers
// ──────────────────────────────────────────────
function setSlotImage(idx, canvas) {
  const slot = slots[idx];
  slot.querySelector('.slot-num').textContent = idx + 1;

  // Remove existing img if any
  const existing = slot.querySelector('img');
  if (existing) existing.remove();

  const img = document.createElement('img');
  img.src = canvas.toDataURL('image/jpeg', 0.85);
  img.alt = `컷 ${idx + 1}`;
  slot.appendChild(img);
  slot.classList.add('filled');

  let badge = slot.querySelector('.slot-retake-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'slot-retake-badge';
    badge.textContent = '재촬영';
    slot.appendChild(badge);
  }
}

function clearSlot(idx) {
  const slot = slots[idx];
  const img = slot.querySelector('img');
  if (img) img.remove();
  const badge = slot.querySelector('.slot-retake-badge');
  if (badge) badge.remove();
  slot.querySelector('.slot-num').textContent = idx + 1;
  slot.classList.remove('filled');
  state.shots[idx] = null;
}

function updateProgress() {
  const filled = state.shots.filter(Boolean).length;
  progressLabel.textContent = `${filled} / 4`;
}

// ──────────────────────────────────────────────
// Shoot sequence (single or 4-shot)
// ──────────────────────────────────────────────
async function shootSequence(startIdx, count) {
  if (state.isShooting) return;
  state.isShooting = true;
  btnShoot.disabled = true;

  const timerSecs = parseInt(selTimer.value, 10);

  for (let i = 0; i < count; i++) {
    const slotIdx = startIdx + i;
    if (slotIdx > 3) break;

    // Highlight current slot
    slots.forEach((s, j) => s.style.outline = j === slotIdx ? '3px solid #c961ff' : '');

    // countdown
    await runCountdown(timerSecs);

    // Snap
    triggerFlash();
    const frame = captureFrame();
    state.shots[slotIdx] = frame;
    setSlotImage(slotIdx, frame);
    updateProgress();

    await wait(250); // brief pause between shots
  }

  slots.forEach(s => s.style.outline = '');
  state.isShooting = false;
  btnShoot.disabled = false;
  state.retakeIdx = null;

  // If all 4 slots filled → go to result
  if (state.shots.every(Boolean)) {
    await wait(400);
    buildResult();
    showScreen('result');
  }
}

// ──────────────────────────────────────────────
// Frame color definitions
// ──────────────────────────────────────────────
const FRAMES = {
  none:   { bg: '#ffffff', border: '#ffffff', accent: '#ffffff', text: '#555' },
  pink:   { bg: '#fff0f8', border: '#f9a8d4', accent: '#ec4899', text: '#9d174d' },
  blue:   { bg: '#eff6ff', border: '#93c5fd', accent: '#3b82f6', text: '#1e40af' },
  gold:   { bg: '#fffbeb', border: '#fcd34d', accent: '#f59e0b', text: '#92400e' },
  dark:   { bg: '#111827', border: '#374151', accent: '#8b5cf6', text: '#e5e7eb' },
  spring: { bg: '#f0fdf4', border: '#86efac', accent: '#16a34a', text: '#14532d' },
};

// Strip layout constants
const STRIP_W       = 800;
const COL           = 2;
const ROW           = 2;
const PAD           = 28;          // padding around strip
const GAP           = 14;          // gap between cells
const CAPTION_H     = 54;          // extra space at bottom for caption
const BORDER_W      = 12;          // frame border thickness

// ──────────────────────────────────────────────
// Build the 2×2 result canvas
// ──────────────────────────────────────────────
function buildResult() {
  const frame  = FRAMES[state.selectedFrame] || FRAMES.none;
  const caption = (txtCaption.value || '').trim();

  // Cell size
  const cellW = (STRIP_W - PAD * 2 - BORDER_W * 2 - GAP * (COL - 1)) / COL;
  const cellH = cellW * 0.75;   // 4:3 per cell
  const stripH = PAD * 2 + BORDER_W * 2 + ROW * cellH + (ROW - 1) * GAP + (caption ? CAPTION_H : 0);

  resultCanvas.width  = STRIP_W;
  resultCanvas.height = stripH;

  const ctx = resultCanvas.getContext('2d');

  // Background
  ctx.fillStyle = frame.bg;
  ctx.fillRect(0, 0, STRIP_W, stripH);

  // Border decoration
  if (state.selectedFrame !== 'none') {
    ctx.strokeStyle = frame.border;
    ctx.lineWidth   = BORDER_W;
    ctx.strokeRect(BORDER_W / 2, BORDER_W / 2, STRIP_W - BORDER_W, stripH - BORDER_W);

    // Corner dots
    const dots = [
      [PAD, PAD], [STRIP_W - PAD, PAD],
      [PAD, stripH - PAD - (caption ? CAPTION_H : 0)],
      [STRIP_W - PAD, stripH - PAD - (caption ? CAPTION_H : 0)],
    ];
    ctx.fillStyle = frame.accent;
    dots.forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Draw each shot
  state.shots.forEach((canvas, i) => {
    if (!canvas) return;
    const col = i % COL;
    const row = Math.floor(i / COL);
    const x   = BORDER_W + PAD + col * (cellW + GAP);
    const y   = BORDER_W + PAD + row * (cellH + GAP);

    // Clip to cell roundrect
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, cellW, cellH, 10);
    ctx.clip();

    // Source image aspect-fill
    const sx = canvas.width;
    const sy = canvas.height;
    const srcAR = sx / sy;
    const dstAR = cellW / cellH;
    let sw, sh, dx, dy;
    if (srcAR > dstAR) {
      sh = sy;
      sw = sy * dstAR;
      dx = (sx - sw) / 2;
      dy = 0;
    } else {
      sw = sx;
      sh = sx / dstAR;
      dx = 0;
      dy = (sy - sh) / 2;
    }
    ctx.drawImage(canvas, dx, dy, sw, sh, x, y, cellW, cellH);
    ctx.restore();

    // Cell number badge
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath();
    roundRect(ctx, x + 8, y + 8, 28, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(i + 1, x + 22, y + 22);
  });

  // Caption
  if (caption) {
    const cy = stripH - CAPTION_H / 2 - (state.selectedFrame !== 'none' ? BORDER_W : 0);
    ctx.fillStyle = frame.accent;
    ctx.font = 'bold 22px "Noto Sans KR", Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(caption, STRIP_W / 2, cy);
  }

  // Watermark
  ctx.fillStyle = 'rgba(150,100,200,.55)';
  ctx.font = '13px Nunito, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('📷 인생네컷', STRIP_W - PAD, stripH - 8);
}

// ──────────────────────────────────────────────
// roundRect polyfill helper
// ──────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// ──────────────────────────────────────────────
// Download
// ──────────────────────────────────────────────
function downloadResult() {
  resultCanvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    const now  = new Date();
    const ts   = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    a.href     = url;
    a.download = `인생네컷_${ts}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/jpeg', 0.95);
}

// ──────────────────────────────────────────────
// Reset all shots
// ──────────────────────────────────────────────
function resetShots() {
  for (let i = 0; i < 4; i++) clearSlot(i);
  state.currentSlot = 0;
  updateProgress();
  btnShoot.querySelector('.shoot-label').textContent = '촬영 시작';
}

// ──────────────────────────────────────────────
// Event listeners
// ──────────────────────────────────────────────

// Landing → camera
btnStart.addEventListener('click', () => startCamera());
btnRetry.addEventListener('click', () => startCamera());

// Mirror toggle
chkMirror.addEventListener('change', () => {
  state.mirror = chkMirror.checked;
  applyMirror();
});

// Frame select (shoot screen) – sync to result
selFrame.addEventListener('change', () => {
  state.selectedFrame = selFrame.value;
  // Sync result frame buttons
  frameBtns.forEach(b => b.classList.toggle('active', b.dataset.frame === state.selectedFrame));
  if (document.getElementById('screen-result').classList.contains('active')) buildResult();
});

// Shoot button
btnShoot.addEventListener('click', () => {
  if (state.isShooting) return;
  const firstEmpty = state.shots.findIndex(s => !s);
  if (firstEmpty === -1) {
    // All filled – show result
    buildResult();
    showScreen('result');
    return;
  }
  shootSequence(firstEmpty, 4 - firstEmpty);
});

// Reset shots button
btnResetShots.addEventListener('click', () => {
  if (state.isShooting) return;
  resetShots();
});

// Slot click → retake that single slot
slots.forEach((slot, idx) => {
  slot.addEventListener('click', () => {
    if (state.isShooting) return;
    if (!state.shots[idx]) return; // empty – do nothing
    // Clear and retake just this one
    clearSlot(idx);
    updateProgress();
    state.retakeIdx = idx;
    shootSequence(idx, 1);
  });
});

// Result screen – frame picker
frameBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    state.selectedFrame = btn.dataset.frame;
    frameBtns.forEach(b => b.classList.toggle('active', b === btn));
    selFrame.value = state.selectedFrame;
    buildResult();
  });
});

// Caption input
txtCaption.addEventListener('input', () => {
  state.caption = txtCaption.value;
  buildResult();
});

// Retake individual shots from result screen
retakeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const idx = parseInt(btn.dataset.idx, 10);
    clearSlot(idx);
    updateProgress();
    state.retakeIdx = idx;
    showScreen('shoot');
    shootSequence(idx, 1);
  });
});

// Download
btnDownload.addEventListener('click', downloadResult);

// Full redo
btnRedo.addEventListener('click', () => {
  resetShots();
  showScreen('shoot');
});

// ──────────────────────────────────────────────
// Keyboard shortcut: Space = start/stop
// ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input, textarea')) {
    e.preventDefault();
    const shootScreen = document.getElementById('screen-shoot');
    if (shootScreen.classList.contains('active') && !state.isShooting) {
      btnShoot.click();
    }
  }
});

// ──────────────────────────────────────────────
// PWA Service Worker registration
// ──────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {/* offline optional */});
  });
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
showScreen('landing');
updateProgress();

// ──────────────────────────────────────────────
// Splash Modal
// ──────────────────────────────────────────────
(function initSplash() {
  const overlay   = document.getElementById('splash-modal');
  const closeBtn  = document.getElementById('splash-close');
  if (!overlay || !closeBtn) return;

  function closeSplash() {
    overlay.classList.add('hidden');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  }

  closeBtn.addEventListener('click', closeSplash);

  // 오버레이 배경 클릭 시에도 닫힘
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeSplash();
  });

  // ESC 키로도 닫힘
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.getElementById('splash-modal')) closeSplash();
  }, { once: true });
})();
