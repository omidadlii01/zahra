/* ============================================================
   D-pay — interactions (vanilla JS, no dependencies)
   ============================================================ */
(function () {
  "use strict";

  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Preloader ---------- */
  const preloader = $("#preloader");
  const preFill = $("#preloaderFill");
  const prePct = $("#preloaderPct");
  let progress = 0;
  document.body.classList.add("locked");

  const tickLoad = setInterval(() => {
    progress += Math.random() * 14 + 4;
    if (progress >= 100) {
      progress = 100;
      clearInterval(tickLoad);
      setTimeout(finishLoad, 250);
    }
    if (preFill) preFill.style.width = progress + "%";
    if (prePct) prePct.textContent = Math.floor(progress) + "%";
  }, 120);

  function finishLoad() {
    if (preloader) preloader.classList.add("done");
    document.body.classList.remove("locked");
    // trigger hero reveals immediately
    requestAnimationFrame(() => observeReveals());
  }
  // safety: never trap the user
  setTimeout(() => {
    if (preloader && !preloader.classList.contains("done")) {
      clearInterval(tickLoad);
      finishLoad();
    }
  }, 4500);

  /* ---------- Particle network (hero canvas) ---------- */
  const canvas = $("#netCanvas");
  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0, pts = [], raf = null, running = false;
    const mouse = { x: -9999, y: -9999 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    function seed() {
      const n = Math.min(90, Math.max(34, Math.floor((W * H) / 22000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        r: Math.random() * 1.8 + 0.8
      }));
    }
    function step() {
      ctx.clearRect(0, 0, W, H);
      const LINK = 150;
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        // gentle mouse attraction
        const mdx = mouse.x - p.x, mdy = mouse.y - p.y;
        const md = Math.hypot(mdx, mdy);
        if (md < 220 && md > 1) { p.x += (mdx / md) * 0.35; p.y += (mdy / md) * 0.35; }
        if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(7, 200, 218, ${(1 - d / LINK) * 0.32})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = "rgba(75, 227, 242, 0.85)";
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (running) raf = requestAnimationFrame(step);
    }
    function start() { if (!running) { running = true; raf = requestAnimationFrame(step); } }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

    resize();
    start();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }, { passive: true });
    document.addEventListener("mouseleave", () => { mouse.x = -9999; mouse.y = -9999; });
    // pause when hero off-screen
    new IntersectionObserver((en) => (en[0].isIntersecting ? start() : stop())).observe($("#hero"));
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  }

  /* ---------- Scroll progress + header + to-top ---------- */
  const scrollProgress = $("#scrollProgress");
  const header = $("#siteHeader");
  const toTop = $("#toTop");
  function onScroll() {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollProgress) scrollProgress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    if (header) header.classList.toggle("scrolled", y > 30);
    if (toTop) toTop.classList.toggle("show", y > 700);
    paintTimeline();
    paintJourney();
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));

  /* ---------- Mobile nav ---------- */
  const navToggle = $("#navToggle");
  const mainNav = $("#mainNav");
  if (navToggle && mainNav) {
    navToggle.addEventListener("click", () => {
      const open = mainNav.classList.toggle("open");
      navToggle.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "بستن منو" : "باز کردن منو");
    });
    $$("a", mainNav).forEach((a) =>
      a.addEventListener("click", () => {
        mainNav.classList.remove("open");
        navToggle.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      })
    );
  }

  /* ---------- Active nav link ---------- */
  const navLinks = $$("[data-nav]");
  const sectionMap = new Map();
  navLinks.forEach((a) => {
    const sec = $(a.getAttribute("href"));
    if (sec) sectionMap.set(sec, a);
  });
  if ("IntersectionObserver" in window && sectionMap.size) {
    const navObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            navLinks.forEach((a) => a.classList.remove("active"));
            const link = sectionMap.get(en.target);
            if (link) link.classList.add("active");
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sectionMap.forEach((_, sec) => navObs.observe(sec));
  }

  /* ---------- Reveal on scroll ---------- */
  let revealObs = null;
  function observeReveals() {
    const els = $$(".reveal:not(.visible)");
    if (!("IntersectionObserver" in window) || reduceMotion) {
      els.forEach((el) => el.classList.add("visible"));
      return;
    }
    if (!revealObs) {
      revealObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              const el = en.target;
              const delay = parseInt(el.getAttribute("data-delay") || "0", 10);
              setTimeout(() => el.classList.add("visible"), delay);
              revealObs.unobserve(el);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
      );
    }
    els.forEach((el) => revealObs.observe(el));
  }

  /* ---------- Counters ---------- */
  const counters = $$(".counter");
  if (counters.length && "IntersectionObserver" in window) {
    const cObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target;
          cObs.unobserve(el);
          const target = parseInt(el.getAttribute("data-count"), 10) || 0;
          const t0 = performance.now(), dur = 1400;
          (function tick(t) {
            const p = Math.min(1, (t - t0) / dur);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = Math.round(target * eased);
            if (p < 1) requestAnimationFrame(tick);
          })(t0);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => cObs.observe(el));
  } else {
    counters.forEach((el) => (el.textContent = el.getAttribute("data-count")));
  }

  /* ---------- Tilt cards ---------- */
  if (finePointer && !reduceMotion) {
    $$(".tilt").forEach((card) => {
      let raf = null;
      card.addEventListener("mousemove", (e) => {
        const r = card.getBoundingClientRect();
        const rx = ((e.clientY - r.top) / r.height - 0.5) * -10;
        const ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          card.style.transform = `translateY(-8px) perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        });
      });
      card.addEventListener("mouseleave", () => {
        if (raf) cancelAnimationFrame(raf);
        card.style.transform = "";
      });
    });
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    $$(".magnetic").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${x * 0.14}px, ${y * 0.18}px)`;
      });
      btn.addEventListener("mouseleave", () => (btn.style.transform = ""));
    });
  }

  /* ---------- Cursor glow ---------- */
  const glow = $("#cursorGlow");
  if (glow && finePointer && !reduceMotion) {
    let gx = -600, gy = -600, tx = gx, ty = gy;
    window.addEventListener("mousemove", (e) => {
      tx = e.clientX; ty = e.clientY;
      glow.style.opacity = "1";
    }, { passive: true });
    (function follow() {
      gx += (tx - gx) * 0.08; gy += (ty - gy) * 0.08;
      glow.style.transform = `translate(${gx}px, ${gy}px)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- Tabs ---------- */
  const tabBtns = $$(".tab-btn");
  const tabPanels = $$(".tab-panel");
  const indicator = $("#tabIndicator");
  function moveIndicator(btn) {
    if (!indicator || !btn) return;
    indicator.style.width = btn.offsetWidth + "px";
    indicator.style.left = btn.offsetLeft + "px";
  }
  function activateTab(name, btn) {
    tabBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    tabPanels.forEach((p) => p.classList.toggle("active", p.getAttribute("data-panel") === name));
    moveIndicator(btn);
  }
  tabBtns.forEach((b) => b.addEventListener("click", () => activateTab(b.getAttribute("data-tab"), b)));
  window.addEventListener("resize", () => moveIndicator($(".tab-btn.active")));
  window.addEventListener("load", () => moveIndicator($(".tab-btn.active")));
  // initial position after fonts settle
  setTimeout(() => moveIndicator($(".tab-btn.active")), 400);

  /* ---------- Copy API sample ---------- */
  const copyBtn = $("#copyApi");
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      const code = ($("#apiCode") || {}).innerText || "";
      try {
        await navigator.clipboard.writeText(code);
        toast("نمونه کد REST API کپی شد ✓");
      } catch (e) {
        // fallback
        const ta = document.createElement("textarea");
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); toast("نمونه کد REST API کپی شد ✓"); }
        catch (err) { toast("کپی ناموفق بود — دستی کپی کنید"); }
        ta.remove();
      }
    });
  }

  /* ---------- Oracle converter (demo rates) ---------- */
  const RATES = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1, ETH: 3240.5, BTC: 67480 };
  const amountEl = $("#convAmount");
  const currEl = $("#convCurrency");
  const resEl = $("#convResult");
  const rateEl = $("#convRate");
  function fmt(n) {
    return n >= 1000 ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(Number(n.toPrecision(6)));
  }
  function convert(animate) {
    if (!amountEl || !currEl || !resEl) return;
    const amount = Math.max(0, parseFloat(amountEl.value) || 0);
    const cur = currEl.value;
    const rate = RATES[cur] || 1;
    // tiny live drift so it feels like an oracle
    const drift = 1 + (Math.random() - 0.5) * 0.0012;
    const liveRate = rate * drift;
    const out = cur === "USDT" || cur === "USDC" || cur === "BUSD" || cur === "DAI"
      ? amount * liveRate
      : amount / liveRate;
    resEl.textContent = `${fmt(out)} ${cur}`;
    if (rateEl) rateEl.textContent = cur === "USDT" ? "1 USDT ≈ $1.00" : `1 ${cur} ≈ $${fmt(liveRate)}`;
    if (animate && !reduceMotion) {
      resEl.classList.remove("tick");
      void resEl.offsetWidth;
      resEl.classList.add("tick");
    }
  }
  if (amountEl && currEl) {
    amountEl.addEventListener("input", () => convert(true));
    currEl.addEventListener("change", () => convert(true));
    convert(false);
    // refresh drift every 4s while visible
    let convVisible = false;
    new IntersectionObserver((en) => (convVisible = en[0].isIntersecting)).observe($("#converter"));
    setInterval(() => { if (convVisible && !document.hidden) convert(true); }, 4000);
  }

  /* ---------- Timeline paint ---------- */
  const timeline = $("#timeline");
  const tlFill = $("#timelineFill");
  const tlSteps = $$(".tl-step");
  function paintTimeline() {
    if (!timeline || !tlFill) return;
    const r = timeline.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.62 - r.top) / r.height));
    tlFill.style.height = p * 100 + "%";
    tlSteps.forEach((s) => {
      const sr = s.getBoundingClientRect();
      s.classList.toggle("lit", sr.top < vh * 0.62);
    });
  }

  /* ---------- Journey paint ---------- */
  const journey = $("#journeyFlow");
  const jFg = $("#journeyPathFg");
  const jSteps = $$(".j-step");
  const PATH_LEN = 1400;
  if (jFg) {
    jFg.style.strokeDasharray = PATH_LEN;
    jFg.style.strokeDashoffset = PATH_LEN;
  }
  function paintJourney() {
    if (!journey) return;
    const r = journey.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.7 - r.top) / (r.height * 0.9)));
    if (jFg && !reduceMotion) jFg.style.strokeDashoffset = PATH_LEN * (1 - p);
    jSteps.forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      s.classList.toggle("lit", sr.top < vh * 0.72 || p > (i + 1) / (jSteps.length + 0.5));
    });
  }

  /* ---------- Withdraw modal ---------- */
  const backdrop = $("#modalBackdrop");
  const wBtn = $("#withdrawBtn");
  const wClose = $("#modalClose");
  const wSubmit = $("#wdSubmit");
  const dashBalance = $("#dashBalance");
  let balance = 1284.5;

  function openModal() {
    if (!backdrop) return;
    backdrop.classList.add("open");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("locked");
    const first = $("#wdNet");
    if (first) setTimeout(() => first.focus(), 350);
  }
  function closeModal() {
    if (!backdrop) return;
    backdrop.classList.remove("open");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("locked");
  }
  if (wBtn) wBtn.addEventListener("click", openModal);
  if (wClose) wClose.addEventListener("click", closeModal);
  if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  function fakeHash() {
    const h = "0123456789abcdef";
    let s = "0x";
    for (let i = 0; i < 10; i++) s += h[Math.floor(Math.random() * 16)];
    return s + "…";
  }
  if (wSubmit) {
    wSubmit.addEventListener("click", () => {
      const amt = parseFloat(($("#wdAmount") || {}).value) || 0;
      if (amt <= 0) { toast("مبلغ برداشت معتبر نیست"); return; }
      if (amt > balance) { toast("موجودی کافی نیست — مبلغ کمتری وارد کنید"); return; }
      balance = Math.max(0, balance - amt);
      if (dashBalance) dashBalance.textContent = `${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
      closeModal();
      toast(`درخواست برداشت ${amt} USDT ثبت شد ✓ — هش تراکنش: ${fakeHash()}`);
    });
  }

  /* ---------- Toast ---------- */
  const toastEl = $("#toast");
  let toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3800);
  }

  /* ---------- Footer year ---------- */
  const yearEl = $("#year");
  if (yearEl) {
    try {
      yearEl.textContent = new Intl.DateTimeFormat("en", { year: "numeric" }).format(new Date());
    } catch (e) { /* keep default */ }
  }

  /* ---------- Boot ---------- */
  observeReveals();
  paintTimeline();
  paintJourney();
})();
