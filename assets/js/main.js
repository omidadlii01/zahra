/* ═══════════════════════════════════════════════════════════════
   D-pay — ارائه تعاملی | main.js
   موتور دک (اسکرول ← ۱۳ صحنه سینمایی) + پرده دوم تعاملی
   صفر وابستگی خارجی — بدون فریم‌ورک، بدون CDN
   ═══════════════════════════════════════════════════════════════ */
(function () {
'use strict';

var $  = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var smooth = reduceMotion ? 'auto' : 'smooth';

/* — اعداد فارسی — */
function toFa(str) { return String(str).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; }); }
function fmt(n, min, max) {
  try {
    return new Intl.NumberFormat('fa-IR', {
      minimumFractionDigits: min == null ? 2 : min,
      maximumFractionDigits: max == null ? (min == null ? 2 : max) : max
    }).format(n);
  } catch (e) {
    return toFa(Number(n).toFixed(min == null ? 2 : min));
  }
}

/* ═══════════════ پرده اول: دک سینمایی ═══════════════ */
var deck      = $('#deck');
var stage     = $('#deckStage');
var scenesBox = $('#deckScenes');
var scenes    = $$('.scene', scenesBox);
var N         = scenes.length;
var sweep     = $('#deckSweep');
var progBar   = $('#deckProgress');
var sceneNum  = $('#sceneNum');
var sceneTot  = $('#sceneTot');
var slideChip = $('#slideChip');
var ticks     = $$('.deck-ticks .tick');
var hint      = $('#deckHint');
var btnPrev   = $('#btnPrev');
var btnNext   = $('#btnNext');
var siteNav   = $('#siteNav');

deck.style.setProperty('--n', N);
sceneTot.textContent = toFa(N);

var idx = -1;
var scaleMap = new WeakMap();

function stepH()   { return stage.getBoundingClientRect().height || window.innerHeight; }
function deckTop() { return deck.getBoundingClientRect().top + (window.scrollY || window.pageYOffset); }
function within()  { return (window.scrollY || window.pageYOffset) - deckTop(); }
function curIdx()  { return Math.max(0, Math.min(N - 1, Math.floor(within() / stepH() + 1e-4))); }

/* — Scale-to-fit: مطمئن شو هر صحنه در هر اندازه صفحه جا می‌شود — */
function fitScene(sc) {
  var fit = $('.scene-fit', sc);
  if (!fit) return;
  fit.style.transform = 'none';
  var cs   = getComputedStyle(sc);
  var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  var availW = Math.max(80, scenesBox.clientWidth - padX - 4);
  var availH = Math.max(80, scenesBox.clientHeight - padY - 4);
  var r = fit.getBoundingClientRect();
  var s = Math.min(1.02, availW / r.width, availH / r.height);
  if (!isFinite(s)) s = 1;
  s = Math.max(0.32, s);
  scaleMap.set(fit, s);
  applyFit(sc);
}
function applyFit(sc) {
  var fit = $('.scene-fit', sc);
  if (!fit) return;
  var s = scaleMap.get(fit) || 1;
  var sp = sc._sp || 0;
  fit.style.transform = reduceMotion
    ? 'scale(' + s + ')'
    : 'scale(' + s + ') translateY(' + ((sp - 0.5) * -14).toFixed(2) + 'px)';
}
function refitActive() { if (idx >= 0) fitScene(scenes[idx]); }

/* — فعال‌سازی صحنه: ترنزیشن blur/scale/عمودی + نور جاروبی + شمارنده — */
function activate(i, dir) {
  if (i === idx) return;
  var first = (idx === -1);
  idx = i;
  scenes.forEach(function (sc, k) {
    sc.classList.toggle('is-active', k === i);
    sc.classList.toggle('is-past',  k <  i);
    sc.classList.toggle('is-future', k >  i);
    sc.setAttribute('aria-hidden', k === i ? 'false' : 'true');
  });
  scenes[i]._sp = 0;
  fitScene(scenes[i]);

  sceneNum.textContent  = (i + 1 < 10 ? '۰' : '') + toFa(i + 1);
  var slide = scenes[i].dataset.slide;
  slideChip.textContent = 'اسلاید ' + toFa(slide);
  var acc = scenes[i].style.getPropertyValue('--acc').trim() || '#07C8DA';
  stage.style.setProperty('--acc-live', acc);
  ticks.forEach(function (t) { t.classList.toggle('is-on', t.dataset.slide === slide); });

  hint.classList.toggle('is-off', i > 0);
  btnNext.title = 'صحنه بعدی';
  btnNext.setAttribute('aria-label', 'صحنه بعدی');
  if (i === N - 1) { btnNext.title = 'ورود به بخش تعاملی'; btnNext.setAttribute('aria-label', btnNext.title); }
  btnPrev.title = (i === 0 ? 'بالای صفحه' : 'صحنه قبلی');

  if (!first && dir !== 'init' && !reduceMotion) {
    sweep.classList.remove('run');
    void sweep.offsetWidth;
    sweep.classList.add('run');
  }
}

