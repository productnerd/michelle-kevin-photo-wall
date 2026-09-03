/* Michelle & Kevin — party photo wall */

const STOCK = [
  { seed: 'mk01', cap: 'the culprits themselves 🎂' },
  { seed: 'mk02', cap: '' },
  { seed: 'mk03', cap: "kevin's third slice" },
  { seed: 'mk04', cap: "michelle's happy tears" },
  { seed: 'mk05', cap: '' },
  { seed: 'mk06', cap: 'dance floor situation' },
  { seed: 'mk07', cap: 'cheers × one hundred' },
  { seed: 'mk15', cap: 'the dance floor, live 🎬', isVideo: true },
  { seed: 'mk08', cap: '' },
  { seed: 'mk09', cap: '3am survivors club' },
  { seed: 'mk10', cap: 'the toast, take two' },
  { seed: 'mk11', cap: '' },
  { seed: 'mk12', cap: 'cake > everything' },
  { seed: 'mk13', cap: '' },
  { seed: 'mk14', cap: 'best seats in the house' },
];

/** All photos on the wall, newest first. {src, cap, filename, stamp} */
const photos = STOCK.map((p, i) => ({
  src: `photos/${p.seed}.${p.isVideo ? 'mp4' : 'jpg'}?v=2`,
  cap: p.cap,
  filename: `michelle-kevin-${String(i + 1).padStart(2, '0')}.${p.isVideo ? 'mp4' : 'jpg'}`,
  stamp: "22 08 '26",
  isVideo: !!p.isVideo,
}));

/* shared storage — guest uploads live in a public Supabase bucket */
const SUPABASE_URL = 'https://knftyqkhampkqchoncel.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtuZnR5cWtoYW1wa3FjaG9uY2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDg4MzYsImV4cCI6MjA2NzAyNDgzNn0.fugiTRvgoD3YqAZPQMV3R6Eu0Wx_9vgE6ZK8zjqFutg';
const BUCKET = 'wall';
const sb = typeof supabase !== 'undefined'
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

const wall = document.getElementById('wall');
const loader = document.getElementById('loader');
const board = document.getElementById('board');
const fileInput = document.getElementById('fileInput');
const toast = document.getElementById('toast');

/* ---------- build the wall ---------- */

function buildCard(photo, delaySec) {
  const fig = document.createElement('figure');
  fig.className = 'photo developing';
  fig.style.setProperty('--delay', `${delaySec.toFixed(2)}s`);
  fig.tabIndex = 0;
  fig.setAttribute('role', 'button');
  fig.setAttribute('aria-label', `View photo: ${photo.cap || 'party photo'}`);

  const paper = document.createElement('div');
  paper.className = 'paper';

  const wrap = document.createElement('div');
  wrap.className = 'img-wrap';
  let media;
  if (photo.isVideo) {
    media = document.createElement('video');
    media.src = photo.src;
    media.muted = true;
    media.setAttribute('muted', '');
    media.playsInline = true;
    media.setAttribute('playsinline', '');
    media.autoplay = true;
    media.loop = true;
    media.setAttribute('aria-label', photo.cap);
    // long clips: loop just the first ~4.5s on the wall
    media.addEventListener('timeupdate', () => {
      if (media.currentTime > 4.5) media.currentTime = 0;
    });
  } else {
    media = document.createElement('img');
    media.src = photo.src;
    media.alt = photo.cap;
  }
  const stamp = document.createElement('span');
  stamp.className = 'stamp';
  stamp.textContent = photo.stamp;
  wrap.append(media, stamp);

  if (photo.cap) {
    const cap = document.createElement('figcaption');
    cap.textContent = photo.cap;
    paper.append(wrap, cap);
  } else {
    paper.classList.add('no-cap');
    paper.append(wrap);
  }
  fig.append(paper);

  if (photo.isNew) {
    const sticker = document.createElement('span');
    sticker.className = 'sticker-new';
    sticker.textContent = 'NEW!';
    fig.append(sticker);
  }

  // once developed, disable the entry animation so re-slotting into
  // columns (resize, new uploads) doesn't replay it
  fig.addEventListener('animationend', (e) => {
    if (e.animationName === 'develop') fig.classList.add('pinned');
  });

  fig._photo = photo;
  const open = () => openLightbox(photos.indexOf(photo));
  fig.addEventListener('click', open);
  fig.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  return fig;
}

/* explicit flex columns — Safari's CSS multicol leaves large voids when
   every item is break-inside: avoid, so we distribute cards ourselves */
