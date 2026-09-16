/* ═══════════════════════════════════════════════════════════════════
   D-pay — پخش‌کنندهٔ داخلی کانال یوتیوب «D pay» (@d-pay)
   هدف: مخاطب بدون ترک سایت، ویدیوها را در یک پنجرهٔ شناور ببیند.

   اصول:
   • تا لحظهٔ کلیک روی «پخش»، هیچ درخواستی به YouTube نمی‌رود (facade + iframe تزریقی)
   • پخش از youtube-nocookie.com با rel=0 و playlist (پخش پیوستهٔ ویدیوهای کانال)
   • فهرست از DOM خوانده می‌شود؛ افزودن یک <li class="yt-item"> همه‌چیز را
     (پلی‌لیست، قبلی/بعدی، نوار ویدیوها، شمارش) خودکار به‌روز می‌کند
   • پنجره مودال نیست: سایت پشت آن زنده می‌ماند (اسکرول، دستیار صوتی، پنل پذیرنده)
   • تنظیمات: window.DPAY_YT = { ... }   (کلیدها در README)
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var doc = document;
function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
function $(s, r) { return (r || doc).querySelector(s); }
function toFa(v) { return String(v).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
function norm(s) {
  return String(s).toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[أإآ]/g, 'ا')
    .replace(/‌/g, '').replace(/\s+/g, ' ').trim();
}

var LS_WIN   = 'dpay-yt-win';
var LS_WATCH = 'dpay-yt-watched';
var LS_NUDGE = 'dpay-yt-nudge';
var DOC_TITLE = doc.title;

var DEF = {
  nocookie : 'https://www.youtube-nocookie.com',
  channel  : 'https://www.youtube.com/@d-pay',
  autoplay : true,      /* بعد از کلیک، بلافاصله پخش شود */
  loopList : true,      /* پارامتر playlist → ویدیوی بعدی در همان پنجره */
  modest   : true,
  rel      : 0,
  size     : 'md',      /* sm | md | lg */
  dock     : 'start',   /* start | end */
  deepLink : true       /* ?yt=VIDEO_ID  و  #media/VIDEO_ID */
};
var CFG = {}, kk;
for (kk in DEF) CFG[kk] = DEF[kk];
for (kk in (window.DPAY_YT || {})) CFG[kk] = window.DPAY_YT[kk];

var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var smooth = reduce ? 'auto' : 'smooth';

function ls(key, val) {
  try {
    if (val === undefined) {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }
    if (val === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(val));
  } catch (e) { /* حالت خصوصی / file:// */ }
  return null;
}

/* ─── منبع داده: خودِ HTML ─── */
var win   = $('#ytWin');
var frame = $('#ytFrame');
var list  = $('#ytList');
if (!win || !frame || !list) return;

var items = $$('.yt-item', list).map(function (el, i) {
  var o = {
    i   : i,
    el  : el,
    id  : el.getAttribute('data-yt') || '',
    t   : el.getAttribute('data-title') || '',
    dur : el.getAttribute('data-dur') || '',
    cat : el.getAttribute('data-cat') || 'all'
  };
  el.setAttribute('data-yt-idx', String(i));
  return o;
});
var byId = {};
items.forEach(function (o) { if (o.id) byId[o.id] = o; });
var IDS = items.map(function (o) { return o.id; });

var watched = ls(LS_WATCH) || [];
var prefs   = ls(LS_WIN) || {};
if (prefs.size && /^(sm|md|lg)$/.test(prefs.size)) win.dataset.size = prefs.size;
if (prefs.dock === 'end') win.dataset.dock = 'end';

var iframe = null, cur = -1, isOpen = false, trigger = null, minRestored = null;

/* ═══════════════ نوار ویدیوها داخل پنجره ═══════════════ */
var strip = $('#ytStrip');
if (strip && !strip.children.length) {
  strip.innerHTML = items.map(function (o) {
    return '<button type="button" class="ytstrip__it" data-strip="' + o.i + '" title="' + esc(o.t) + '"' +
           ' aria-label="پخش ' + esc(o.t) + '">' +
           '<img src="https://i.ytimg.com/vi/' + o.id + '/mqdefault.jpg" alt="" loading="lazy" decoding="async">' +
           '<span class="ytstrip__dur" dir="ltr">' + esc(toFa(o.dur)) + '</span></button>';
  }).join('');
}