/* — حلقه اسکرول — */
var ticking = false;
function render() {
  ticking = false;
  var step = stepH();
  var t = within();
  var raw = t / step;
  var i = Math.max(0, Math.min(N - 1, Math.floor(raw + 1e-4)));
  var sp = Math.max(0, Math.min(1.4, raw - i));
  if (scenes[i]) { scenes[i]._sp = Math.min(1, sp); if (i === idx) applyFit(scenes[i]); }
  if (i !== idx) activate(i, i > idx ? 1 : -1);
  progBar.style.width = (Math.max(0, Math.min(1, t / (N * step))) * 100).toFixed(2) + '%';
  siteNav.classList.toggle('is-show', t > step * 0.7);
}
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(render); } }

function goTo(i) {
  i = Math.max(0, Math.min(N - 1, i));
  window.scrollTo({ top: Math.round(deckTop() + i * stepH()) + 1, behavior: smooth });
}

/* — کنترل‌ها: قبلی/بعدی، تیک‌های پرش به ۶ اسلاید، کیبورد — */
btnPrev.addEventListener('click', function () {
  if (within() <= 0) { window.scrollTo({ top: 0, behavior: smooth }); return; }
  goTo(curIdx() - 1);
});
btnNext.addEventListener('click', function () {
  var cur = curIdx();
  if (cur >= N - 1) { $('#interactive').scrollIntoView({ behavior: smooth }); return; }
  goTo(cur + 1);
});
ticks.forEach(function (t) {
  t.addEventListener('click', function () { goTo(+t.dataset.target); });
});
document.addEventListener('keydown', function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!modalEl || !modalEl.hidden) return;
  var step = stepH(), t = within();
  if (t < -60 || t > N * step + 60) return;             // دک در دید نیست
  var cur = curIdx();
  switch (e.key) {
    case 'ArrowLeft':  case 'PageDown': goTo(cur + 1); break;   // در RTL، «بعدی» سمت چپ است
    case 'ArrowRight': case 'PageUp':   goTo(cur - 1); break;
    case 'Home': window.scrollTo({ top: Math.round(deckTop()), behavior: smooth }); break;
    case 'End':  goTo(N - 1); break;
    default: return;
  }
  e.preventDefault();
});

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', function () { refitActive(); onScroll(); });
if (window.ResizeObserver) new ResizeObserver(refitActive).observe(scenesBox);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { refitActive(); render(); });

/* — لینک عمیق: #scene-7 یا #slide-3 — */
function fromHash() {
  var m = /^#(scene|slide)-(\d+)$/.exec(location.hash || '');
  if (!m) return false;
  var v = +m[2];
  if (m[1] === 'slide') {
    var t = ticks.filter(function (x) { return x.dataset.slide === String(v); })[0];
    if (!t) return false;
    v = +t.dataset.target;
  } else v -= 1;
  if (v < 0 || v > N - 1) return false;
  activate(0, 'init');
  goTo(v);
  return true;
}
window.addEventListener('hashchange', fromHash);

/* — CTAهای صحنه پایانی — */
$('#enterInteractive').addEventListener('click', function () {
  $('#interactive').scrollIntoView({ behavior: smooth });
});
$('#replayTop').addEventListener('click', function () { goTo(0); });

/* ═══════════════ پیمایه سایت + اسکرول نرم ═══════════════ */
$$('a[data-scroll]').forEach(function (a) {
  a.addEventListener('click', function (e) {
    var el = $(a.getAttribute('href'));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: smooth, block: 'start' });
    history.replaceState(null, '', a.getAttribute('href'));
  });
});

/* — ظاهر شدن بلوک‌های پرده دوم با اسکرول — */
if ('IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    });
  }, { threshold: 0.14 });
  $$('[data-reveal]').forEach(function (el) { io.observe(el); });
} else {
  $$('[data-reveal]').forEach(function (el) { el.classList.add('is-in'); });
}

/* ═══════════════ آزمایشگاه اوراکل (نمایشی) ═══════════════ */
var RATES = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1, ETH: 3540.18, BTC: 67420.35 };
var DIG   = { USDT: 2, USDC: 2, BUSD: 2, DAI: 2, ETH: 6, BTC: 8 };
var labUsd = $('#usdAmount'), labNet = $('#netSelect'), labCur = 'USDT';
var labOut = $('#labAmt'), labCurEl = $('#labCur');
var labRUsd = $('#labUsd'), labRRate = $('#labRate'), labRNet = $('#labNet'), labRTick = $('#labTick');
var labNote = $('.lab__note');