const cards = [];
let colCount = 0;

function columnCountFor(width) {
  return width < 560 ? 2 : Math.min(4, Math.max(2, Math.floor(width / 300)));
}

function layoutWall() {
  colCount = columnCountFor(wall.clientWidth || document.documentElement.clientWidth);
  wall.innerHTML = '';
  const cols = Array.from({ length: colCount }, () => {
    const c = document.createElement('div');
    c.className = 'wall-col';
    return c;
  });
  wall.append(...cols);
  cards.forEach((card, i) => cols[i % colCount].append(card));
}

photos.forEach((p, i) => cards.push(buildCard(p, 0.06 * i)));
layoutWall();

window.addEventListener('resize', () => {
  if (columnCountFor(wall.clientWidth) !== colCount) layoutWall();
});

/* pull everyone's uploads from the shared bucket */
async function loadShared() {
  if (!sb) return;
  try {
    const { data, error } = await sb.storage.from(BUCKET)
      .list('uploads', { limit: 500, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) throw error;
    const items = (data || []).filter((f) => f.name && !f.name.startsWith('.'));
    // iterate oldest→newest so the newest ends up pinned first
    [...items].reverse().forEach((f, i) => {
      const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(f.name) ||
        String(f.metadata?.mimetype || '').startsWith('video/');
      const d = f.created_at ? new Date(f.created_at) : null;
      const photo = {
        src: sb.storage.from(BUCKET).getPublicUrl(`uploads/${f.name}`).data.publicUrl,
        cap: isVideo ? 'caught on tape 🎬' : 'fresh from your camera ✨',
        filename: `guest-${f.name.replace(/^\d+-\w+-/, '')}`,
        stamp: d ? `${String(d.getDate()).padStart(2, '0')} ${String(d.getMonth() + 1).padStart(2, '0')} '${String(d.getFullYear() % 100)}` : '',
        isVideo,
      };
      photos.unshift(photo);
      cards.unshift(buildCard(photo, 0.08 * (items.length - 1 - i)));
    });
    if (items.length) layoutWall();
  } catch (e) {
    console.warn('shared wall unavailable', e);
  }
}
loadShared();

/* ---------- loading: wait for the film to develop ---------- */

const firstImgs = [...wall.querySelectorAll('img')].slice(0, 8);
const decoded = firstImgs.map((img) =>
  img.complete ? Promise.resolve() : new Promise((res) => {
    img.addEventListener('load', res, { once: true });
    img.addEventListener('error', res, { once: true });
  })
);
Promise.race([
  Promise.all(decoded),
  new Promise((res) => setTimeout(res, 4500)),
]).then(() => setTimeout(reveal, 400));

function reveal() {
  board.hidden = false;
  layoutWall();   // clientWidth was 0 while hidden — recompute columns
  loader.classList.add('done');
  setTimeout(() => loader.remove(), 600);
}

/* ---------- toast ---------- */

let toastTimer;
function showToast(msg, ms = 3500) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, ms);
}

/* ---------- guest uploads (test mode: this tab only) ---------- */

document.getElementById('addBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  addFiles([...fileInput.files]);
  fileInput.value = '';
});

/* shrink big photos before upload — phone shots don't need to be 8MB */
async function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1500000) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size
      ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
      : file;
  } catch {
    return file;
  }
}