/* ═══════════════ هستهٔ پخش ═══════════════ */
function embedUrl(o, withList) {
  var q = ['playsinline=1', 'rel=' + CFG.rel, 'iv_load_policy=3'];
  if (CFG.autoplay) q.unshift('autoplay=1');
  if (CFG.modest) q.push('modestbranding=1');
  if (withList && CFG.loopList && IDS.length > 1 && o) {
    q.push('playlist=' + IDS.join(','), 'index=' + o.i);
  }
  return CFG.nocookie + '/embed/' + encodeURIComponent(o ? o.id : '') + '?' + q.join('&');
}

function markWatched(id) {
  if (!id || watched.indexOf(id) > -1) return;
  watched.push(id);
  ls(LS_WATCH, watched.slice(-40));
  paintWatched();
}
function paintWatched() {
  var n = 0;
  items.forEach(function (o) {
    var on = watched.indexOf(o.id) > -1;
    o.el.classList.toggle('is-watched', on);
    var f = $('.yt-item__seen', o.el);
    if (f) f.hidden = !on;
    if (on) n++;
  });
  var cnt = $('#ytSeen');
  if (cnt) cnt.textContent = toFa(n);
  var tot = $('#ytTotal');
  if (tot) tot.textContent = toFa(items.length);
}

function setActive(o) {
  items.forEach(function (x) {
    var on = !!o && x.i === o.i;
    x.el.classList.toggle('is-play', on);
    if (on) x.el.setAttribute('aria-current', 'true'); else x.el.removeAttribute('aria-current');
    var s2 = strip && $('.ytstrip__it[data-strip="' + x.i + '"]', strip);
    if (s2) s2.classList.toggle('is-play', on);
  });
  if (strip && o) {
    var s = $('.ytstrip__it[data-strip="' + o.i + '"]', strip);
    if (s) {
      var want = s.offsetLeft - (strip.clientWidth - s.clientWidth) / 2;
      if (Math.abs(want - strip.scrollLeft) > 8) strip.scrollTo({ left: want, behavior: smooth });
    }
  }
  var idxTxt = $('#ytIdx');
  if (idxTxt) idxTxt.textContent = toFa((o ? o.i : 0) + 1) + ' / ' + toFa(items.length);
  if (!o) return;
  var tt = $('#ytWinTitle');
  if (tt) tt.textContent = o.t;
  win.setAttribute('aria-label', 'پخش‌کنندهٔ ویدیوی D-pay — ' + o.t);
  var yt = $('#ytWatchOnYt');
  if (yt) yt.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(o.id);
  var sh = $('#ytShareLink');
  if (sh) sh.setAttribute('data-ytcopy', location.origin + location.pathname + '?yt=' + encodeURIComponent(o.id));
}

function load(o) {
  if (!o) return;
  cur = o.i;
  if (!iframe) {
    iframe = doc.createElement('iframe');
    iframe.className = 'ytwin__if';
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('title', 'پخش‌کنندهٔ یوتیوب D-pay');
    frame.appendChild(iframe);
  }
  iframe.src = embedUrl(o, true);
  frame.classList.add('is-live');
  setActive(o);
  markWatched(o.id);
  hideNudge();
}

function shown() { return !win.hidden; }
function openWin() {
  if (isOpen) return;
  if (minRestored) { win.dataset.size = minRestored; minRestored = null; }
  if (shown()) {                    /* بازگشت از حالت جمع‌شده — پخش قطع نشده */
    isOpen = true;
    win.classList.add('is-in');
    doc.body.classList.add('yt-open');
    return;
  }
  isOpen = true;
  win.hidden = false;
  win.classList.add('is-in');
  doc.body.classList.add('yt-open');
  doc.addEventListener('keydown', onKey, true);
  setTimeout(function () { if (win.focus) win.focus(); }, 40);   // Esc / Tab از همین‌جا
}
function closeWin(minimize) {
  if (minimize) {
    if (!isOpen) return;
    isOpen = false;
    minRestored = win.dataset.size === 'sm' ? 'md' : win.dataset.size;
    win.dataset.size = 'sm';
    win.classList.remove('is-in');
    saveWin();                      /* پخش و کلید Esc فعال می‌مانند */
    return;
  }
  if (!shown()) { doc.removeEventListener('keydown', onKey, true); return; }
  isOpen = false;
  win.classList.remove('is-in');
  doc.body.classList.remove('yt-open');
  doc.removeEventListener('keydown', onKey, true);
  if (iframe) iframe.src = 'about:blank';
  frame.classList.remove('is-live');
  win.hidden = true;
  doc.title = DOC_TITLE;
  setActive(null);
  if (trigger && trigger.focus) trigger.focus();
  trigger = null;
}
function onKey(e) {
  if (e.key !== 'Escape' || e.ctrlKey || e.metaKey || e.altKey) return;
  var t = e.target;
  if (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName || '')) return;
  e.preventDefault(); e.stopPropagation();
  closeWin(false);          /* حتی در حالت جمع‌شده، پخش را می‌بندد */
}
function play(idOrIdx, fromEl) {
  var o = typeof idOrIdx === 'number' ? items[idOrIdx] : byId[idOrIdx];
  if (!o) o = items[0];
  if (!o) return;
  if (fromEl) trigger = fromEl;
  openWin();
  load(o);
}
function step(d) {
  if (!items.length) return;
  var n = ((cur < 0 ? 0 : cur) + d + items.length) % items.length;
  load(items[n]);
}
function saveWin() { ls(LS_WIN, { size: win.dataset.size || 'md', dock: win.dataset.dock || 'start' }); }

