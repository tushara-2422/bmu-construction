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
    let current = -1;
    navTargets.forEach((s, i) => { if (s && s.getBoundingClientRect().top <= mid) current = i; });
    navLinks.forEach((a, i) => a.classList.toggle('is-active', i === current));
  }

  /* ---------------------------------------------------------
     Hero: letters rise in, photos crossfade, and on desktop the
     scroll position (--p) grows the photo window to full screen
     behind the headline words.
     --------------------------------------------------------- */
  (() => {
    const root = $('.hero');
    if (!root) return;

    $$('[data-letters]', root).forEach((el) => {
      const text = el.textContent;
      el.textContent = '';
      [...text].forEach((c, i) => {
        if (c === ' ') { el.append(' '); return; }
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        s.style.setProperty('--i', i);
        el.append(s);
      });
    });

    // slow crossfade between the photos
    const imgs = $$('.hero__curtain img', root);
    let index = 0, timer = 0, offscreen = false;
    const schedule = () => {
      clearTimeout(timer);
      if (reduceMotion || offscreen || document.hidden) return;
      timer = setTimeout(() => {
        index = (index + 1) % imgs.length;
        const img = imgs[index];
        if (img.loading === 'lazy') img.loading = 'eager';
        imgs.forEach((im, i) => im.classList.toggle('is-active', i === index));
        schedule();
      }, 5500);
    };
    new IntersectionObserver(([e]) => { offscreen = !e.isIntersecting; schedule(); }, { threshold: 0.05 }).observe(root);
    document.addEventListener('visibilitychange', schedule);
    window.addEventListener('load', () => setTimeout(() => imgs.forEach((im) => { im.loading = 'eager'; }), 1500));

    // scroll-driven expansion (desktop layout only; CSS uses the same query)
    const mq = window.matchMedia('(min-width: 901px) and (min-height: 600px) and (prefers-reduced-motion: no-preference)');
    const smooth = (t) => t * t * (3 - 2 * t);
    let raf = 0;
    function update() {
      raf = 0;
      if (!mq.matches) { root.style.removeProperty('--p'); return; }
      const dist = root.offsetHeight - window.innerHeight;
      const raw = dist > 0 ? clamp(-root.getBoundingClientRect().top / dist, 0, 1) : 0;
      root.style.setProperty('--p', smooth(clamp(raw / 0.85, 0, 1)).toFixed(4));
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    if (mq.addEventListener) mq.addEventListener('change', kick);
    update();

    requestAnimationFrame(() => requestAnimationFrame(() => body.classList.add('is-loaded')));
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
     Projects: pinned horizontal gallery (desktop) or swipe
     carousel (phones / reduced motion). Every card gets depth,
     tilt, saturation and image parallax from its distance to
     the screen centre; the centred card fills its stage bar.
     --------------------------------------------------------- */
  (() => {
    const section = $('.projects');
    if (!section) return;
    const pin = $('.projects__pin', section);
    const viewport = $('.projects__viewport', section);
    const track = $('.projects__track', section);
    const cards = $$('.pj', section);
    const projectCards = cards.filter((c) => !c.classList.contains('pj--cta'));
    const filterWrap = $('.filters', section);
    const filterBtns = $$('.filters button', section);
    const digits = $('.projects__digits', section);
    const total = $('.projects__total', section);
    const pad = (n) => String(n).padStart(2, '0');

    // stage tracker: mark finished segments and the one in progress
    projectCards.forEach((c) => {
      const stage = parseInt(getComputedStyle(c).getPropertyValue('--stage'), 10) || 0;
      const done = c.dataset.cat === 'completed';
      $$('.pj__stages li', c).forEach((li, i) => {
        if (i < stage - (done ? 0 : 1)) li.classList.add('is-on');
        else if (!done && i === stage - 1) li.classList.add('is-now');
      });
    });

    // spotlight follows the pointer on each card
    cards.forEach((c) => c.addEventListener('pointermove', (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--x', `${e.clientX - r.left}px`);
      c.style.setProperty('--y2', `${e.clientY - r.top}px`);
    }));

    // entrance
    new IntersectionObserver(([e], obs) => {
      if (e.isIntersecting) { section.classList.add('is-in'); obs.disconnect(); }
    }, { threshold: 0.2 }).observe(section);

    let pinned = false;
    let maxShift = 0;
    let x = 0;        // eased track offset
    let target = 0;   // offset the scroll position asks for
    let raf = 0;
    let lastCi = -1;

    const visible = () => cards.filter((c) => !c.hidden);
    const setStagger = () => visible().forEach((c, i) => c.style.setProperty('--n', i));

    function measure() {
      const want = window.innerWidth > 900 && window.innerHeight >= 600 && !reduceMotion;
      if (want !== pinned) {
        pinned = want;
        section.classList.toggle('is-pinned', pinned);
        track.style.transform = '';
        x = target = 0;
      }
      if (pinned) {
        maxShift = Math.max(0, track.scrollWidth - window.innerWidth);
        pin.style.height = `${window.innerHeight + maxShift}px`;
      } else {
        maxShift = 0;
        pin.style.height = '';
      }
      readScroll();
      x = target;
      render();
    }

    function readScroll() {
      let p;
      if (pinned) {
        const top = pin.getBoundingClientRect().top;
        p = maxShift > 0 ? clamp(-top / maxShift, 0, 1) : 0;
        target = p * maxShift;
      } else {
        const max = viewport.scrollWidth - viewport.clientWidth;
        p = max > 0 ? viewport.scrollLeft / max : 0;
      }
      section.style.setProperty('--pp', p.toFixed(4));
    }

    function render() {
      if (pinned) track.style.transform = `translate3d(${(-x).toFixed(1)}px, 0, 0)`;
      const vw = window.innerWidth;
      // focus point: in the pinned gallery it travels from the first card's
      // resting centre to the last card's, so the first card leads at the
      // start and the last one at the end; in the carousel it is the centre
      let mid = vw / 2;
      const vis0 = visible();
      if (pinned && vis0.length) {
        const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
        const half = vis0[0].offsetWidth / 2;
        const p = maxShift > 0 ? x / maxShift : 0;
        mid = (pad + half) + p * ((vw - pad - half) - (pad + half));
      }
      const strength = pinned ? 1 : 0.45;
      let nearest = null, nearestD = Infinity;
      visible().forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = (r.left + r.width / 2 - mid) / (vw * 0.62);
        const k = clamp(d, -1, 1);
        const a = Math.abs(k);
        if (!reduceMotion) {
          c.style.setProperty('--s', (1 - a * 0.08 * strength).toFixed(4));
          c.style.setProperty('--r', `${(k * 2.2 * strength).toFixed(2)}deg`);
          c.style.setProperty('--y', `${(a * 26 * strength).toFixed(1)}px`);
          c.style.setProperty('--sat', (1 - a * 0.75 * strength).toFixed(3));
          c.style.setProperty('--ix', `${(-6 - k * 7).toFixed(2)}%`);
        }
        if (Math.abs(d) < nearestD) { nearestD = Math.abs(d); nearest = c; }
      });
      cards.forEach((c) => c.classList.toggle('is-near', reduceMotion || c === nearest));

      // counter follows the centred project (the CTA keeps the last number)
      const vis = visible().filter((c) => !c.classList.contains('pj--cta'));
      let ci = vis.indexOf(nearest);
      if (ci < 0) ci = vis.length - 1;
      if (ci !== lastCi) { lastCi = ci; digits.style.setProperty('--ci', Math.max(ci, 0)); }
    }

    function loop() {
      readScroll();
      x += (target - x) * (pinned ? 0.14 : 1);
      if (Math.abs(target - x) < 0.3) x = target;
      render();
      raf = x !== target ? requestAnimationFrame(loop) : 0;
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };

    // only run while the section is on screen
    let onScreen = false;
    let warmed = false;
    new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      if (!onScreen) return;
      // off-screen carousel images may never trigger lazy loading on their own
      if (!warmed) { warmed = true; $$('img', track).forEach((im) => { im.loading = 'eager'; }); }
      kick();
    }, { rootMargin: '600px 0px' }).observe(section);
    window.addEventListener('scroll', () => { if (onScreen) kick(); }, { passive: true });
    viewport.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    // filter pill + filtering
    function movePill() {
      const active = filterBtns.find((b) => b.classList.contains('is-active'));
      if (!active) return;
      filterWrap.style.setProperty('--pl', `${active.offsetLeft}px`);
      filterWrap.style.setProperty('--pw', `${active.offsetWidth}px`);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { movePill(); measure(); });
    window.addEventListener('resize', movePill);

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-active')) return;
        const f = btn.dataset.filter;
        filterBtns.forEach((b) => {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        movePill();
        section.classList.add('is-filtering');
        setTimeout(() => {
          let count = 0;
          cards.forEach((c) => {
            const show = c.classList.contains('pj--cta') || f === 'all' || c.dataset.cat === f;
            c.hidden = !show;
            if (show && !c.classList.contains('pj--cta')) count++;
          });
          total.textContent = pad(count);
          setStagger();
          lastCi = -1;
          // keep the reader at the start of the gallery after a filter
          if (pinned) {
            const top = pin.getBoundingClientRect().top + window.scrollY;
            if (window.scrollY > top) window.scrollTo({ top, behavior: 'instant' });
          } else {
            viewport.scrollLeft = 0;
          }
          measure();
          reflow(section);
          section.classList.remove('is-filtering');
        }, reduceMotion ? 0 : 320);
      });
    });

    setStagger();
    movePill();
    measure();
  })();

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
     Footer: on screens where it fits, it sits under the page
     (body.footer-reveal) and is uncovered as <main> scrolls
     away. --r is how much of it is showing; the BMU letters
     rise one after another as it grows.
     --------------------------------------------------------- */
  const footer = $('.footer');
  const mainEl = $('main');
  const letters = $$('.footer__word span');
  function measureFooter() {
    if (!footer) return;
    const fits = !reduceMotion && window.innerWidth > 900 && footer.offsetHeight < window.innerHeight - 40;
    body.classList.toggle('footer-reveal', fits);
  }
  function updateFooter() {
    if (!footer || !mainEl) return;
    const h = footer.offsetHeight || 1;
    const r = reduceMotion ? 1 : clamp((window.innerHeight - mainEl.getBoundingClientRect().bottom) / h, 0, 1);
    footer.style.setProperty('--r', r.toFixed(3));
    letters.forEach((l, i) => {
      const t = clamp((r - 0.15 - i * 0.1) / 0.55, 0, 1);
      l.style.setProperty('--ly', `${((1 - t) * 105).toFixed(1)}%`);
    });
  }
  measureFooter();

  /* ---------------------------------------------------------
     Scroll loop
     --------------------------------------------------------- */
  let ticking = false;
  function frame() {
    updateNav();
    updateStats();
    updateParallax();
    updateFooter();
    updatePanels();
    updateProcess();
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  window.addEventListener('resize', () => { measurePanels(); measureFooter(); frame(); });
  window.addEventListener('load', () => { measureFooter(); frame(); });
  frame();

  /* ---------------------------------------------------------
     Office hours: shows "Open now" or when we open next,
     always in Bengaluru time (Mon to Sat, 9:30 AM to 6:30 PM)
     --------------------------------------------------------- */
  (() => {
    const office = $('.office');
    const status = $('.office__status');
    if (!office || !status) return;
    const OPEN = 9.5, CLOSE = 18.5;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    function update() {
      // IST is UTC+5:30 with no daylight saving
      const ist = new Date(Date.now() + (new Date().getTimezoneOffset() + 330) * 60000);
      const day = ist.getDay();
      const h = ist.getHours() + ist.getMinutes() / 60;
      const workday = day !== 0;
      const open = workday && h >= OPEN && h < CLOSE;
      office.classList.toggle('is-open', open);
      if (open) { status.textContent = 'Open now, until 6:30 PM'; return; }
      let next = 'today';
      if (!workday || h >= CLOSE) {
        const nd = (day + 1) % 7 === 0 ? 1 : (day + 1) % 7;
        next = nd === (day + 1) % 7 ? 'tomorrow' : days[nd];
      }
      status.textContent = `Closed now, opens 9:30 AM ${next}`;
    }
    update();
    setInterval(update, 60000);
  })();

  /* ---------------------------------------------------------
     Headings with [data-words]: words rise in when scrolled to
     --------------------------------------------------------- */
  $$('[data-words]').forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((word, i) => {
      const w = document.createElement('span');
      w.className = 'w';
      const inner = document.createElement('span');
      inner.textContent = word;
      inner.style.setProperty('--i', i);
      w.append(inner);
      el.append(w, i < words.length - 1 ? ' ' : '');
    });
    if (reduceMotion || !('IntersectionObserver' in window)) { el.classList.add('is-in'); return; }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); o.disconnect(); } }, { threshold: 0.4 });
    o.observe(el);
  });

  // contact rows: the colour fill spreads from where the pointer enters
  $$('.way').forEach((w) => w.addEventListener('pointerenter', (e) => {
    w.style.setProperty('--cx', `${e.clientX - w.getBoundingClientRect().left}px`);
  }));

  /* ---------------------------------------------------------
     Enquiry: three steps (what / where / who), validated one
     step at a time, with Indian mobile number validation
     --------------------------------------------------------- */
  (() => {
    const form = $('.qform');
    if (!form) return;
    const steps = $$('.qstep', form);
    const bar = $('.qform__bar', form);
    const stepNo = $('.qform__no', form);
    const back = $('.qform__back', form);
    const nextText = $('.qform__next-text', form);
    const status = $('.form__status', form);
    const phone = $('#f-phone', form);
    const nameEl = $('#f-name', form);
    const area = $('#f-area', form);
    const tiles = $('.tiles', form);
    let cur = 0;
    let sending = false;

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

    function show(i) {
      // steps before the current one wait off to the left, later ones to the right,
      // so moving forward slides left and going back slides right
      steps.forEach((s, k) => {
        const on = k === i;
        s.classList.toggle('is-active', on);
        s.classList.toggle('is-back', k < i);
        s.inert = !on;
      });
      cur = i;
      bar.style.setProperty('--prog', ((i + 1) / steps.length).toFixed(4));
      stepNo.textContent = i + 1;
      back.hidden = i === 0;
      nextText.textContent = i === steps.length - 1 ? 'Send enquiry' : 'Next';
      status.textContent = '';
      const first = $('input:not([type="radio"]), textarea', steps[i]) || $('input', steps[i]);
      if (first && i > 0) setTimeout(() => first.focus({ preventScroll: true }), 450);
    }

    const mark = (el, ok) => { el.classList.toggle('is-invalid', !ok); if (!ok) { reflow(el); } return ok; };
    function validate(i) {
      if (i === 0) {
        const ok = !!$('input[name="type"]:checked', form);
        tiles.classList.remove('is-invalid');
        if (!ok) { reflow(tiles); tiles.classList.add('is-invalid'); status.textContent = 'Pick the type of work to continue.'; }
        return ok;
      }
      if (i === 1) {
        const ok = mark(area.closest('.field'), area.value.trim().length > 1);
        if (!ok) status.textContent = 'Tell us roughly where the site is.';
        return ok;
      }
      const okName = mark(nameEl.closest('.field'), nameEl.value.trim().length > 1);
      const okPhone = mark(phone.closest('.field'), validMobile(phone.value));
      const consent = $('.consent input', form);
      const okConsent = mark(consent.closest('.consent'), consent.checked);
      if (!okPhone) status.textContent = 'Please enter a valid 10-digit mobile number.';
      else if (!okName || !okConsent) status.textContent = 'Please fill in the highlighted fields.';
      return okName && okPhone && okConsent;
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (sending || form.classList.contains('is-sent')) return;
      if (!validate(cur)) return;
      if (cur < steps.length - 1) { show(cur + 1); return; }
      sending = true;
      nextText.textContent = 'Sending…';
      // TODO: send the form data to your email / CRM / backend here.
      setTimeout(() => {
        $('.qdone__name', form).textContent = `, ${nameEl.value.trim().split(/\s+/)[0]}`;
        $('.qdone__phone', form).textContent = `+91 ${phone.value}`;
        form.classList.add('is-sent');
        steps.forEach((s) => { s.inert = true; });
        sending = false;
      }, 800);
    });
    back.addEventListener('click', () => { if (cur > 0) show(cur - 1); });

    // picking a tile moves straight on to the next step
    $$('input[name="type"]', form).forEach((r) => r.addEventListener('change', () => {
      tiles.classList.remove('is-invalid');
      status.textContent = '';
      if (cur === 0) setTimeout(() => show(1), 380);
    }));
    $$('input, textarea', form).forEach((el) => {
      const clear = () => (el.closest('.field') || el.closest('.consent'))?.classList.remove('is-invalid');
      el.addEventListener('input', clear);
      el.addEventListener('change', clear);
    });

    show(0);
  })();

  $('#year').textContent = new Date().getFullYear();
})();
