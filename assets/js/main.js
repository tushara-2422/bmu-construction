/* =========================================================
   BMU | site interactions (vanilla JS, no dependencies)
   ========================================================= */
(() => {
  'use strict';

  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const reflow = (el) => void el.offsetWidth;

  /* ---------------------------------------------------------
     Reveal on scroll
     --------------------------------------------------------- */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px 8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  /* ---------------------------------------------------------
     Count-up numbers (Indian digit grouping)
     --------------------------------------------------------- */
  function runCounter(el) {
    const end = parseFloat(el.dataset.count);
    if (reduceMotion) { el.textContent = end.toLocaleString('en-IN'); return; }
    const start = performance.now();
    const dur = 1600;
    const step = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
    });
  }, { threshold: 0.5 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  /* ---------------------------------------------------------
     Nav
     --------------------------------------------------------- */
  const nav = $('#nav');
  const toggle = $('.nav__toggle');
  const menu = $('#menu');
  let menuOpen = false;
  let lastY = window.scrollY;

  function setMenu(open) {
    menuOpen = open;
    body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
    body.style.overflow = open ? 'hidden' : '';
  }
  toggle.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  const navLinks = $$('.nav__links a');
  const navTargets = navLinks.map((a) => $(a.getAttribute('href')));
  function updateNav() {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 40);
    nav.classList.toggle('is-hidden', y > lastY && y > 700 && !menuOpen);
    lastY = y;
    const mid = window.innerHeight * 0.35;
    let current = 0;
    navTargets.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= mid) current = i; });
    navLinks.forEach((a, i) => a.classList.toggle('is-active', i === current));
  }

  /* ---------------------------------------------------------
     Hero slideshow
     --------------------------------------------------------- */
  (() => {
    const root = $('.hero');
    const slides = $$('.slide', root);
    const INTERVAL = 1800; // ms each image stays on screen
    const WIPE = 600;      // ms for the slide-in transition (matches CSS)
    let index = 0;
    let busy = false;
    let timer = 0;
    let paused = false;

    function schedule() {
      clearTimeout(timer);
      if (reduceMotion || paused) return;
      timer = setTimeout(() => go(index + 1, 1), INTERVAL);
    }

    function go(next, dir) {
      next = (next + slides.length) % slides.length;
      if (next === index || busy) return;
      busy = true;
      const from = slides[index];
      const to = slides[next];
      if (dir === undefined) dir = next > index ? 1 : -1;

      from.classList.remove('is-active');
      from.classList.add('is-leaving');
      to.style.transition = 'none';
      to.style.clipPath = dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
      reflow(to);
      to.style.transition = '';
      to.style.clipPath = '';
      to.classList.add('is-active');

      index = next;
      setTimeout(() => { from.classList.remove('is-leaving'); busy = false; }, reduceMotion ? 0 : WIPE);
      schedule();
    }

    // pause only when the hero is off screen or the tab is hidden
    let offscreen = false;
    const sync = () => {
      const was = paused;
      paused = offscreen || document.hidden;
      if (paused) clearTimeout(timer);
      else if (was) schedule();
    };
    new IntersectionObserver(([e]) => { offscreen = !e.isIntersecting; sync(); }, { threshold: 0.2 }).observe(root);
    document.addEventListener('visibilitychange', sync);

    let sx = null, sy = null;
    root.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; }, { passive: true });
    root.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      sx = null;
    });

    document.addEventListener('keydown', (e) => {
      if (offscreen || menuOpen) return;
      if (e.key === 'ArrowRight') go(index + 1, 1);
      if (e.key === 'ArrowLeft') go(index - 1, -1);
    });

    // start once the first frame is painted so the intro text animates in
    requestAnimationFrame(() => requestAnimationFrame(() => {
      body.classList.add('is-loaded');
      schedule();
    }));
  })();

  /* ---------------------------------------------------------
     About: highlight the stat nearest the middle of the screen
     --------------------------------------------------------- */
  const stats = $$('.astat');
  const statImgs = $$('.about__frame img');
  let activeStat = 0;
  function updateStats() {
    const mid = window.innerHeight * 0.55;
    let best = activeStat, bestD = Infinity;
    stats.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best === activeStat) return;
    activeStat = best;
    stats.forEach((s, i) => s.classList.toggle('is-active', i === best));
    statImgs.forEach((img, i) => img.classList.toggle('is-active', i === best));
  }

  /* ---------------------------------------------------------
     Services: stacked panels tilt back in 3D as the next
     panel slides over them (desktop only)
     --------------------------------------------------------- */
  const panels = $$('.panel');
  panels.forEach((p) => {
    const shade = document.createElement('div');
    shade.className = 'panel__shade';
    p.appendChild(shade);
  });
  // sticky only applies on screens tall enough (see CSS); cache it on resize
  let panelSticky = false;
  let panelStick = 0;
  function measurePanels() {
    if (!panels.length) return;
    const cs = getComputedStyle(panels[0]);
    panelSticky = cs.position === 'sticky';
    panelStick = parseFloat(cs.top) || 0;
  }
  measurePanels();

  function updatePanels() {
    if (!panelSticky || reduceMotion) {
      panels.forEach((p) => { p.style.transform = ''; p.lastElementChild.style.opacity = '0'; });
      return;
    }
    const vh = window.innerHeight;
    const stick = panelStick;
    panels.forEach((p, i) => {
      let rx = 0, scale = 1, ty = 0, shade = 0;

      // incoming: leans back slightly while sliding up, straightens when it lands
      const top = p.getBoundingClientRect().top;
      if (top > stick + 1) {
        const e = clamp((top - stick) / (vh * 0.7), 0, 1);
        rx = e * 7;
        scale = 1 - e * 0.025;
      }

      // covered: tips back gently as the next card slides over it
      const next = panels[i + 1];
      if (next) {
        const k = clamp(1 - (next.getBoundingClientRect().top - stick) / (vh - stick), 0, 1);
        rx += k * 6;
        scale -= k * 0.05;
        ty = -k * 16;
        shade = k * 0.35;
      }

      p.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(4)}) rotateX(${rx.toFixed(2)}deg)`;
      p.lastElementChild.style.opacity = shade.toFixed(3);
    });
  }

  /* ---------------------------------------------------------
     How it works: pinned stepper, scroll moves 01 to 05
     --------------------------------------------------------- */
  const pPin = $('.process__pin');
  const pNav = $$('.process__nav li');
  const pDigits = $('.process__digits');
  const pSteps = $$('.pstep');
  const pMedia = $$('.pmedia');
  let pIndex = -1;
  function updateProcess() {
    if (window.innerWidth <= 860) return;
    const r = pPin.getBoundingClientRect();
    const dist = pPin.offsetHeight - window.innerHeight;
    const p = dist > 0 ? clamp(-r.top / dist, 0, 0.9999) : 0;
    const idx = Math.floor(p * pSteps.length);
    if (idx === pIndex) return;
    pIndex = idx;
    pDigits.style.transform = `translateY(${-idx}em)`;
    pNav.forEach((li, i) => { li.classList.toggle('is-active', i === idx); li.classList.toggle('is-done', i < idx); });
    pSteps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
    pMedia.forEach((m, i) => { m.classList.toggle('is-active', i === idx); m.classList.toggle('is-past', i < idx); });
  }

  /* ---------------------------------------------------------
     Projects filter
     --------------------------------------------------------- */
  const filterBtns = $$('.filters button');
  const cards = $$('.pcard');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filterBtns.forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', String(b === btn));
      });
      cards.forEach((c) => {
        const show = f === 'all' || c.dataset.cat === f;
        c.classList.remove('is-filtered-in');
        c.classList.toggle('is-hidden', !show);
        if (show) {
          c.classList.add('is-in');
          reflow(c);
          c.classList.add('is-filtered-in');
        }
      });
    });
  });

  /* ---------------------------------------------------------
     CTA background parallax
     --------------------------------------------------------- */
  const parallaxEls = $$('[data-parallax]');
  function updateParallax() {
    if (reduceMotion) return;
    const vh = window.innerHeight;
    parallaxEls.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) return;
      el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - vh / 2) * -0.1).toFixed(1)}px, 0)`;
    });
  }

  /* ---------------------------------------------------------
     Footer wordmark: fills crimson as it scrolls into view.
     Reaches 100% once the whole word is on screen, and eases
     towards the target so it never stops half-way.
     --------------------------------------------------------- */
  const fillEl = $('[data-fill]');
  let fillNow = 0, fillTarget = 0, fillRaf = 0;
  function animateFill() {
    fillNow += (fillTarget - fillNow) * 0.12;
    if (Math.abs(fillTarget - fillNow) < 0.1) fillNow = fillTarget;
    fillEl.style.setProperty('--fill', `${fillNow.toFixed(2)}%`);
    fillRaf = fillNow === fillTarget ? 0 : requestAnimationFrame(animateFill);
  }
  function updateFill() {
    if (!fillEl) return;
    const r = fillEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const p = atBottom ? 1 : clamp((vh - r.top) / r.height, 0, 1);
    fillTarget = p * 100;
    if (reduceMotion) { fillNow = fillTarget; fillEl.style.setProperty('--fill', `${fillNow}%`); return; }
    if (!fillRaf) fillRaf = requestAnimationFrame(animateFill);
  }

  /* ---------------------------------------------------------
     Scroll loop
     --------------------------------------------------------- */
  let ticking = false;
  function frame() {
    updateNav();
    updateStats();
    updateParallax();
    updateFill();
    updatePanels();
    updateProcess();
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  window.addEventListener('resize', () => { measurePanels(); frame(); });
  frame();

  /* ---------------------------------------------------------
     Enquiry form (Indian mobile number validation)
     --------------------------------------------------------- */
  const form = $('.form');
  const status = $('.form__status');
  const btnText = $('.form__btn-text');
  const phone = $('#f-phone');

  const normalisePhone = (v) => {
    let d = v.replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    return d;
  };
  const validMobile = (v) => /^[6-9]\d{9}$/.test(normalisePhone(v));

  phone.addEventListener('input', () => {
    const d = normalisePhone(phone.value).slice(0, 10);
    phone.value = d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    const mark = (el, ok) => {
      (el.closest('.field') || el.closest('.consent')).classList.toggle('is-invalid', !ok);
      if (!ok) valid = false;
    };
    mark($('#f-name'), $('#f-name').value.trim().length > 1);
    mark(phone, validMobile(phone.value));
    mark($('#f-type'), $('#f-type').value !== '');
    const consent = $('.consent input');
    mark(consent, consent.checked);

    if (!valid) {
      status.textContent = validMobile(phone.value) ? 'Please fill in the highlighted fields.' : 'Please enter a valid 10-digit mobile number.';
      return;
    }
    btnText.textContent = 'Sending…';
    status.textContent = '';
    // TODO: send the form data to your email / CRM / backend here.
    setTimeout(() => {
      form.classList.add('is-sent');
      btnText.textContent = 'Enquiry sent';
      status.textContent = 'Thank you. We will call you back shortly.';
      form.reset();
    }, 800);
  });
  $$('input, select, textarea', form).forEach((el) => {
    const clear = () => (el.closest('.field') || el.closest('.consent'))?.classList.remove('is-invalid');
    el.addEventListener('input', clear);
    el.addEventListener('change', clear);
  });

  $('#year').textContent = new Date().getFullYear();
})();