function labCalc() {
  var a = parseFloat(labUsd.value);
  if (!isFinite(a) || a < 0) a = 0;
  var rate = RATES[labCur];
  labOut.textContent   = fmt(a / rate, DIG[labCur], DIG[labCur]);
  labCurEl.textContent = labCur;
  labRUsd.textContent  = fmt(a) + ' $';
  labRRate.textContent = '1 ' + labCur + ' = ' + fmt(rate) + ' $';
  labRNet.textContent  = labNet.value;
}
function flashNote() {
  if (reduceMotion) return;
  labNote.classList.remove('flash');
  void labNote.offsetWidth;
  labNote.classList.add('flash');
}
$$('#curGroup button').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('#curGroup button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    labCur = b.dataset.cur;
    labCalc(); flashNote();
  });
});
$$('#amountChips button').forEach(function (b) {
  b.addEventListener('click', function () { labUsd.value = b.dataset.amt; labCalc(); flashNote(); });
});
labUsd.addEventListener('input', labCalc);
labNet.addEventListener('change', function () { labCalc(); flashNote(); });

/* تیک «لحظه‌ای» — فقط وقتی بخش در دید و تب فعال است */
var labVisible = true;
if ('IntersectionObserver' in window) {
  new IntersectionObserver(function (es) { labVisible = es[0].isIntersecting; }, { threshold: 0.08 })
    .observe($('#lab'));
}
setInterval(function () {
  if (!labVisible || document.hidden) return;
  RATES.ETH = RATES.ETH * (1 + (Math.random() - 0.5) * 0.0024);
  RATES.BTC = RATES.BTC * (1 + (Math.random() - 0.5) * 0.0024);
  labRTick.textContent = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  labCalc();
}, 2200);
labCalc();

/* ═══════════════ تب‌های یکپارچه‌سازی ═══════════════ */
$$('.tabs__btn').forEach(function (b) {
  b.addEventListener('click', function () {
    $$('.tabs__btn').forEach(function (x) {
      var on = x === b;
      x.classList.toggle('is-on', on);
      x.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.tabs__panel').forEach(function (p) {
      var on = p.id === 'panel-' + b.dataset.tab;
      p.classList.toggle('is-on', on);
      p.hidden = !on;
    });
  });
});

/* — دکمه کپی کد — */
$$('.copybtn').forEach(function (b) {
  b.addEventListener('click', function () {
    var code = document.getElementById(b.dataset.copy);
    if (!code) return;
    var txt = code.textContent;
    var done = function () {
      b.textContent = 'کپی شد ✓';
      b.classList.add('done');
      setTimeout(function () { b.textContent = 'کپی'; b.classList.remove('done'); }, 1700);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { legacyCopy(txt, done); });
    } else {
      legacyCopy(txt, done);
    }
  });
});
function legacyCopy(txt, done) {
  var ta = document.createElement('textarea');
  ta.value = txt;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;opacity:0;inset-inline-start:-900px;top:0';
  document.body.appendChild(ta);
  ta.select();
  try { if (document.execCommand('copy')) done(); }
  catch (e) { toast('کپی نشد؛ متن را دستی انتخاب کنید'); }
  document.body.removeChild(ta);
}

/* — موکاپ تنظیمات ووکامرس — */
var wpToggle = $('.wp-toggle');
if (wpToggle) wpToggle.addEventListener('click', function () { wpToggle.classList.toggle('is-on'); });
var wpSave = $('#wpSave');
if (wpSave) wpSave.addEventListener('click', function () { toast('تنظیمات ذخیره شد (نمایشی)'); });

/* ═══════════════ پنل نمایشی پذیرنده + مودال برداشت دستی ═══════════════ */
var balance  = 2450.75;
var orderSeq = 1402;
var modalEl  = $('#wdModal');
var wdForm   = $('#wdForm');
var wdFlow   = $('#wdFlow');
var wdErr    = $('#wdErr');

