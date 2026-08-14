/* ══════════════════════════════════════════════════════
   KING STUDIO — появление при скролле, мобильное меню,
   лайтбокс галерей по локациям. Без библиотек.
   ══════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* Готовность кадров не переключается руками: img/process.py пишет
     img/shots.js со списком слотов и реально произведённых ширин.
     Есть слот в KS_SHOTS — ставим <img> с точным srcset, нет — остаётся
     .ph-заглушка. Так на странице не может появиться ссылка на файл,
     которого пайплайн не делал. */
  var SHOTS = window.KS_SHOTS || {};

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function srcset(slot) {
    return SHOTS[slot].w.map(function (w) {
      return 'img/' + slot + '-' + w + '.webp ' + w + 'w';
    }).join(', ');
  }


  /* ══ ПОДМЕНА ЗАГЛУШЕК НА КАДРЫ ══ */

  document.querySelectorAll('.ph[data-slot]').forEach(function (ph) {
    var slot = ph.getAttribute('data-slot');
    if (!SHOTS[slot]) return;

    var widths = SHOTS[slot].w;
    var top = widths[widths.length - 1];
    var hero = ph.classList.contains('hero__ph');

    var img = document.createElement('img');
    img.className = ph.className + ' is-set';
    img.src = 'img/' + slot + '-' + top + '.webp';
    img.srcset = srcset(slot);
    img.sizes = hero ? '100vw' : '(max-width: 860px) 100vw, 50vw';
    img.width = top;
    img.height = Math.round(top / SHOTS[slot].r);
    img.alt = ph.getAttribute('data-img') || '';
    // герой виден сразу — ленивая загрузка только задержала бы отрисовку
    img.loading = hero ? 'eager' : 'lazy';
    img.decoding = 'async';

    ph.parentNode.replaceChild(img, ph);
  });


  /* ══ ПОЯВЛЕНИЕ ПРИ СКРОЛЛЕ ══ */

  /* Стартовое «спрятано» живёт под .has-rv и включается отсюда: без
     работающего скрипта страница обязана оставаться читаемой. */
  document.documentElement.classList.add('has-rv');

  var revealables = document.querySelectorAll('.rv');

  // каскад внутри групп: индекс задаёт задержку через --i
  document.querySelectorAll('.kit__list, .price').forEach(function (group) {
    var items = group.matches('.price')
      ? group.querySelectorAll('.price__row')
      : group.children;
    Array.prototype.forEach.call(items, function (el, i) {
      el.style.setProperty('--i', i);
    });
  });

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
    document.querySelectorAll('.kit__list, .price').forEach(function (g) {
      g.classList.add('is-in');
    });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealables.forEach(function (el) { io.observe(el); });
    document.querySelectorAll('.kit__list, .price').forEach(function (g) {
      io.observe(g);
    });
  }


  /* ══ МОБИЛЬНОЕ МЕНЮ ══ */

  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');

  if (burger && nav) {
    var closeNav = function () {
      nav.classList.remove('is-open');
      burger.setAttribute('aria-expanded', 'false');
    };

    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        closeNav();
        burger.focus();
      }
    });
  }


  /* ══ ЛАЙТБОКС ══ */

  var lb      = document.getElementById('lb');
  var lbStage = document.getElementById('lbStage');
  var lbTitle = document.getElementById('lbTitle');
  var lbCount = document.getElementById('lbCount');
  var lbClose = document.getElementById('lbClose');
  var lbPrev  = document.getElementById('lbPrev');
  var lbNext  = document.getElementById('lbNext');

  if (!lb) return;

  var shots = [];      // слоты текущей галереи
  var index = 0;
  var opener = null;   // кнопка, с которой открыли — вернём ей фокус

  function render() {
    var slot = shots[index];
    lbStage.innerHTML = '';

    if (SHOTS[slot]) {
      var widths = SHOTS[slot].w;
      var top = widths[widths.length - 1];
      var img = document.createElement('img');
      img.src = 'img/' + slot + '-' + top + '.webp';
      img.srcset = srcset(slot);
      img.sizes = '(max-width: 860px) 100vw, 1180px';
      img.alt = lbTitle.textContent + ' — кадр ' + (index + 1) + ' из ' + shots.length;
      lbStage.appendChild(img);
    } else {
      var ph = document.createElement('span');
      ph.className = 'ph';
      ph.setAttribute('data-img', slot);
      lbStage.appendChild(ph);
    }

    lbCount.textContent = (index + 1) + ' / ' + shots.length;

    var single = shots.length < 2;
    lbPrev.hidden = single;
    lbNext.hidden = single;
  }

  // соседний кадр подгружаем заранее: листают быстро, и без этого
  // между слайдами моргает пустота
  function preload(delta) {
    if (shots.length < 2) return;
    var slot = shots[(index + delta + shots.length) % shots.length];
    if (!SHOTS[slot]) return;
    var widths = SHOTS[slot].w;
    new Image().src = 'img/' + slot + '-' + widths[widths.length - 1] + '.webp';
  }

  function step(delta) {
    if (shots.length < 2) return;
    index = (index + delta + shots.length) % shots.length;
    render();
    preload(delta);
  }

  function open(zone, trigger, from) {
    shots = (zone.getAttribute('data-shots') || '').split(',').filter(Boolean);
    if (!shots.length) return;

    index = Math.min(Math.max(from || 0, 0), shots.length - 1);
    opener = trigger;
    lbTitle.textContent = zone.getAttribute('data-zone') || 'Галерея';
    render();
    preload(1);

    lb.hidden = false;
    document.body.classList.add('is-locked');
    lbClose.focus();
  }

  function close() {
    lb.hidden = true;
    lbStage.innerHTML = '';
    document.body.classList.remove('is-locked');
    if (opener) { opener.focus(); opener = null; }
  }

  // главный кадр и каждая миниатюра открывают галерею со своего места:
  // data-i — индекс кадра в списке зоны
  document.querySelectorAll('.zone [data-i]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      open(btn.closest('.zone'), btn, parseInt(btn.getAttribute('data-i'), 10));
    });
  });

  lbClose.addEventListener('click', close);
  lbPrev.addEventListener('click', function () { step(-1); });
  lbNext.addEventListener('click', function () { step(1); });

  // клик по подложке закрывает, клик по самому кадру — нет
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target === lbStage) close();
  });

  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;

    if (e.key === 'Escape')     { close(); return; }
    if (e.key === 'ArrowLeft')  { step(-1); return; }
    if (e.key === 'ArrowRight') { step(1);  return; }

    // ловушка фокуса: Tab не должен уводить на страницу под оверлеем
    if (e.key !== 'Tab') return;

    var focusable = Array.prototype.filter.call(
      lb.querySelectorAll('button'),
      function (el) { return !el.hidden; }
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });

  // свайп по кадру на телефоне
  var touchX = null;
  lb.addEventListener('touchstart', function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });

  lb.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
  }, { passive: true });

})();