async function addFiles(files) {
  const media = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
  if (!media.length) return;
  const d = new Date();
  const stamp = `${String(d.getDate()).padStart(2, '0')} ${String(d.getMonth() + 1).padStart(2, '0')} '${String(d.getFullYear() % 100)}`;
  media.forEach((file, i) => {
    const isVideo = file.type.startsWith('video/');
    const photo = {
      src: URL.createObjectURL(file),
      cap: isVideo ? 'caught on tape 🎬' : 'fresh from your camera ✨',
      filename: `guest-${file.name.replace(/[^\w.\-]+/g, '_')}`,
      stamp,
      isNew: true,
      isVideo,
    };
    photos.unshift(photo);
    cards.unshift(buildCard(photo, 0.1 * i));
  });
  layoutWall();

  if (!sb) {
    showToast('offline — pinned in this tab only', 5000);
    return;
  }
  showToast('pinning to the shared wall…', 60000);
  let ok = 0;
  let failed = 0;
  await Promise.all(media.map(async (file) => {
    try {
      const upload = file.type.startsWith('image/') ? await compressImage(file) : file;
      const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${upload.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await sb.storage.from(BUCKET).upload(path, upload, { contentType: upload.type });
      if (error) throw error;
      ok += 1;
    } catch (e) {
      console.error('upload failed', e);
      failed += 1;
    }
  }));
  if (failed) {
    showToast(`${failed} upload${failed > 1 ? 's' : ''} didn't stick — only on this tab. try again?`, 6000);
  } else {
    showToast(`${ok} pinned for everyone! 📌`, 5000);
  }
}

/* ---------- downloads ---------- */

async function fetchBlob(src) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
  return res.blob();
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- background music (kaimakki-survey pattern) ---------- */

const MUSIC_KEY = 'mk_wall_music';
const MUSIC_VOL = 0.21;
const MUSIC_FADE_MS = 5000;
const musicBtn = document.getElementById('musicBtn');
const music = new Audio('music.mp3');
music.loop = true;
music.preload = 'auto';
music.volume = 0;
let musicFade = 0;
let musicOn = localStorage.getItem(MUSIC_KEY) !== 'off';

function musicRampTo(target, ms) {
  cancelAnimationFrame(musicFade);
  const from = music.volume;
  const started = performance.now();
  const step = (now) => {
    const t = ms === 0 ? 1 : Math.min(1, (now - started) / ms);
    const eased = t * t * (3 - 2 * t);   // smoothstep: gentle in and out
    music.volume = Math.max(0, Math.min(1, from + (target - from) * eased));
    if (t < 1) musicFade = requestAnimationFrame(step);
    else if (target === 0) music.pause();
  };
  musicFade = requestAnimationFrame(step);
}

function startMusic(ms) {
  music.volume = 0;
  return music.play().then(() => musicRampTo(MUSIC_VOL, ms));
}

function renderMusicBtn() {
  musicBtn.classList.toggle('muted', !musicOn);
  musicBtn.setAttribute('aria-pressed', String(musicOn));
  musicBtn.setAttribute('aria-label', musicOn ? 'Mute the music' : 'Unmute the music');
}

if (musicOn) {
  // Autoplay with sound is blocked until the page has been interacted
  // with, so this first attempt is expected to fail on a fresh visit —
  // the first click or key press starts it instead.
  startMusic(MUSIC_FADE_MS).catch(() => {
    const kick = () => {
      if (musicOn && music.paused) startMusic(MUSIC_FADE_MS).catch(() => {});
    };
    document.addEventListener('pointerdown', kick, { once: true });
    document.addEventListener('keydown', kick, { once: true });
  });
}

musicBtn.addEventListener('click', () => {
  musicOn = !musicOn;
  localStorage.setItem(MUSIC_KEY, musicOn ? 'on' : 'off');
  if (musicOn) startMusic(1800).catch(() => {});
  else musicRampTo(0, 1200);
  renderMusicBtn();
});
renderMusicBtn();

/* ---------- lightbox ---------- */

const lightbox = document.getElementById('lightbox');
const lbMedia = document.getElementById('lbMedia');
const lbCaption = document.getElementById('lbCaption');
let lbIndex = 0;

function openLightbox(index) {
  lbIndex = index;
  renderLightbox();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
  lbMedia.innerHTML = '';   // stops any playing video
}
function renderLightbox() {
  const p = photos[lbIndex];
  lbMedia.innerHTML = '';
  let el;
  if (p.isVideo) {
    el = document.createElement('video');
    el.src = p.src;
    el.controls = true;
    el.autoplay = true;
    el.loop = true;
    el.playsInline = true;
  } else {
    el = document.createElement('img');
    el.src = p.src;
    el.alt = p.cap;
  }
  lbMedia.append(el);
  lbCaption.textContent = p.cap || '';
  lbCaption.hidden = !p.cap;
}
function step(dir) {
  lbIndex = (lbIndex + dir + photos.length) % photos.length;
  renderLightbox();
}

document.getElementById('lbClose').addEventListener('click', closeLightbox);
document.getElementById('lbPrev').addEventListener('click', () => step(-1));
document.getElementById('lbNext').addEventListener('click', () => step(1));
document.getElementById('lbDownload').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const p = photos[lbIndex];
    saveBlob(await fetchBlob(p.src), p.filename);
  } catch (err) {
    console.error(err);
    showToast('download hiccup — try again?');
  } finally {
    btn.disabled = false;
  }
});
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
  if (lightbox.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') step(-1);
  if (e.key === 'ArrowRight') step(1);
});