/* ═══════════════ اتصال‌ها ═══════════════ */
/* ۱) هر «پخش» روی صفحه: کارت فهرست، facade تیزر، تی저، CTA جمع‌بندی */
doc.addEventListener('click', function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var a = t.closest('a[data-yt], button[data-yt]');
  if (a && byId[a.getAttribute('data-yt')]) {
    e.preventDefault();
    play(a.getAttribute('data-yt'), a);
    return;
  }
  var all = t.closest('[data-yt-all]');
  if (all) { e.preventDefault(); play(0, all); }
});

$$('[data-yt-close]', win).forEach(function (b) { b.addEventListener('click', function () { closeWin(false); }); });
$$('[data-yt-min]', win).forEach(function (b) {
  b.addEventListener('click', function () {
    if (isOpen) closeWin(true);
    else if (shown()) openWin();    /* کلیک دوباره = بازگرداندن پنجرهٔ جمع‌شده */
  });
});

var sizeBtn = $('#ytSize');
if (sizeBtn) sizeBtn.addEventListener('click', function () {
  var order = ['sm', 'md', 'lg'];
  win.dataset.size = order[(order.indexOf(win.dataset.size || 'md') + 1) % order.length];
  sizeBtn.setAttribute('aria-label', 'اندازهٔ پنجره — ' + win.dataset.size.toUpperCase());
  saveWin();
});
var dockBtn = $('#ytDockBtn');
if (dockBtn) dockBtn.addEventListener('click', function () {
  win.dataset.dock = win.dataset.dock === 'end' ? 'start' : 'end';
  saveWin();
});
var autoBtn = $('#ytAuto');
if (autoBtn) {
  autoBtn.classList.toggle('is-on', !!CFG.loopList);
  autoBtn.setAttribute('aria-pressed', CFG.loopList ? 'true' : 'false');
  autoBtn.addEventListener('click', function () {
    CFG.loopList = !CFG.loopList;
    autoBtn.classList.toggle('is-on', CFG.loopList);
    autoBtn.setAttribute('aria-pressed', CFG.loopList ? 'true' : 'false');
    if (cur > -1) {
      load(items[cur]);
      toast(CFG.loopList ? 'پخش پیوستهٔ کانال روشن شد' : 'پخش پیوستهٔ کانال خاموش شد');
    }
  });
}
var prevBtn = $('#ytPrev'), nextBtn = $('#ytNext');
if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
if (strip) strip.addEventListener('click', function (e) {
  var b = e.target.closest ? e.target.closest('[data-strip]') : null;
  if (b) load(items[+b.getAttribute('data-strip')]);
});

/* ۲) جست‌وجو و دسته‌بندی فهرست کانال */
var search = $('#ytSearch'), catBtns = $$('.yt-cats button'), q = '', cat = 'all';
function applyFilter() {
  var shown = 0;
  items.forEach(function (o) {
    var okQ = !q || norm(o.t + ' ' + o.cat).indexOf(q) > -1;
    var okC = cat === 'all' || o.cat === cat;
    o.el.hidden = !(okQ && okC);
    if (okQ && okC) shown++;
  });
  var empty = $('#ytEmpty');
  if (empty) empty.hidden = shown > 0;
  var n = $('#ytShown');
  if (n) n.textContent = toFa(shown);
}
if (search) search.addEventListener('input', function () { q = norm(search.value); applyFilter(); });
catBtns.forEach(function (b) {
  b.addEventListener('click', function () {
    catBtns.forEach(function (x) { x.classList.toggle('is-on', x === b); });
    cat = b.getAttribute('data-cat') || 'all';
    applyFilter();
  });
});
paintWatched();
applyFilter();

