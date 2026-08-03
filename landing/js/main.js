/* ============================================================
   KUYFI LANDING — main.js
   Vanilla JS. No build step.
   ============================================================ */

const CONFIG = {
  WAITLIST_ENDPOINT: 'TODO_WAITLIST_ENDPOINT',  // set before publishing
  GITHUB_REPO: 'alex0tico/kuyfi_tui',
};

/* ─── GITHUB STARS ──────────────────────────────────────── */
async function fetchGitHubStars() {
  const els = document.querySelectorAll('[data-github-stars]');
  if (!els.length) return;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${CONFIG.GITHUB_REPO}`,
      { headers: { Accept: 'application/vnd.github.v3+json' } }
    );
    if (!res.ok) return;
    const { stargazers_count } = await res.json();
    const label = stargazers_count >= 1000
      ? `${(stargazers_count / 1000).toFixed(1)}k`
      : String(stargazers_count);
    els.forEach(el => { el.textContent = label; el.hidden = false; });
  } catch {
    /* silent — rate limit or network; stars badge simply stays hidden */
  }
}

/* ─── WAITLIST FORM ─────────────────────────────────────── */
function initWaitlistForms() {
  const forms = document.querySelectorAll('[data-waitlist-form]');
  forms.forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const input  = form.querySelector('[data-waitlist-email]');
      const submit = form.querySelector('[data-waitlist-submit]');
      const status = form.querySelector('[data-waitlist-status]');
      const email  = input.value.trim();

      clearStatus(status);

      if (!isValidEmail(email)) {
        showStatus(status, 'error', 'Please enter a valid email address.');
        input.focus();
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Submitting…';

      const isDemoMode = !CONFIG.WAITLIST_ENDPOINT ||
        CONFIG.WAITLIST_ENDPOINT === 'TODO_WAITLIST_ENDPOINT';

      if (isDemoMode) {
        await simulateDelay(600);
        showStatus(status, 'ok', `You're on the list — we'll reach out at ${email}.`);
        input.value = '';
        submit.textContent = 'Join Waitlist';
        submit.disabled = false;
        return;
      }

      try {
        const res = await fetch(CONFIG.WAITLIST_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showStatus(status, 'ok', `You're on the list — we'll reach out at ${email}.`);
        input.value = '';
      } catch {
        showStatus(status, 'error', 'Something went wrong. Try again later.');
      } finally {
        submit.textContent = 'Join Waitlist';
        submit.disabled = false;
      }
    });
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showStatus(el, type, msg) {
  el.textContent = msg;
  el.className = `email-form__status is-${type}`;
  el.setAttribute('role', 'alert');
}

function clearStatus(el) {
  el.textContent = '';
  el.className = 'email-form__status';
  el.removeAttribute('role');
}

function simulateDelay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ─── PROWLER PARALLAX ──────────────────────────────────── */
function initProwlerParallax() {
  const prowler = document.querySelector('.prowler-svg');
  const glyphs  = document.querySelectorAll('.glyph');
  if (!prowler) return;

  const SPEED = 0.25;
  let heroBottom = 0;

  function measure() {
    const hero = document.querySelector('.hero');
    if (hero) heroBottom = hero.getBoundingClientRect().bottom + window.scrollY;
  }

  measure();
  window.addEventListener('resize', measure, { passive: true });

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const progress = Math.min(y / (heroBottom || 1), 1);

      // Prowler drifts up as user scrolls into the hero
      prowler.style.transform = `translateY(${y * SPEED * -1}px)`;

      // Glyphs materialize and drift
      glyphs.forEach((g, i) => {
        const offset = i * 0.08;
        const op = Math.min(Math.max(progress - offset, 0) * 3, 1);
        const drift = y * (0.1 + i * 0.04) * -1;
        g.style.opacity = op;
        g.style.transform = `translateY(${drift}px)`;
      });

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ─── MARQUEE DUPLICATION (ensures seamless loop) ────────── */
function initMarquee() {
  const track = document.querySelector('.marquee-track');
  if (!track) return;
  const clone = track.cloneNode(true);
  track.parentElement.appendChild(clone);
}

/* ─── PHASE ACCORDION KEYBOARD ─────────────────────────── */
function initPhaseAccordion() {
  // <details>/<summary> handles it natively; just ensure first is open on load
  const first = document.querySelector('.phase details');
  if (first) first.open = true;
}

/* ─── GLYPH POSITIONING ─────────────────────────────────── */
function positionGlyphs() {
  const glyphs = document.querySelectorAll('.glyph');
  const positions = [
    { top: '12%',  left: '5%'  },
    { top: '28%',  left: '60%' },
    { top: '45%',  left: '8%'  },
    { top: '60%',  left: '72%' },
    { top: '72%',  left: '15%' },
    { top: '85%',  left: '55%' },
    { top: '20%',  left: '45%' },
    { top: '55%',  left: '38%' },
  ];
  glyphs.forEach((g, i) => {
    const pos = positions[i % positions.length];
    g.style.top  = pos.top;
    g.style.left = pos.left;
  });
}

/* ─── NAV SCROLL STATE ──────────────────────────────────── */
function initNavScroll() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  window.addEventListener('scroll', () => {
    nav.style.borderBottomColor = window.scrollY > 10
      ? 'rgba(255,255,255,0.1)'
      : 'rgba(255,255,255,0.04)';
  }, { passive: true });
}

/* ─── INIT ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  fetchGitHubStars();
  initWaitlistForms();
  initMarquee();
  initPhaseAccordion();
  positionGlyphs();
  initProwlerParallax();
  initNavScroll();
});
