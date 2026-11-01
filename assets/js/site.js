(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const D = JSON.parse($('#role-data').textContent);
  const OUT = 'cubic-bezier(0.33, 1, 0.68, 1)', IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)';
  const navH = () => $('.nav').offsetHeight;

  // the hero settles in once
  const rev = $$('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    rev.forEach(el => io.observe(el));
  } else rev.forEach(el => el.classList.add('is-in'));

  // loops: play only while on screen, on the visible slide, and not hovered, focused or held
  $$('[data-loop]').forEach(el => {
    const btn = $('[data-loop-toggle]', el), vids = $$('video', el);
    const s = { seen: false, hover: false, focus: false, held: still };
    const onSlide = () => !el.matches('.slide') || el.classList.contains('is-on');
    const sync = () => {
      const run = s.seen && onSlide() && !s.held;
      vids.forEach(v => (run ? v.play().catch(() => {}) : v.pause()));
      if (btn) { btn.textContent = s.held ? 'Play' : 'Pause'; btn.dataset.state = s.held ? 'paused' : 'running'; }
    };
    if (btn) btn.addEventListener('click', () => { s.held = !s.held; sync(); });
    el.addEventListener('slidechange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { s.seen = e.isIntersecting; sync(); }, { threshold: 0.35 }).observe(el);
  });

  // galleries: arrows, a strip of small pictures, the keyboard and a swipe
  $$('[data-gallery]').forEach(g => {
    const slides = $$('.slide', g), dots = $$('.strip button', g), count = $('.count b', g), strip = $('.strip', g);
    let i = 0;
    const show = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('is-on', k === i); s.dispatchEvent(new Event('slidechange')); });
      dots.forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
      if (count) count.textContent = i + 1;
      const cur = dots[i];
      if (cur && strip) strip.scrollTo({ left: cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2, behavior: still ? 'auto' : 'smooth' });
    };
    $('.prev', g).addEventListener('click', () => show(i - 1));
    $('.next', g).addEventListener('click', () => show(i + 1));
    dots.forEach((b, k) => b.addEventListener('click', () => show(k)));
    g.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, video')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(i - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i + 1); }
    });
    let x0 = null;
    const stage = $('.slides', g);
    stage.addEventListener('pointerdown', e => { x0 = e.clientX; });
    stage.addEventListener('pointerup', e => { if (x0 !== null && Math.abs(e.clientX - x0) > 48) show(i + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    show(0);
  });

  // ---- the index
  const index = $('#index'), items = $$('.row-item', index), result = $('#role-result'), marker = $('.seg-marker');
  const rowOf = li => $('.row', li), idOf = li => li.dataset.id;
  const rows = () => $$('.row', index);
  const scrollTo = d => d.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  const keepInView = d => { const t = d.getBoundingClientRect().top; if (t < navH() + 8 || t > innerHeight * 0.55) scrollTo(d); };

  // open and close a project with a height and fade, never a snap
  function setRow(d, open, animate) {
    const c = $('.case', d);
    if (d._a) { d._a.cancel(); d._a = null; }
    if (!c || !animate || still) { d.open = open; d._closing = false; return Promise.resolve(); }
    if (open) {
      if (d.open && !d._closing) return Promise.resolve();
      d.open = true; d._closing = false;
      const h = c.scrollHeight;
      const a = c.animate({ height: ['0px', h + 'px'], opacity: [0, 1] }, { duration: 640, easing: OUT });
      d._a = a;
      return a.finished.catch(() => {}).then(() => { if (d._a === a) d._a = null; });
    }
    if (!d.open) return Promise.resolve();
    d._closing = true;
    const h = c.offsetHeight;
    const a = c.animate({ height: [h + 'px', '0px'], opacity: [1, 0] }, { duration: 420, easing: IN_OUT, fill: 'forwards' });
    d._a = a;
    return a.finished.then(() => { if (d._a === a) { d.open = false; d._closing = false; a.cancel(); d._a = null; } }).catch(() => {});
  }
  async function toggle(d) {
    const opening = !d.open || d._closing;
    if (!opening) { setRow(d, false, true); return; }
    const before = d.getBoundingClientRect().top;
    const others = rows().filter(o => o !== d && o.open && !o._closing);
    const above = others.filter(o => o.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING);
    above.forEach(o => setRow(o, false, false)); // a project above would pull this one up, so it closes at once
    scrollBy(0, d.getBoundingClientRect().top - before); // and the page is nudged so this one does not move
    await Promise.all([setRow(d, true, true), ...others.filter(o => !above.includes(o)).map(o => setRow(o, false, true))]);
    keepInView(d);
  }
  index.addEventListener('click', e => {
    const sum = e.target.closest('summary');
    if (!sum || !index.contains(sum)) return;
    e.preventDefault();
    toggle(sum.parentElement);
  });

  // a project row fades and folds away, or unfolds, when the filter changes
  function setVisible(li, show, instant) {
    if (li._v) { li._v.cancel(); li._v = null; li.style.overflow = ''; }
    if (show === !li.hidden) return;
    if (instant || still) { li.hidden = !show; if (!show) setRow(rowOf(li), false, false); return; }
    if (show) {
      li.hidden = false;
      const h = li.scrollHeight;
      const a = li.animate({ height: ['0px', h + 'px'], opacity: [0, 1] }, { duration: 420, easing: OUT });
      li._v = a;
      a.finished.then(() => { if (li._v === a) li._v = null; }).catch(() => {});
    } else {
      const h = li.offsetHeight;
      const a = li.animate({ height: [h + 'px', '0px'], opacity: [1, 0] }, { duration: 320, easing: IN_OUT, fill: 'forwards' });
      li._v = a;
      a.finished.then(() => { if (li._v === a) { li.hidden = true; setRow(rowOf(li), false, false); a.cancel(); li._v = null; } }).catch(() => {});
    }
  }

  // the line under the pills: the marker always sits under the selected one, so it can only move in their order
  function placeMarker(instant) {
    const input = $('input[name="role"]:checked');
    if (!input || !marker) return;
    const lab = $(`label[for="${input.id}"]`);
    if (instant) marker.classList.remove('ready');
    marker.style.transform = `translateX(${lab.offsetLeft + lab.offsetWidth / 2 - marker.offsetWidth / 2}px)`;
    if (instant) { void marker.offsetWidth; marker.classList.add('ready'); }
    const sc = $('.seg-scroll'); // slide the row of pills sideways only, never the page
    if (sc && sc.scrollWidth > sc.clientWidth) sc.scrollTo({ left: lab.offsetLeft + lab.offsetWidth / 2 - sc.clientWidth / 2, behavior: instant || still ? 'auto' : 'smooth' });
  }

  function applyRole(k, instant) {
    const rank = D.rank[k];
    const keep = li => !rank || rank.includes(idOf(li));
    items.forEach(li => setVisible(li, keep(li), instant));
    const n = items.filter(keep).length;
    const dl = `<a href="${D.resume[rank ? k : 'systems']}" download>Download the resume</a>`;
    result.innerHTML = rank ? `Showing ${n} of ${D.total} projects for ${D.label[k]}. ${dl}` : `All ${D.total} projects, from cloud to silicon. ${dl}`;
    $$('[data-resume]').forEach(a => { a.href = D.resume[rank ? k : 'systems']; });
    $(`#r-${rank ? k : 'all'}`).checked = true;
    placeMarker(instant);
    history.replaceState(null, '', rank ? `?for=${k}` : location.pathname);
  }
  $$('input[name="role"]').forEach(r => r.addEventListener('change', () => applyRole(r.value)));
  addEventListener('resize', () => placeMarker(true));

  // every link to a project goes through here, so the browser never scrolls on its own as well
  async function go(id) {
    const li = items.find(l => idOf(l) === id);
    if (!li) return;
    if (li.hidden) { applyRole('all'); await wait(still ? 0 : 460); }
    history.replaceState(null, '', `#${id}`);
    const d = rowOf(li);
    if (d.open && !d._closing) { scrollTo(d); return; }
    await toggle(d);
    scrollTo(d);
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-go]');
    if (!a) return;
    e.preventDefault();
    go(a.getAttribute('href').slice(1));
  });

  const want = new URLSearchParams(location.search).get('for');
  applyRole(want && D.rank[want] ? want : 'all', true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placeMarker(true));
  if (location.hash && items.some(li => idOf(li) === location.hash.slice(1))) setTimeout(() => go(location.hash.slice(1)), 0);

  // email: a box with the address, a copy button and two ways to write (a plain mailto often does nothing on a computer)
  const mail = $('#mail'), mailStatus = $('#mail-status'), copyBtn = $('[data-copy]', mail);
  const addr = $('#mail-addr').textContent.trim();
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-mail]');
    if (!a) return;
    e.preventDefault();
    copyBtn.textContent = 'Copy the address'; mailStatus.textContent = '';
    mail.showModal();
  });
  copyBtn.addEventListener('click', async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(addr); ok = true; } catch (_) {
      const r = document.createRange(); r.selectNodeContents($('#mail-addr'));
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try { ok = document.execCommand('copy'); } catch (_) {}
    }
    copyBtn.textContent = ok ? 'Copied' : 'Select and copy it';
    mailStatus.textContent = ok ? 'The address was copied.' : 'Copying was blocked. The address is selected: press Ctrl+C.';
  });
  mail.addEventListener('click', e => { if (e.target === mail || e.target.matches('[data-close]')) mail.close(); });

  // footer links to a group: apply the filter, then go to the list
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-role-pick]');
    if (!a) return;
    e.preventDefault();
    applyRole(a.dataset.rolePick);
    $('#work').scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
  });

  // the tools strip: a second copy makes the loop seamless; it stops off screen, on hover or focus, and with the button
  const mq = $('[data-marquee]');
  if (mq && !still) {
    const track = $('.marquee-track', mq), btn = $('[data-marquee-toggle]', mq);
    $$('li', track).forEach(li => { const c = li.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.append(c); });
    btn.addEventListener('click', () => { const p = mq.classList.toggle('is-paused'); btn.textContent = p ? 'Play' : 'Pause'; btn.dataset.state = p ? 'paused' : 'running'; });
    mq.classList.add('is-away'); // held at the start until most of the strip is on screen
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => mq.classList.toggle('is-away', !en.isIntersecting), { threshold: 0.6 }).observe(mq);
    else mq.classList.remove('is-away');
  }

  // viewer for pictures (the picture is made on demand)
  const lb = $('#lb');
  let media = null;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-zoom]');
    if (!a) return;
    e.preventDefault();
    if (media) media.remove();
    media = new Image(); media.alt = a.dataset.alt || ''; media.src = a.href;
    lb.append(media); lb.showModal();
  });
  lb.addEventListener('click', e => { if (e.target === lb || e.target.matches('[data-close]')) lb.close(); });
  lb.addEventListener('close', () => { if (media) { media.remove(); media = null; } });
})();
