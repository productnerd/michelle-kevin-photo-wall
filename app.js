/* Michelle & Kevin — party photo wall */

const STOCK = [
  { seed: 'mk01', cap: 'the culprits themselves 🎂' },
  { seed: 'mk02', cap: 'someone said open bar' },
  { seed: 'mk03', cap: "kevin's third slice" },
  { seed: 'mk04', cap: "michelle's happy tears" },
  { seed: 'mk05', cap: 'blurry but very happy' },
  { seed: 'mk06', cap: 'dance floor situation' },
  { seed: 'mk07', cap: 'cheers × one hundred' },
  { seed: 'mk15', cap: 'the dance floor, live 🎬', isVideo: true },
  { seed: 'mk08', cap: 'the confetti aftermath' },
  { seed: 'mk09', cap: '3am survivors club' },
  { seed: 'mk10', cap: 'the toast, take two' },
  { seed: 'mk11', cap: 'unsupervised balloon crew' },
  { seed: 'mk12', cap: 'cake > everything' },
  { seed: 'mk13', cap: 'the getaway car' },
  { seed: 'mk14', cap: 'best seats in the house' },
];

const PIN_COLORS = ['#8A5A38', '#DCCBA8', '#3B7A4A', '#2A2420'];

/** All photos on the wall, newest first. {src, cap, filename, stamp} */
const photos = STOCK.map((p, i) => ({
  src: `photos/${p.seed}.${p.isVideo ? 'mp4' : 'jpg'}?v=2`,
  cap: p.cap,
  filename: `michelle-kevin-${String(i + 1).padStart(2, '0')}.${p.isVideo ? 'mp4' : 'jpg'}`,
  stamp: "30 08 '26",
  isVideo: !!p.isVideo,
}));

const wall = document.getElementById('wall');
const loader = document.getElementById('loader');
const board = document.getElementById('board');
const fileInput = document.getElementById('fileInput');
const toast = document.getElementById('toast');

/* ---------- build the wall ---------- */

function rand(min, max) { return min + Math.random() * (max - min); }

function buildCard(photo, delaySec) {
  const fig = document.createElement('figure');
  fig.className = 'photo developing';
  const tilt = (Math.random() < 0.5 ? -1 : 1) * rand(1.2, 4.5);
  fig.style.setProperty('--tilt', `${tilt.toFixed(1)}deg`);
  fig.style.setProperty('--delay', `${delaySec.toFixed(2)}s`);
  fig.style.setProperty('--sway', `${rand(5, 9).toFixed(1)}s`);
  fig.style.setProperty('--pinx', `${rand(-16, 0).toFixed(0)}px`);
  fig.tabIndex = 0;
  fig.setAttribute('role', 'button');
  fig.setAttribute('aria-label', `View photo: ${photo.cap}`);

  const pin = document.createElement('span');
  pin.className = 'pin';
  pin.style.setProperty('--pin', PIN_COLORS[Math.floor(Math.random() * PIN_COLORS.length)]);

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

  const cap = document.createElement('figcaption');
  cap.textContent = photo.cap;

  paper.append(wrap, cap);
  fig.append(pin, paper);

  if (photo.isNew) {
    const sticker = document.createElement('span');
    sticker.className = 'sticker-new';
    sticker.textContent = 'NEW!';
    fig.append(sticker);
  }

  // swing on hover, but let the animation run to rest even after the
  // cursor leaves (class is only removed on animationend)
  fig.addEventListener('mouseenter', () => fig.classList.add('swinging'));
  paper.addEventListener('animationend', (e) => {
    if (e.animationName === 'hover-swing') fig.classList.remove('swinging');
  });

  fig._photo = photo;
  const open = () => openLightbox(photos.indexOf(photo));
  fig.addEventListener('click', open);
  fig.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  return fig;
}

photos.forEach((p, i) => wall.append(buildCard(p, 0.06 * i)));

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

function addFiles(files) {
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
    wall.prepend(buildCard(photo, 0.1 * i));
  });
  showToast(`${media.length} new pin${media.length > 1 ? 's' : ''} on the wall! (test mode: visible in this tab only for now)`, 5000);
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

const downloadAllBtn = document.getElementById('downloadAllBtn');
downloadAllBtn.addEventListener('click', async () => {
  if (typeof JSZip === 'undefined') {
    showToast('zip helper failed to load — try refreshing');
    return;
  }
  downloadAllBtn.disabled = true;
  const original = downloadAllBtn.innerHTML;
  try {
    const zip = new JSZip();
    let done = 0;
    await Promise.all(photos.map(async (p) => {
      try {
        zip.file(p.filename, await fetchBlob(p.src));
      } catch (e) {
        console.warn('skipping', p.filename, e);
      }
      done += 1;
      downloadAllBtn.textContent = `zipping… ${done}/${photos.length}`;
    }));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveBlob(blob, 'michelle-and-kevin-photo-wall.zip');
    showToast('the whole wall is coming your way 📦');
  } catch (e) {
    console.error(e);
    showToast('hmm, the zip jammed — try again?');
  } finally {
    downloadAllBtn.disabled = false;
    downloadAllBtn.innerHTML = original;
  }
});

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
  lbCaption.textContent = p.cap;
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
