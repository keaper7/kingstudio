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

  /* .mate__price переиспользует разметку .price__row (те же строки
     тариф/цена), поэтому должен наблюдаться той же группой — иначе
     .has-rv .price__row { opacity:0 } в base.css прячет цены фотографов
     навсегда: CSS раскрывает их только внутри .price.is-in / .mate__price.is-in,
     а сюда их никто не добавляет. Было именно так и выглядело как пустое
     место под карточками Инала и Тамерлана — на деле там стояли невидимые
     строки цен, а не воздух. */
  var priceGroups = '.kit__list, .price, .mate__price';

  // каскад внутри групп: индекс задаёт задержку через --i
  document.querySelectorAll(priceGroups).forEach(function (group) {
    var items = group.matches('.price, .mate__price')
      ? group.querySelectorAll('.price__row')
      : group.children;
    Array.prototype.forEach.call(items, function (el, i) {
      el.style.setProperty('--i', i);
    });
  });

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
    document.querySelectorAll(priceGroups).forEach(function (g) {
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
    document.querySelectorAll(priceGroups).forEach(function (g) {
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


  /* ══ НИТЬ ПО СКРОЛЛУ ══

     Светящаяся линия, которая идёт вниз строго по свободному месту вёрстки
     и прорисовывается по мере скролла.

     Маршрут не задан руками: скрипт собирает прямоугольники всего видимого
     контента, режет страницу на горизонтальные полосы, в каждой находит
     свободные промежутки и ищет по ним путь сверху вниз.

     Ищет именно поиском, а не «идти к ближайшей пустоте»: жадный вариант
     заносило поперёк абзацев — линия начинала перебираться вбок там, где
     сквозного прохода не было, и резала текст (замер: 441 пересечение из
     1586 проверенных точек). Здесь по полосам считается динамика с ценой
     за смещение вбок, и переход между соседними полосами разрешён только
     внутри промежутка, свободного в обеих сразу. Тогда пересечь блок
     физически невозможно: коридора сквозь него просто нет.

     Текст и кадры различаются. Текст прозрачный — сквозь него линия видна,
     поэтому его линия обходит всегда. Кадры и фреймы непрозрачные и сами
     закрывают линию, поэтому за ними пройти разрешено, но только если
     свободной дороги не осталось вовсе.

     Всё считается здесь, а не в разметке: без скрипта декорации просто
     нет — она не имеет права оставить страницу сломанной. */

  (function () {
    var NS = 'http://www.w3.org/2000/svg';
    var labels = document.querySelectorAll('.sec__num');
    var probeSec = document.querySelector('.sec');
    if (labels.length < 2 || !probeSec) return;

    /* ниже 860px всё встаёт в одну колонку и свободного места по бокам
       не остаётся — вести линию негде */
    var wide = window.matchMedia('(min-width: 861px)');

    var css   = getComputedStyle(document.documentElement);
    var LIGHT = css.getPropertyValue('--greige').trim() || '#A89680';
    var DARK  = css.getPropertyValue('--gold').trim()   || '#C0A068';
    var GRAD  = 'ks-thread-grad';

    var STEP  = 44;    // высота полосы, в которой ищем свободное место
    var GAP   = 16;    // запас, на который линия держится от контента
    /* Проход считается от 34px. Порог держим низким намеренно: у сквозных
       абзацев во всю колонку единственное свободное место — внешнее поле
       страницы, а оно уже полей секции (те же 55–88px минус запас). С более
       строгим порогом полоса объявлялась безвыходной и линия шла прямо по
       тексту. Узкие щели поиск и так не любит: цена в place() растёт к краям. */
    var MINW  = 34;
    var CELL  = 8;     // шаг сетки по X для поиска пути
    var GROUP = 8;     // точек маршрута в одном отрезке пути
    var SOFT  = 220;   // цена прохода за непрозрачным кадром
    var PULL  = 0.16;  // тяга к желаемой стороне — от неё нить и вьётся
    var INF   = 1e15;

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'thread');
    svg.setAttribute('aria-hidden', 'true');

    var defs = document.createElementNS(NS, 'defs');
    var grad = document.createElementNS(NS, 'linearGradient');
    grad.setAttribute('id', GRAD);
    grad.setAttribute('gradientUnits', 'userSpaceOnUse');
    grad.setAttribute('x1', '0'); grad.setAttribute('x2', '0');
    defs.appendChild(grad);
    svg.appendChild(defs);

    // общий слой под свечение: фильтр из CSS висит на нём, а не на каждом
    // отрезке — иначе браузер считал бы ореол по отдельности для всех
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'thread__glow');
    svg.appendChild(layer);

    var paths = [];
    var parts = [];
    var nodes = [];
    var built = false;
    var builtH = 0;

    /* offset-цепочка, а не getBoundingClientRect: блоки с появлением при
       скролле до показа сдвинуты трансформом на 18px. Прямоугольник это
       учтёт, и маршрут проложится по позициям, которых через секунду уже
       не будет. offsetTop/offsetLeft трансформов не видят. */
    function docTop(el) {
      var y = 0;
      while (el) { y += el.offsetTop; el = el.offsetParent; }
      return y;
    }
    function docLeft(el) {
      var x = 0;
      while (el) { x += el.offsetLeft; el = el.offsetParent; }
      return x;
    }

    function n(v) { return Math.round(v * 10) / 10; }

    // держит ли элемент собственный текст: так в препятствия попадают именно
    // абзацы, заголовки, пункты и подписи, а не их обёртки
    function holdsText(el) {
      for (var k = el.firstChild; k; k = k.nextSibling) {
        if (k.nodeType === 3 && k.nodeValue.trim()) return true;
      }
      return false;
    }

    /* Прямоугольники самих строк текста, а не короба элемента. Разница
       принципиальна: слоган над барельефом растянут inset:0 на всю полосу,
       хотя занят там одной строкой по центру. По коробу выходило препятствие
       во всю ширину без единого обхода, и линия шла прямо сквозь него. */
    function textRects(el, dx, dy) {
      var out = [], rng = document.createRange();

      for (var k = el.firstChild; k; k = k.nextSibling) {
        if (k.nodeType !== 3 || !k.nodeValue.trim()) continue;
        rng.selectNodeContents(k);
        var list = rng.getClientRects();
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          if (r.width < 1 || r.height < 1) continue;
          out.push({
            t: r.top + window.pageYOffset + dy - GAP,
            b: r.bottom + window.pageYOffset + dy + GAP,
            l: r.left + dx - GAP,
            r: r.right + dx + GAP
          });
        }
      }
      return out;
    }

    function collectBlockers() {
      var hard = [], soft = [];
      var all = document.querySelectorAll('.sec *, .hero *, .band *, .ftr *');

      Array.prototype.forEach.call(all, function (el) {
        /* только HTML: у SVG-элементов нет offsetTop/offsetLeft, и цепочка
           вернула бы NaN, отравив весь маршрут. Крупные декоративные SVG
           помечены data-thread-block на своей HTML-обёртке. */
        if (!(el instanceof HTMLElement)) return;
        if (!el.offsetWidth && !el.offsetHeight) return;

        var opaque = el.tagName === 'IMG' || el.tagName === 'IFRAME' ||
                     el.tagName === 'VIDEO' || el.classList.contains('ph');

        // блок, объявленный вручную: обходим по габариту, текста в нём нет
        if (el.hasAttribute('data-thread-block')) {
          var bt = docTop(el), bl = docLeft(el);
          hard.push({ t: bt - GAP, b: bt + el.offsetHeight + GAP,
                      l: bl - GAP, r: bl + el.offsetWidth + GAP });
          return;
        }

        if (!opaque && !holdsText(el)) return;

        var t = docTop(el), l = docLeft(el);

        if (opaque) {
          soft.push({
            t: t - GAP, b: t + el.offsetHeight + GAP,
            l: l - GAP, r: l + el.offsetWidth + GAP
          });
          return;
        }

        /* Строки меряются прямоугольником, а он видит трансформ появления;
           offset-цепочка — нет. Считаем расхождение по самому элементу и
           сдвигаем строки на него, иначе блоки до показа уедут на 18px. */
        var box = el.getBoundingClientRect();
        var dx = l - box.left;
        var dy = t - (box.top + window.pageYOffset);

        textRects(el, dx, dy).forEach(function (r) { hard.push(r); });
      });

      return { hard: hard, soft: soft };
    }

    // свободные промежутки по X, шире MINW
    function spansOf(list, w) {
      var busy = list.slice().sort(function (a, b) { return a.l - b.l; });
      var free = [], edge = 0;

      for (var i = 0; i < busy.length; i++) {
        if (busy[i].l - edge >= MINW) free.push([edge, busy[i].l]);
        if (busy[i].r > edge) edge = busy[i].r;
      }
      if (w - edge >= MINW) free.push([edge, w]);
      return free;
    }

    // слитые в непрерывные отрезки занятые интервалы
    function merged(list) {
      var busy = list.slice().sort(function (a, b) { return a.l - b.l; });
      var out = [];
      for (var i = 0; i < busy.length; i++) {
        var last = out[out.length - 1];
        if (last && busy[i].l <= last[1]) last[1] = Math.max(last[1], busy[i].r);
        else out.push([busy[i].l, busy[i].r]);
      }
      return out;
    }

    function covered(ranges, x) {
      for (var i = 0; i < ranges.length; i++) {
        if (x >= ranges[i][0] && x <= ranges[i][1]) return true;
      }
      return false;
    }

    function spanAt(spans, x) {
      for (var i = 0; i < spans.length; i++) {
        if (x >= spans[i][0] && x <= spans[i][1]) return spans[i];
      }
      return null;
    }

    function build() {
      var pad  = parseFloat(getComputedStyle(probeSec).paddingLeft);
      var docH = document.body.offsetHeight;
      var docW = document.documentElement.clientWidth;

      var marks = [];
      Array.prototype.forEach.call(labels, function (el) {
        var s = getComputedStyle(el);
        var textH = el.offsetHeight
                  - parseFloat(s.paddingBottom)
                  - parseFloat(s.borderBottomWidth);
        marks.push({ y: docTop(el) + textH / 2, el: el });
      });

      var yTop = marks[0].y - 90;
      var yBot = marks[marks.length - 1].y + 150;
      var rows = Math.max(2, Math.round((yBot - yTop) / STEP));

      // раскладываем препятствия по полосам, чтобы каждую считать только по
      // своим, а не гонять весь список по кругу
      var blk = collectBlockers();
      var hardBy = [], softBy = [];
      for (var r = 0; r <= rows; r++) { hardBy.push([]); softBy.push([]); }

      function bucket(list, into) {
        list.forEach(function (b) {
          var from = Math.floor((b.t - yTop) / STEP);
          var to   = Math.ceil((b.b - yTop) / STEP);
          if (to < 0 || from > rows) return;
          for (var k = Math.max(0, from); k <= Math.min(rows, to); k++) into[k].push(b);
        });
      }
      bucket(blk.hard, hardBy);
      bucket(blk.soft, softBy);

      /* Текст — жёсткий запрет: он прозрачный, сквозь него линию видно.
         Кадры непрозрачные и сами её закрывают, поэтому за ними пройти можно,
         просто дорого (SOFT ниже). Важно, что набор запретов один и тот же для
         всех полос: пока он выбирался поблочно, соседние полосы получали
         несовместимые разрешения — сверху только справа, снизу только слева, —
         и путь упирался в тупик, через который откат протаскивал линию прямо
         по заголовку. */
      var allow = [], softBusy = [];
      for (var k = 0; k <= rows; k++) {
        var free = spansOf(hardBy[k], docW);
        allow.push(free.length ? free : [[0, docW]]);
        softBusy.push(merged(softBy[k]));
      }

      // коридор между соседними полосами — свободен от текста в обеих сразу
      var corr = [null];
      for (var k2 = 1; k2 <= rows; k2++) {
        var c = spansOf(hardBy[k2 - 1].concat(hardBy[k2]), docW);
        corr.push(c.length ? c : [[0, docW]]);
      }

      /* Замысел траектории. Одних запретов мало: поиск минимизирует смещение
         вбок, и оптимумом для него оказывается прямая вдоль края экрана —
         формально безупречная и совершенно скучная (замер: размах по всему
         разделу локаций 22px). Поэтому каждой секции назначается сторона,
         и они чередуются: нить тянет то к левому полю, то к правому, а
         перебирается она в отбивках между секциями, где свободна вся ширина.
         Тяга слабее цены движения, так что сквозь блок она не потащит —
         обход остаётся жёстким. */
      var want = [];
      var secs = [];
      Array.prototype.forEach.call(document.querySelectorAll('.sec'), function (el, i) {
        var t = docTop(el);
        secs.push({ t: t, b: t + el.offsetHeight, right: i % 2 === 1 });
      });

      for (var w = 0; w <= rows; w++) {
        var wy = yTop + w * STEP, side = null;
        for (var si = 0; si < secs.length; si++) {
          if (wy >= secs[si].t && wy < secs[si].b) { side = secs[si].right; break; }
        }
        want.push(side === null ? pad * 0.5
                : side ? docW - pad * 0.5 : pad * 0.5);
      }

      var cols = Math.floor(docW / CELL) + 1;

      /* Цена стояния в клетке. Вне свободного от текста промежутка — запрет.
         Внутри: чем ближе к краю, тем дороже (линия тянется в середину
         простора, а не липнет к тексту), плюс SOFT, если тут кадр — за ним
         линии не видно, и поиск сам предпочтёт уйти на открытое место, если
         это стоит меньше, чем отсидеться за кадром. */
      function place(k, c) {
        var x = c * CELL;
        var s = spanAt(allow[k], x);
        if (!s) return INF;
        var edge = Math.min(x - s[0], s[1] - x);
        return 0.2 * Math.max(0, 70 - edge)
             + (covered(softBusy[k], x) ? SOFT : 0)
             + PULL * Math.abs(x - want[k]);
      }

      var cost = new Float64Array(cols);
      var back = [];
      for (var c = 0; c < cols; c++) cost[c] = place(0, c);

      var tmp = new Float64Array(cols), tmpIdx = new Int32Array(cols);

      for (var k3 = 1; k3 <= rows; k3++) {
        var next = new Float64Array(cols), bk = new Int32Array(cols);
        for (var i0 = 0; i0 < cols; i0++) { next[i0] = INF; bk[i0] = -1; tmp[i0] = INF; tmpIdx[i0] = -1; }

        /* Перенос цены вбок — только внутри коридора: за его пределы линия
           шагнуть не может, там стоит блок. Два прохода (вправо и влево) дают
           для каждой клетки минимальную цену прихода с прошлой полосы. */
        corr[k3].forEach(function (s) {
          var cs = Math.max(0, Math.ceil(s[0] / CELL));
          var ce = Math.min(cols - 1, Math.floor(s[1] / CELL));

          var run = INF, idx = -1, c2;
          for (c2 = cs; c2 <= ce; c2++) {
            if (run < INF) run += CELL;
            if (cost[c2] < run) { run = cost[c2]; idx = c2; }
            if (run < tmp[c2]) { tmp[c2] = run; tmpIdx[c2] = idx; }
          }
          run = INF; idx = -1;
          for (c2 = ce; c2 >= cs; c2--) {
            if (run < INF) run += CELL;
            if (cost[c2] < run) { run = cost[c2]; idx = c2; }
            if (run < tmp[c2]) { tmp[c2] = run; tmpIdx[c2] = idx; }
          }
        });

        for (var c3 = 0; c3 < cols; c3++) {
          if (tmp[c3] >= INF) continue;
          var pen = place(k3, c3);
          if (pen >= INF) continue;
          next[c3] = tmp[c3] + pen;
          bk[c3] = tmpIdx[c3];
        }

        // тупик: коридоров нет вовсе — начинаем полосу заново, чтобы поиск
        // не оборвался и линия осталась непрерывной
        var any = false;
        for (var c4 = 0; c4 < cols; c4++) if (next[c4] < INF) { any = true; break; }
        if (!any) {
          for (var c5 = 0; c5 < cols; c5++) { next[c5] = place(k3, c5); bk[c5] = -1; }
        }

        back.push(bk);
        cost = next;
      }

      // разматываем путь назад от самой дешёвой клетки последней полосы
      var endC = 0, endBest = INF;
      for (var c6 = 0; c6 < cols; c6++) if (cost[c6] < endBest) { endBest = cost[c6]; endC = c6; }

      /* Если предшественника нет (сквозного коридора на этом стыке не нашлось),
         берём ближайшую разрешённую клетку предыдущей полосы, а не ту же самую:
         прежняя версия подставляла текущий столбец вслепую, и он мог оказаться
         прямо на тексте — так линия и заезжала на заголовок. */
      function nearestAllowed(k, c) {
        for (var d = 0; d < cols; d++) {
          if (c - d >= 0 && place(k, c - d) < INF) return c - d;
          if (c + d < cols && place(k, c + d) < INF) return c + d;
        }
        return c;
      }

      var xs = new Array(rows + 1);
      xs[rows] = endC * CELL;
      var cur = endC;
      for (var k4 = rows; k4 >= 1; k4--) {
        var prev = back[k4 - 1][cur];
        cur = prev < 0 ? nearestAllowed(k4 - 1, cur) : prev;
        xs[k4 - 1] = cur * CELL;
      }

      /* Лёгкое сглаживание: путь по сетке идёт ступеньками, дуга смотрится
         спокойнее. После каждого прохода возвращаем точку в пределы своего
         промежутка и обоих коридоров — иначе сглаживание само занесёт линию
         на текст, ради обхода которого всё и затевалось. */
      for (var pass = 0; pass < 3; pass++) {
        var sm = xs.slice();
        for (var j = 1; j < rows; j++) sm[j] = (xs[j - 1] + xs[j] * 2 + xs[j + 1]) / 4;

        for (var m = 0; m <= rows; m++) {
          var lo = 0, hi = docW;
          [spanAt(allow[m], xs[m]),
           m > 0    ? spanAt(corr[m], xs[m])     : null,
           m < rows ? spanAt(corr[m + 1], xs[m]) : null
          ].forEach(function (s) {
            if (s) { lo = Math.max(lo, s[0]); hi = Math.min(hi, s[1]); }
          });
          xs[m] = Math.min(Math.max(sm[m], lo + 2), hi - 2);
        }
      }

      var pts = [];
      for (var p = 0; p <= rows; p++) pts.push({ x: xs[p], y: yTop + p * STEP });

      /* Нить нарезана на отрезки. Прорисовка идёт через stroke-dashoffset, и
         правка его на пути высотой во весь документ помечала бы грязной всю
         его площадь на каждом кадре скролла. У отрезков за кадр меняется
         один, остальные не трогаются вовсе. */
      var segs = [];
      for (var g = 0; g + 1 < pts.length; g += GROUP) {
        var end = Math.min(g + GROUP, pts.length - 1);
        var d = 'M ' + n(pts[g].x) + ' ' + n(pts[g].y);

        for (var q = g; q < end; q++) {
          var p0 = pts[q - 1] || pts[q], p1 = pts[q];
          var p2 = pts[q + 1], p3 = pts[q + 2] || p2;
          // Catmull-Rom в кубическую, натяжение занижено: на резких сменах
          // стороны каноническое выносит кривую за пределы коридора
          d += ' C ' + n(p1.x + (p2.x - p0.x) / 10) + ' ' + n(p1.y + (p2.y - p0.y) / 10) +
               ' '   + n(p2.x - (p3.x - p1.x) / 10) + ' ' + n(p2.y - (p3.y - p1.y) / 10) +
               ' '   + n(p2.x) + ' ' + n(p2.y);
        }
        segs.push({ a: pts[g].y, b: pts[end].y, d: d, t: -1 });
      }

      svg.setAttribute('width', docW);
      svg.setAttribute('height', docH);
      svg.setAttribute('viewBox', '0 0 ' + docW + ' ' + docH);

      paths.forEach(function (el) { layer.removeChild(el); });
      paths = segs.map(function (s) {
        var el = document.createElementNS(NS, 'path');
        el.setAttribute('class', 'thread__path');
        el.setAttribute('pathLength', '1');
        el.setAttribute('stroke', 'url(#' + GRAD + ')');
        el.setAttribute('d', s.d);
        el.style.strokeDashoffset = '1';
        layer.appendChild(el);
        return el;
      });

      /* Цвет по темам секций: на айвори и креме — грейж, на тёмных и в
         подвале — золото. Один градиент с жёсткими стопами по их границам
         дешевле, чем резать путь на куски по темам. */
      var darks = [];
      document.querySelectorAll('.sec--dark, .ftr').forEach(function (el) {
        var t = docTop(el);
        darks.push([t, t + el.offsetHeight]);
      });
      darks.sort(function (a, b) { return a[0] - b[0]; });

      var stops = [[0, LIGHT]];
      darks.forEach(function (rg) {
        stops.push([rg[0], LIGHT], [rg[0], DARK], [rg[1], DARK], [rg[1], LIGHT]);
      });
      stops.push([docH, LIGHT]);

      grad.setAttribute('y1', '0');
      grad.setAttribute('y2', docH);
      grad.textContent = '';
      stops.forEach(function (s) {
        var st = document.createElementNS(NS, 'stop');
        st.setAttribute('offset', Math.min(Math.max(s[0] / docH, 0), 1).toFixed(5));
        st.setAttribute('stop-color', s[1]);
        grad.appendChild(st);
      });

      // X линии на заданной высоте — узел обязан сидеть на ней, а не рядом
      function xAt(y) {
        var i = (y - yTop) / STEP;
        if (i <= 0) return pts[0].x;
        if (i >= pts.length - 1) return pts[pts.length - 1].x;
        var lo = Math.floor(i);
        return pts[lo].x + (pts[lo + 1].x - pts[lo].x) * (i - lo);
      }

      nodes.forEach(function (c) { if (c) layer.removeChild(c); });
      nodes = segs.map(function (s) {
        var mark = null;
        for (var i = 0; i < marks.length; i++) {
          if (marks[i].y > s.a && marks[i].y <= s.b) { mark = marks[i]; break; }
        }
        if (!mark) return null;

        var sec = mark.el.closest('section');
        var onDark = darks.some(function (rg) { return mark.y >= rg[0] && mark.y <= rg[1]; });
        var cx = xAt(mark.y);

        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'thread__node');
        c.setAttribute('cx', n(cx));
        c.setAttribute('cy', n(mark.y));
        c.setAttribute('r', '4.5');
        // заливка фоном своей секции: узел читается кольцом на линии,
        // а не точкой, приклеенной поверх неё
        c.setAttribute('fill', sec ? getComputedStyle(sec).backgroundColor : 'none');
        c.setAttribute('stroke', onDark ? DARK : LIGHT);
        c.style.transformOrigin = n(cx) + 'px ' + n(mark.y) + 'px';
        layer.appendChild(c);
        return c;
      });

      parts = segs;
      built = true;
      builtH = docH;
    }

    function update() {
      if (!built) return;

      // «голова» нити идёт чуть ниже центра экрана: так линия ведёт взгляд
      // вперёд, а не догоняет уже прочитанное
      var head = reduced
        ? Infinity
        : window.pageYOffset + window.innerHeight * 0.72;

      for (var i = 0; i < parts.length; i++) {
        var s = parts[i];
        var t = (head - s.a) / (s.b - s.a || 1);
        t = t < 0 ? 0 : t > 1 ? 1 : t;

        // отрезок трогаем, только если он реально сдвинулся: лишняя правка
        // атрибута — это лишняя перерисовка его куска
        if (t === s.t) continue;
        if (Math.abs(t - s.t) < 0.004 && t !== 0 && t !== 1) continue;

        s.t = t;
        paths[i].style.strokeDashoffset = String(1 - t);
        if (nodes[i]) nodes[i].classList.toggle('is-on', t >= 1);
      }
    }

    function sync() {
      if (!wide.matches) {
        if (svg.parentNode) svg.parentNode.removeChild(svg);
        built = false;
        return;
      }
      if (!svg.parentNode) document.body.appendChild(svg);
      build();
      update();
    }

    var timer = null;
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(sync, 150);
    }

    if (!reduced) {
      var ticking = false;
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          update();
          /* Высота страницы едет, пока догружаются ленивые кадры, и маршрут
             перестаёт совпадать с пустотами. Проверяем это здесь, а не через
             ResizeObserver на body: наблюдатель, который сам же читает
             offsetHeight, повторно будит себя на дробных высотах и вешает
             вкладку — проверено. Скролл и так идёт кадрами, лишний механизм
             не нужен. */
          if (built && Math.abs(document.body.offsetHeight - builtH) > 4) schedule();
        });
      }, { passive: true });
    }

    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule);
    if (wide.addEventListener) wide.addEventListener('change', schedule);
    else if (wide.addListener) wide.addListener(schedule);

    sync();
  })();


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
