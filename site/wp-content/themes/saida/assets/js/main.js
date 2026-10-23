/* Saida Foods – front-end interactions (no dependencies) */
(function () {
  'use strict';
  var d = document, w = window, html = d.documentElement;
  var CFG = w.SAIDA || { lang: html.lang || 'en', i18n: {} };
  var rtl = html.dir === 'rtl';
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };

  /* header */
  var hdr = $('#hdr'), toTop = $('#toTop');
  function onScroll() {
    var y = w.scrollY;
    if (hdr) hdr.classList.toggle('is-scrolled', y > 30);
    if (toTop) toTop.classList.toggle('is-on', y > 800);
  }
  w.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (toTop) toTop.addEventListener('click', function () { w.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });

  var burger = $('#burger');
  if (burger) burger.addEventListener('click', function () {
    var open = !d.body.classList.contains('nav-open');
    d.body.classList.toggle('nav-open', open);
    burger.setAttribute('aria-expanded', open);
  });
  $$('.nav__sub-toggle').forEach(function (b) {
    b.addEventListener('click', function () {
      var li = b.closest('.nav__item'); var o = !li.classList.contains('is-open');
      li.classList.toggle('is-open', o); b.setAttribute('aria-expanded', o);
    });
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { d.body.classList.remove('nav-open'); $$('.lang').forEach(function (l) { l.classList.remove('is-open'); }); } });

  var lang = $('#lang');
  if (lang) {
    var lb = $('.lang__btn', lang);
    lb.addEventListener('click', function (e) { e.stopPropagation(); var o = !lang.classList.contains('is-open'); lang.classList.toggle('is-open', o); lb.setAttribute('aria-expanded', o); });
    d.addEventListener('click', function (e) { if (!lang.contains(e.target)) lang.classList.remove('is-open'); });
  }

  /* mega menu: hover a category shows its products */
  $$('.mega').forEach(function (m) {
    $$('.mega__cat', m).forEach(function (c) {
      var show = function () {
        $$('.mega__cat', m).forEach(function (x) { x.classList.toggle('is-on', x === c); });
        $$('.mega__panel', m).forEach(function (p) { p.classList.toggle('is-on', p.dataset.panel === c.dataset.mega); });
      };
      c.addEventListener('mouseenter', show); c.addEventListener('focusin', show);
    });
  });

  /* hero slider */
  var track = $('#heroTrack');
  if (track) {
    var slides = $$('.slide', track), dots = $$('.hero__dot'), cur = 0, timer = null, DUR = 7000;
    var go = function (i) {
      cur = (i + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('is-on', k === cur); });
      dots.forEach(function (b, k) { b.classList.toggle('is-on', k === cur); b.setAttribute('aria-selected', k === cur); b.style.setProperty('--dur', DUR + 'ms'); });
    };
    var play = function () { if (slides.length < 2 || reduce) return; clearInterval(timer); timer = setInterval(function () { go(cur + 1); }, DUR); };
    dots.forEach(function (b) { b.addEventListener('click', function () { go(+b.dataset.go); play(); }); });
    var sx = null;
    track.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) { go(cur + ((dx < 0) !== rtl ? 1 : -1)); play(); }
    });
    track.addEventListener('mouseenter', function () { clearInterval(timer); });
    track.addEventListener('mouseleave', play);
    go(0); play();
    // parallax on products
    if (!reduce && w.matchMedia('(pointer:fine)').matches) track.addEventListener('mousemove', function (e) {
      var r = track.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      $$('.slide.is-on .slide__art', track).forEach(function (a) { a.style.transform = 'translate(' + (x * 18) + 'px,' + (y * 14) + 'px)'; });
      $$('.slide.is-on .deco', track).forEach(function (a) { a.style.transform = 'translate(' + (x * -12) + 'px,' + (y * -10) + 'px)'; });
    });
  }

  /* reveal + counters */
  var count = function (el) {
    var to = parseFloat(el.dataset.count) || 0, suf = el.dataset.suffix || '', t0 = null, dur = 1400;
    var fmt = function (n) { try { return new Intl.NumberFormat(CFG.lang === 'ar' ? 'ar-EG-u-nu-latn' : CFG.lang).format(n); } catch (e) { return n; } };
    if (reduce) { el.textContent = fmt(to) + suf; return; }
    var step = function (t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(Math.round(to * e)) + suf; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  if ('IntersectionObserver' in w) {
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target; el.classList.add('in');
        $$('[data-count]', el).forEach(count);
        if (el.dataset.count) count(el);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    $$('.reveal').forEach(function (el) {
      var sib = el.parentElement ? $$(':scope > .reveal', el.parentElement) : [];
      var i = sib.indexOf(el); if (i > 0) el.style.setProperty('--d', Math.min(i, 8) * 0.07 + 's');
      io.observe(el);
    });
    $$('[data-count]').forEach(function (el) { if (!el.closest('.reveal')) io.observe(el); });
  } else { $$('.reveal').forEach(function (el) { el.classList.add('in'); }); $$('[data-count]').forEach(count); }

  /* horizontal rails */
  $$('[data-rail], [data-tslider]').forEach(function (r) {
    var t = $('.rail__track, .tslider__track', r);
    $$('.rail__btn', r).forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = +b.dataset.dir * (rtl ? -1 : 1);
        t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  });

  /* load campaign posters as soon as the section is near */
  var mom = $('.moments');
  if (mom && 'IntersectionObserver' in w) {
    var mio = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { $$('img', mom).forEach(function (i) { i.loading = 'eager'; }); mio.disconnect(); } }, { rootMargin: '600px' });
    mio.observe(mom);
  }

  /* drag to scroll campaigns */
  $$('[data-drag]').forEach(function (r) {
    var down = false, sx = 0, sl = 0;
    r.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = r.scrollLeft; r.style.cursor = 'grabbing'; });
    w.addEventListener('pointerup', function () { down = false; r.style.cursor = ''; });
    r.addEventListener('pointermove', function (e) { if (!down) return; r.scrollLeft = sl - (e.clientX - sx); });
  });

  /* product filter + search */
  $$('[data-filter]').forEach(function (f) {
    var grid = $('[data-grid]'); if (!grid) return;
    var cards = $$('.pcard', grid), empty = $('.empty'), q = '', cat = '*';
    var input = $('input[type=search]', f);
    var apply = function () {
      var n = 0;
      cards.forEach(function (c) {
        var ok = (cat === '*' || c.dataset.cat === cat) && (!q || (c.dataset.search || '').indexOf(q) > -1);
        c.classList.toggle('is-hidden', !ok); if (ok) { n++; c.classList.add('in'); }
      });
      if (empty) empty.hidden = n > 0;
    };
    $$('.chip', f).forEach(function (b) { b.addEventListener('click', function () { $$('.chip', f).forEach(function (x) { x.classList.toggle('is-on', x === b); }); cat = b.dataset.f; apply(); }); });
    if (input) input.addEventListener('input', function () { q = input.value.trim().toLowerCase(); apply(); });
  });

  /* simple chip filters (testimonials, export countries, capacity table) */
  function chipFilter(bar, items, attr) {
    if (!bar) return;
    $$('.chip', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.chip', bar).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        var f = b.dataset.f;
        items.forEach(function (it) { var ok = f === '*' || it.dataset[attr] === f || (attr === 'region' && it.dataset.region === 'origin'); it.classList.toggle('is-hidden', !ok); if (ok) it.classList.add('in'); });
      });
    });
  }
  chipFilter($('[data-tfilter]'), $$('[data-tgrid] .tcard'), 'region');
  chipFilter($('[data-xfilter]'), $$('[data-xgrid] .xcard'), 'region');
  chipFilter($('[data-captable-filter]'), $$('.captable tbody tr'), 'cat');

  /* fly to country on the globe */
  $$('[data-fly]').forEach(function (b) {
    b.addEventListener('click', function () {
      w.dispatchEvent(new CustomEvent('saida:fly', { detail: b.dataset.fly }));
      var g = $('.globe--big') || $('.globe');
      if (g) { var r = g.getBoundingClientRect(); if (r.top < 0 || r.bottom > w.innerHeight) g.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' }); }
    });
  });

  /* product gallery */
  $$('[data-gallery]').forEach(function (g) {
    var mains = $$('.gallery__main', g), thumbs = $$('.gallery__thumb', g);
    var show = function (slot) {
      mains.forEach(function (m) { m.classList.toggle('is-on', m.dataset.slot === slot); });
      thumbs.forEach(function (t) { var on = t.dataset.slot === slot; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
    };
    thumbs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.slot); }); });
    var stage = $('.gallery__stage', g);
    if (stage && mains.length > 1) {
      var sx = null;
      stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) < 40) return;
        var i = mains.findIndex(function (m) { return m.classList.contains('is-on'); });
        var n = (i + ((dx < 0) !== rtl ? 1 : -1) + mains.length) % mains.length; show(mains[n].dataset.slot);
      });
    }
  });

  /* video lite embed */
  $$('[data-yt]').forEach(function (v) {
    v.addEventListener('click', function () {
      v.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.dataset.yt) + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Saida video"></iframe>';
    }, { once: true });
  });

  /* forms: WhatsApp or e-mail */
  $$('form[data-form]').forEach(function (f) {
    var type = f.dataset.form, msg = $('.form__msg', f);
    // step indicator
    var sets = $$('.form__set', f), dots = $$('.form__steps span', f);
    if (dots.length) f.addEventListener('focusin', function (e) {
      var s = e.target.closest('.form__set'); var i = sets.indexOf(s);
      if (i > -1) dots.forEach(function (dd, k) { dd.classList.toggle('is-on', k <= i); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      $$('[required]', f).forEach(function (el) {
        var bad = !String(el.value || '').trim() || (el.type === 'email' && el.value && !/^\S+@\S+\.\S+$/.test(el.value));
        var fl = el.closest('.fld'); if (fl) fl.classList.toggle('is-invalid', bad);
        if (bad && ok) { ok = false; el.focus(); }
      });
      if (!ok) { msg.textContent = CFG.i18n.required || 'Please fill in the required fields.'; msg.className = 'form__msg err'; return; }
      var fd = new FormData(f), fields = {}, lines = [];
      fd.forEach(function (v, k) {
        if (k === 'website' || k === 'via') return;
        var key = k.replace('[]', '');
        if (k.slice(-2) === '[]') { (fields[key] = fields[key] || []).push(v); } else fields[key] = v;
      });
      $$('input,select,textarea', f).forEach(function (el) {
        if (!el.name || el.name === 'website' || el.name === 'via' || el.type === 'radio' && !el.checked || el.type === 'checkbox') return;
        if (!String(el.value).trim()) return;
        var lab = el.closest('.fld'); var t = lab ? ($('span', lab) || $('legend', lab)) : null;
        lines.push('*' + (t ? t.textContent.replace('*', '').trim() : el.name) + ':* ' + el.value);
      });
      if (fields.interest) { var cl = $('.form__set:nth-of-type(3) legend', f); lines.push('*' + (cl ? cl.textContent.trim() : 'Interest') + ':* ' + fields.interest.join(', ')); }
      var viaEl = $('input[name=via]:checked', f), via = viaEl ? viaEl.value : 'email';
      var title = { agent: 'Saida – Agent request', contact: 'Saida – Contact', review: 'Saida – Review' }[type];
      var text = title + '\n\n' + lines.join('\n');
      var btn = $('button[type=submit]', f); btn.disabled = true;
      msg.textContent = CFG.i18n.sending || '…'; msg.className = 'form__msg';
      var waWin = null;
      if (via === 'whatsapp') waWin = w.open('https://wa.me/' + String(CFG.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text), '_blank');
      var done = function (good) {
        btn.disabled = false;
        if (good) { msg.textContent = CFG.i18n.sent || 'Sent'; msg.className = 'form__msg ok'; f.reset(); }
        else if (via === 'email') { w.location.href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent(title) + '&body=' + encodeURIComponent(text.replace(/\*/g, '')); msg.textContent = ''; }
        else { msg.textContent = CFG.i18n.sent || 'Sent'; msg.className = 'form__msg ok'; }
      };
      if (!CFG.rest) { done(false); return; }
      fetch(CFG.rest + 'request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': CFG.nonce || '' },
        body: JSON.stringify({ type: type, via: via, lang: CFG.lang, page: location.href, website: (fd.get('website') || ''), fields: fields })
      }).then(function (r) { return r.json(); }).then(function (j) { done(j && j.ok); }).catch(function () { done(false); });
    });
    $$('input,select,textarea', f).forEach(function (el) { el.addEventListener('input', function () { var fl = el.closest('.fld'); if (fl) fl.classList.remove('is-invalid'); }); });
  });

  html.classList.remove('no-js');
})();