function setBalanceUI() {
  $('#balanceV').textContent = fmt(balance);
  $('#wdAvail').textContent  = fmt(balance);
}
function resetFlow() {
  wdErr.textContent = '';
  $('#wdDone').hidden = true;
  $('#wdBar').style.width = '0%';
  $$('#wdSteps li').forEach(function (li) { li.classList.remove('done', 'doing'); });
}
function openModal() {
  modalEl.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  wdForm.hidden = false;
  wdFlow.hidden = true;
  resetFlow();
  setBalanceUI();
  var amtEl = $('#wdAmt');
  amtEl.max = balance.toFixed(2);
  if (parseFloat(amtEl.value) > balance) amtEl.value = balance.toFixed(2);
  document.addEventListener('keydown', escClose);
  modalEl.addEventListener('keydown', trapTab);
  setTimeout(function () { $('#wdAddr').focus(); }, 80);
}
function closeModal() {
  modalEl.hidden = true;
  document.documentElement.style.overflow = '';
  document.removeEventListener('keydown', escClose);
  modalEl.removeEventListener('keydown', trapTab);
  $('#openWithdraw').focus();
}
function escClose(e) { if (e.key === 'Escape') closeModal(); }
function trapTab(e) {
  if (e.key !== 'Tab') return;
  var f = $$('button, input, select, [tabindex]:not([tabindex="-1"])', modalEl)
    .filter(function (el) { return !el.disabled && el.offsetParent !== null; });
  if (!f.length) return;
  var first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
  else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
}
$('#openWithdraw').addEventListener('click', openModal);
$$('[data-close]', modalEl).forEach(function (el) { el.addEventListener('click', closeModal); });
$('#wdMax').addEventListener('click', function () { $('#wdAmt').value = balance.toFixed(2); });

$('#wdSubmit').addEventListener('click', function () {
  var addr = $('#wdAddr').value.trim();
  var amt  = parseFloat($('#wdAmt').value);
  if (!/^0x[0-9a-fA-F]{6,64}$/.test(addr)) {
    wdErr.textContent = 'آدرس ولت معتبر نیست؛ با 0x شروع شود و هگزادسیمال باشد.';
    $('#wdAddr').focus();
    return;
  }
  if (!isFinite(amt) || amt <= 0) {
    wdErr.textContent = 'مبلغ برداشت را وارد کنید.';
    return;
  }
  if (amt > balance) {
    wdErr.textContent = 'مبلغ بیشتر از موجودی قابل برداشت است.';
    return;
  }
  wdErr.textContent = '';
  runFlow(amt, addr, $('#wdNet').value, $('#wdCur').value);
});

function shortAddr(a) { return a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }
function randHex(n) {
  var s = '0123456789abcdef', o = '';
  for (var i = 0; i < n; i++) o += s[Math.floor(Math.random() * 16)];
  return o;
}
function netShort(net) {
  var m = { 'BNB Smart Chain (BSC)': 'BSC', 'Ethereum (ETH)': 'ETH', 'Polygon (MATIC)': 'MATIC', 'Avalanche (AVAX)': 'AVAX' };
  return m[net] || net;
}
function runFlow(amt, addr, net, cur) {
  wdForm.hidden = true;
  wdFlow.hidden = false;
  var items = $$('#wdSteps li');
  var i = 0;
  var base = reduceMotion ? 140 : 620;
  (function next() {
    if (i > 0) { items[i - 1].classList.remove('doing'); items[i - 1].classList.add('done'); }
    if (i < items.length) {
      items[i].classList.add('doing');
      $('#wdBar').style.width = Math.round(((i + 1) / items.length) * 82) + '%';
      i++;
      setTimeout(next, base);
    } else {
      $('#wdBar').style.width = '100%';
      finishWithdraw(amt, addr, net, cur);
    }
  })();
}
function finishWithdraw(amt, addr, net, cur) {
  balance = Math.max(0, balance - amt);
  setBalanceUI();
  var netS = netShort(net);
  var row = document.createElement('tr');
  row.className = 'is-new';
  row.innerHTML =
    '<td dir="ltr">WD-' + (orderSeq++) + '</td>' +
    '<td dir="ltr">' + shortAddr(addr) + '</td>' +
    '<td>' + netS + ' · ' + cur + '</td>' +
    '<td>-' + fmt(amt) + ' $</td>' +
    '<td><span class="pill done">برداشت موفق</span></td>';
  var body = $('#ordersBody');
  body.insertBefore(row, body.firstChild);
  $('#wdHash').textContent = 'tx 0x' + randHex(6) + '…' + randHex(4) + ' · ' + netS;
  $('#wdDone').hidden = false;
  toast('برداشت ' + fmt(amt) + ' ' + cur + ' انجام شد (نمایشی)');
}
setBalanceUI();

/* — توست — */
var toastEl = $('#toast'), toastT = null;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
}

/* — جمع‌بندی: پخش دوباره ارائه — */
$('#replayDeck').addEventListener('click', function () {
  window.scrollTo({ top: Math.round(deckTop()), behavior: smooth });
});

/* — شروع — */
activate(0, 'init');
render();
if (location.hash) fromHash();
})();