/* ۳) کپی لینک عمیق همان ویدیو (data-ytcopy — جدا از data-copy کدهای API) */
$$('[data-ytcopy]').forEach(function (b) {
  b.addEventListener('click', function (e) {
    var v = b.getAttribute('data-ytcopy');
    if (!v) return;
    e.preventDefault();
    var done = function () { toast('لینک کپی شد'); b.classList.add('done'); setTimeout(function () { b.classList.remove('done'); }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(v).then(done, function () { done(); });
    else done();
  });
});

function toast(msg) {
  var t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
}

/* ۴) پوسترها: درخواست برونی فقط وقتی بخش نزدیک دید است */
var lazy = $$('img[data-lazy-src]');
function swap(im) { im.src = im.getAttribute('data-lazy-src'); im.removeAttribute('data-lazy-src'); }
if (lazy.length && 'IntersectionObserver' in window) {
  var lio = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { swap(en.target); lio.unobserve(en.target); } });
  }, { rootMargin: '320px 0px' });
  lazy.forEach(function (im) { lio.observe(im); });
} else {
  lazy.forEach(swap);
}
$$('.yt-thumb img, .yt-stage__poster').forEach(function (im) {
  im.addEventListener('error', function () {
    var box = im.closest('.yt-thumb') || im.closest('.yt-stage__frame');
    if (box) box.classList.add('is-noposter');
    im.style.visibility = 'hidden';
  });
});

/* ۵) تیزر یک‌باره: بعد از ورود به پردهٔ دوم، اگر بخش ویدیو در دید نبود */
var nudge = $('#ytNudge');
function hideNudge() {
  if (!nudge) return;
  nudge.classList.remove('is-show');
  ls(LS_NUDGE, 1);
  setTimeout(function () { if (!nudge.classList.contains('is-show')) nudge.hidden = true; }, 300);
}
if (nudge) {
  var media = $('#media');
  var showNudge = function () {
    if (ls(LS_NUDGE)) return;
    if (media) {
      var r = media.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) && r.bottom > 0) { ls(LS_NUDGE, 1); return; }
    }
    nudge.hidden = false;
    requestAnimationFrame(function () { nudge.classList.add('is-show'); });
    setTimeout(hideNudge, 16000);
  };
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { showNudge(); nio.disconnect(); } });
    }, { threshold: 0.05 });
    nio.observe($('#interactive') || doc.body);
  } else setTimeout(showNudge, 5000);
  var nx = $('#ytNudgeX');
  if (nx) nx.addEventListener('click', hideNudge);
}

/* ۶) لینک عمیق: ?yt=ID یا #media/ID (برای اشتراک‌گذاری یک ویدیو) */
function deepFromUrl() {
  var m = /[?&](?:yt|play)=([A-Za-z0-9_-]{6,20})/.exec(location.search || '') ||
          /^#(?:media|yt)\/([A-Za-z0-9_-]{6,20})/.exec(location.hash || '');
  if (m && byId[m[1]]) { play(m[1]); return true; }
  var all = /[?&](?:yt|play)=all\b/.test(location.search || '') || /^#(?:media|yt)\/all\b/.test(location.hash || '');
  if (all) { play(0); return true; }
  return false;
}
if (CFG.deepLink) {
  if (doc.readyState === 'complete') setTimeout(deepFromUrl, 260);
  else window.addEventListener('load', function () { setTimeout(deepFromUrl, 260); });
  window.addEventListener('hashchange', deepFromUrl);
}

/* ۷) لینک‌های کانال */
var more = $('#ytChanMore');
if (more) more.setAttribute('href', CFG.channel + '/videos');
var sub = $('#ytChanSub');
if (sub) sub.setAttribute('href', CFG.channel + '?sub_confirmation=1');

/* ۸) دکمهٔ صحنهٔ پایانی دک: پرش به بخش ویدیوها */
var endBtn = $('#endVideos');
if (endBtn && $('#media')) {
  endBtn.addEventListener('click', function (e) {
    e.preventDefault();
    $('#media').scrollIntoView({ behavior: smooth, block: 'start' });
    if (history.replaceState) history.replaceState(null, '', '#media');
  });
}

/* API عمومی — همان سبک DpayAI */
window.DpayYT = {
  play   : function (id) { play(id); return this; },
  open   : function (id) { play(id == null ? 0 : id); return this; },
  next   : function () { step(1); return this; },
  prev   : function () { step(-1); return this; },
  close  : function () { closeWin(false); return this; },
  minimize: function () { closeWin(true); return this; },
  isOpen : function () { return shown(); },
  current: function () { return cur < 0 ? null : items[cur].id; },
  watched: function () { return watched.slice(); },
  list   : function () { return IDS.slice(); },
  config : CFG
};
})();
