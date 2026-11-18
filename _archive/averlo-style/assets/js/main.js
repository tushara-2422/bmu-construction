/* =========================================================
   IRONCREST — interactions & scroll-driven animation
   ========================================================= */
(() => {
  'use strict';

  const html = document.documentElement;
  const body = document.body;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const isDesktop = () => window.innerWidth > 860;

  /* ---------------------------------------------------------
     Split headings into words for the masked rise reveal
     --------------------------------------------------------- */
  function splitWords(root) {
    let index = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const outer = document.createElement('span');
            outer.className = 'w';
            const inner = document.createElement('span');
            inner.textContent = part;
            inner.style.setProperty('--i', index++);
            outer.appendChild(inner);
            frag.appendChild(outer);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(root);
  }
  $$('[data-split]').forEach(splitWords);

  /* ---------------------------------------------------------
     Fit giant wordmark to its container width
     --------------------------------------------------------- */
  const fitEls = $$('[data-fit]');
  function fitText() {
    fitEls.forEach((el) => {
      const parent = el.parentElement;
      const cs = getComputedStyle(parent);
      const target = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      el.style.fontSize = '100px';
      const w = el.getBoundingClientRect().width;
      if (w > 0) el.style.fontSize = `${(100 * target / w).toFixed(2)}px`;
    });
  }
  fitText();

  /* ---------------------------------------------------------
     Preloader
     --------------------------------------------------------- */
  const preloader = $('.preloader');
  const loaderCount = $('#loaderCount');
  const loaderBar = $('.preloader__bar span');
  let pageLoaded = document.readyState === 'complete';
  let introStart = 0;
  window.addEventListener('load', () => { pageLoaded = true; });
  setTimeout(() => { pageLoaded = true; }, 3500);

  function onLoaded() {
    body.classList.add('is-loaded');
    introStart = performance.now();
    if (preloader) {
      preloader.classList.add('is-done');
      setTimeout(() => preloader.remove(), 1200);
    }
  }

  if (!preloader || reduceMotion) {
    onLoaded();
  } else {
    const t0 = performance.now();
    let shown = 0;
    const tick = (now) => {
      const target = Math.min((now - t0) / 1400, pageLoaded ? 1 : 0.9);
      shown = lerp(shown, target, 0.1);
      if (target === 1 && shown > 0.996) shown = 1;
      loaderCount.textContent = Math.round(shown * 100);
      loaderBar.style.transform = `scaleX(${shown})`;
      if (shown < 1) requestAnimationFrame(tick);
      else setTimeout(onLoaded, 180);
    };
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------
     Reveal on scroll + counters
     --------------------------------------------------------- */
  const revealEls = $$('[data-reveal], [data-split]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-in'));
  }

  function runCounter(el) {
    const end = parseFloat(el.dataset.count);
    if (reduceMotion) { el.textContent = end; return; }
    const start = performance.now();
    const dur = 1800;
    const step = (now) => {
      const p = clamp((now - start) / dur, 0, 1);
      el.textContent = Math.round(end * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { runCounter(e.target); cio.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => cio.observe(el));

  /* ---------------------------------------------------------
     Nav: menu overlay + colour switching
     --------------------------------------------------------- */
  const nav = $('#nav');
  const menuBtn = $('.nav__menu');
  const menuLabel = $('.nav__menu-label');
  const menu = $('#menu');
  let menuOpen = false;

  function setMenu(open) {
    menuOpen = open;
    body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    menuLabel.textContent = open ? 'Close' : 'Menu';
    body.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  const themed = $$('[data-nav]');
  function updateNav() {
    const probe = 40;
    let theme = 'light';
    // panels sit inside .panels and overlap: pick the top-most one under the probe
    for (let i = themed.length - 1; i >= 0; i--) {
      const r = themed[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) { theme = themed[i].dataset.nav; break; }
    }
    nav.classList.toggle('on-dark', theme === 'dark' || theme === 'color');
  }

  /* ---------------------------------------------------------
     Hero orbit — rounded tiles circling in 3D
     --------------------------------------------------------- */
  const hero = $('.hero');
  const orbit = $('.orbit');
  const ring = $('.orbit__ring');
  const tiles = $$('.tile', ring);
  const orbitCenter = $('.orbit__center');
  let tileSize = 150;
  let radius = 260;
  let heroVisible = true;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

  function sizeOrbit() {
    const base = Math.min(window.innerWidth, window.innerHeight * 0.92);
    if (window.innerWidth < 560) {
      tileSize = clamp(window.innerWidth * 0.19, 60, 96);
      radius = Math.min(tileSize * 1.95, window.innerWidth / 2 - tileSize * 0.55);
    } else {
      tileSize = clamp(base * 0.128, 72, 140);
      radius = tileSize * 1.75;
    }
    ring.style.setProperty('--tile', `${tileSize}px`);
    tiles.forEach((t) => t.style.setProperty('--tile', `${tileSize}px`));
  }
  sizeOrbit();

  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);

  let spin = 0;
  let lastT = performance.now();
  function orbitFrame(now) {
    const dt = Math.min((now - lastT) / 1000, 0.05);
    lastT = now;
    if (heroVisible) {
      const scrollP = clamp(window.scrollY / window.innerHeight, 0, 1);
      const intro = introStart ? easeOut(clamp((now - introStart) / 1800, 0, 1)) : 0;
      spin += dt * (0.14 + scrollP * 0.9);

      pointer.sx = lerp(pointer.sx, pointer.x, 0.05);
      pointer.sy = lerp(pointer.sy, pointer.y, 0.05);
      ring.style.transform = `rotateX(${(-pointer.sy * 10 + scrollP * 25).toFixed(2)}deg) rotateY(${(pointer.sx * 12).toFixed(2)}deg)`;

      const R = radius * (0.25 + 0.75 * intro) * (1 + scrollP * 0.9);
      const n = tiles.length;
      tiles.forEach((t, i) => {
        const a = spin + (i / n) * Math.PI * 2;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R * 0.94;
        const z = Math.sin(a + 0.6) * 60;
        const rz = (a * 180 / Math.PI) * 0.18 + 8;
        const ry = Math.cos(a) * -30;
        const rx = Math.sin(a) * 26;
        const s = (0.55 + 0.45 * intro) * (1 - scrollP * 0.25);
        t.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateZ(${rz.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateX(${rx.toFixed(1)}deg) scale(${s.toFixed(3)})`;
        t.style.opacity = String((intro * (1 - scrollP * 0.9)).toFixed(3));
      });
      orbitCenter.style.transform = `translate(-50%, -50%) scale(${(1 + scrollP * 0.3).toFixed(3)})`;
      orbit.style.opacity = String((1 - scrollP * 0.4).toFixed(3));
    }
    if (!reduceMotion) requestAnimationFrame(orbitFrame);
  }
  if (reduceMotion) { introStart = performance.now() - 5000; }
  requestAnimationFrame(orbitFrame);

  /* ---------------------------------------------------------
     Service panels — stack and tilt back in 3D
     --------------------------------------------------------- */
  const panels = $$('.panel');
  panels.forEach((p) => {
    const shade = document.createElement('div');
    shade.className = 'panel__shade';
    p.appendChild(shade);
  });
  function updatePanels() {
    if (!isDesktop() || reduceMotion) {
      panels.forEach((p) => { p.style.transform = ''; p.lastElementChild.style.opacity = '0'; });
      return;
    }
    const vh = window.innerHeight;
    panels.forEach((p, i) => {
      const next = panels[i + 1];
      let k = 0;
      if (next) {
        const top = next.getBoundingClientRect().top;
        k = clamp(1 - (top - 12) / (vh - 24), 0, 1);
      } else {
        // last panel tilts away as the metrics section scrolls over it
        const after = $('.metrics').getBoundingClientRect().top;
        k = clamp(1 - after / vh, 0, 1) * 0.6;
      }
      p.style.transform = `translate3d(0, ${(-k * 36).toFixed(1)}px, 0) scale(${(1 - k * 0.07).toFixed(4)}) rotateX(${(k * 11).toFixed(2)}deg)`;
      p.lastElementChild.style.opacity = (k * 0.45).toFixed(3);
    });
  }

  /* ---------------------------------------------------------
     Marquee — duplicate rows for a seamless loop
     --------------------------------------------------------- */
  $$('.marquee__track').forEach((track) => {
    Array.from(track.children).forEach((c) => {
      const clone = c.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  });

  /* ---------------------------------------------------------
     Accordions (project list + FAQ)
     --------------------------------------------------------- */
  function accordion(items, headSel) {
    items.forEach((item) => {
      const head = $(headSel, item);
      head.addEventListener('click', () => {
        const open = !item.classList.contains('is-open');
        items.forEach((other) => {
          other.classList.remove('is-open');
          $(headSel, other).setAttribute('aria-expanded', 'false');
        });
        if (open) {
          item.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }
  accordion($$('.prow'), '.prow__head');
  accordion($$('.qa'), 'button');

  /* ---------------------------------------------------------
     Process — pinned 01 → 05 stepper
     --------------------------------------------------------- */
  const pPin = $('.process__pin');
  const pNav = $$('.process__nav li');
  const pDigits = $('.process__digits');
  const pSteps = $$('.pstep');
  const pMedia = $$('.pmedia');
  let pIndex = -1;
  function updateProcess() {
    if (!isDesktop()) return;
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
     Footer wordmark rises into view
     --------------------------------------------------------- */
  const footer = $('.footer');
  const word = $('.footer__word span');
  function updateFooter() {
    const r = footer.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = clamp((vh - r.top) / r.height, 0, 1);
    word.style.setProperty('--word-y', `${((1 - p) * 45).toFixed(1)}%`);
  }

  /* ---------------------------------------------------------
     Scroll loop
     --------------------------------------------------------- */
  let ticking = false;
  function frame() {
    updateNav();
    updatePanels();
    updateProcess();
    updateFooter();
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { sizeOrbit(); fitText(); pIndex = -1; frame(); }, 120);
  });
  window.addEventListener('load', () => { fitText(); frame(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitText(); frame(); });
  frame();

  /* ---------------------------------------------------------
     "View" bubble over project tiles + magnetic hover
     --------------------------------------------------------- */
  if (finePointer && !reduceMotion) {
    const bubble = $('.view-bubble');
    let mx = 0, my = 0, bx = 0, by = 0, on = false;
    window.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      on = !!e.target.closest('[data-cursor="view"]');
      bubble.classList.toggle('is-on', on);
    });
    const loop = () => {
      bx = lerp(bx, mx, 0.2);
      by = lerp(by, my, 0.2);
      bubble.style.transform = `translate3d(${bx.toFixed(1)}px, ${by.toFixed(1)}px, 0)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /* ---------------------------------------------------------
     CTA split → reveal the site-visit form
     --------------------------------------------------------- */
  const formwrap = $('#formwrap');
  $('[data-open-form]').addEventListener('click', () => {
    formwrap.classList.add('is-open');
    setTimeout(() => {
      formwrap.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      $('#f-name').focus({ preventScroll: true });
    }, 350);
  });
  // "Get a quote" / any #contact link also opens the form
  $$('a[href="#contact"]').forEach((a) => a.addEventListener('click', () => formwrap.classList.add('is-open')));

  const form = $('.form');
  const status = $('.form__status');
  const btnText = $('.form__btn-text');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    $$('[required]', form).forEach((input) => {
      const ok = input.value.trim() !== '' && (input.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value));
      input.closest('.field').classList.toggle('is-invalid', !ok);
      if (!ok) valid = false;
    });
    if (!valid) { status.textContent = 'Please complete the highlighted fields.'; return; }
    btnText.textContent = 'Sending…';
    status.textContent = '';
    // Replace this timeout with a real request (fetch to your backend / form service).
    setTimeout(() => {
      form.classList.add('is-sent');
      btnText.textContent = 'Request sent ✓';
      status.textContent = 'Thank you — a senior estimator will be in touch within one business day.';
      form.reset();
    }, 1000);
  });
  $$('.field input, .field textarea, .field select', form).forEach((input) => {
    const clear = () => input.closest('.field').classList.remove('is-invalid');
    input.addEventListener('input', clear);
    input.addEventListener('change', clear);
  });

  $('#year').textContent = new Date().getFullYear();
})();
