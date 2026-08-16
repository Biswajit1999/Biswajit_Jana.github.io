/* ============================================================
   EXOPLANET RESEARCH ATLAS — behavior layer
   Progressive enhancement over real semantic HTML already baked
   into exoplanets.html by build_exoplanet_atlas.py. Every project
   card already exists in the DOM with real text and a per-card
   JSON blob (script.atlas-detail-data) — this file reads that DOM,
   it does not fetch anything over the network. If this script
   fails to load, the page is still a readable article + card grid.
   ============================================================ */
(function () {
  "use strict";

  var docEl = document.documentElement;
  docEl.classList.remove("no-js");
  docEl.classList.add("js");

  var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

  // ---------------------------------------------------------
  // 1. Read every project from the explorer grid (source of truth)
  // ---------------------------------------------------------
  var cardEls = Array.prototype.slice.call(document.querySelectorAll(".atlas-card[data-slug]"));
  var projects = cardEls.map(function (el) {
    var jsonEl = el.querySelector(".atlas-detail-data");
    var detail = {};
    try { detail = JSON.parse(jsonEl.textContent); } catch (e) { detail = {}; }
    return {
      el: el,
      slug: el.getAttribute("data-slug"),
      type: el.getAttribute("data-type"),
      status: el.getAttribute("data-status"),
      category: detail.category || "",
      planetClass: detail.planet_class || "",
      evidenceStatus: el.getAttribute("data-evidence-status") || null,
      tech: (el.getAttribute("data-tech") || "").split("|").filter(Boolean),
      tags: (el.getAttribute("data-tags") || "").split("|").filter(Boolean),
      searchText: (el.getAttribute("data-search") || "").toLowerCase(),
      detail: detail
    };
  });
  var bySlug = {};
  projects.forEach(function (p) { bySlug[p.slug] = p; });

  // ---------------------------------------------------------
  // 2. Filter / search / sort state, synced to the URL
  // ---------------------------------------------------------
  var PAGE_SIZE = 12;
  var state = {
    q: "",
    filter: "all",
    sort: "featured",
    page: 1
  };

  function readStateFromURL() {
    var params = new URLSearchParams(window.location.search);
    state.q = params.get("q") || "";
    state.filter = params.get("filter") || "all";
    state.sort = params.get("sort") || "featured";
    state.page = Math.max(1, parseInt(params.get("page"), 10) || 1);
  }
  function writeStateToURL(replace) {
    var params = new URLSearchParams(window.location.search);
    state.q ? params.set("q", state.q) : params.delete("q");
    state.filter !== "all" ? params.set("filter", state.filter) : params.delete("filter");
    state.sort !== "featured" ? params.set("sort", state.sort) : params.delete("sort");
    state.page > 1 ? params.set("page", String(state.page)) : params.delete("page");
    var qs = params.toString();
    var url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    if (replace) window.history.replaceState(window.history.state, "", url);
    else window.history.pushState(window.history.state, "", url);
  }

  var FILTER_TESTS = {
    all: function () { return true; },
    "exoplanet-report": function (p) { return p.type === "exoplanet-report"; },
    "detection-method": function (p) { return p.type === "detection-method"; },
    "research-benchmark": function (p) { return p.type === "research-benchmark"; },
    "astro-lab": function (p) { return p.type === "astro-lab"; },
    "platform": function (p) { return p.type === "platform"; },
    "research-academic": function (p) { return p.type === "research-academic"; },
    "game": function (p) { return p.type === "game"; },
    tess: function (p) { return p.tech.indexOf("TESS") > -1; },
    jwst: function (p) { return p.tech.some(function (i) { return i.indexOf("JWST") === 0; }); },
    "null-result": function (p) { return p.evidenceStatus === "null-or-mixed-result"; }
  };

  var SORT_FNS = {
    featured: function (a, b) { return a.el.dataset.order - b.el.dataset.order; },
    target: function (a, b) { return a.detail.title.localeCompare(b.detail.title); },
    category: function (a, b) { return (a.type || "").localeCompare(b.type || ""); }
  };

  function applyState() {
    var test = FILTER_TESTS[state.filter] || FILTER_TESTS.all;
    var q = state.q.trim().toLowerCase();
    var matched = [];
    projects.forEach(function (p) {
      if (test(p) && (!q || p.searchText.indexOf(q) > -1)) matched.push(p);
    });
    matched.sort(SORT_FNS[state.sort] || SORT_FNS.featured);

    var totalPages = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    var pageStart = (state.page - 1) * PAGE_SIZE;
    var pageItems = matched.slice(pageStart, pageStart + PAGE_SIZE);
    var pageSlugs = {};
    pageItems.forEach(function (p) { pageSlugs[p.slug] = true; });

    projects.forEach(function (p) { p.el.hidden = !pageSlugs[p.slug]; });
    var grid = document.getElementById("atlas-grid");
    pageItems.forEach(function (p) { grid.appendChild(p.el); });

    var countEl = document.getElementById("atlas-result-count");
    if (countEl) {
      countEl.textContent = matched.length + (matched.length === 1 ? " repository" : " repositories") +
        (totalPages > 1 ? " — page " + state.page + " of " + totalPages : "");
    }

    var empty = document.getElementById("atlas-empty");
    if (empty) empty.hidden = matched.length !== 0;

    document.querySelectorAll(".atlas-chip").forEach(function (chip) {
      chip.setAttribute("aria-pressed", chip.dataset.filter === state.filter ? "true" : "false");
    });
    var searchInput = document.getElementById("atlas-search-input");
    if (searchInput && searchInput.value !== state.q) searchInput.value = state.q;
    var sortSelect = document.getElementById("atlas-sort-select");
    if (sortSelect) sortSelect.value = state.sort;

    renderPagination(totalPages);
    rebuildCarousel(matched.length ? matched : projects);
    return matched;
  }

  function renderPagination(totalPages) {
    var wrap = document.getElementById("atlas-pagination");
    if (!wrap) return;
    wrap.innerHTML = "";
    if (totalPages <= 1) { wrap.hidden = true; return; }
    wrap.hidden = false;

    function pageBtn(label, page, opts) {
      opts = opts || {};
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "atlas-page-btn";
      btn.textContent = label;
      if (opts.current) { btn.setAttribute("aria-current", "page"); btn.disabled = true; }
      if (opts.disabled) btn.disabled = true;
      btn.addEventListener("click", function () {
        state.page = page;
        writeStateToURL();
        applyState();
        document.getElementById("atlas-explorer").scrollIntoView({ block: "start", behavior: reduceMotionMQ.matches ? "auto" : "smooth" });
      });
      return btn;
    }

    wrap.appendChild(pageBtn("‹ Prev", state.page - 1, { disabled: state.page <= 1 }));
    var windowSize = 2;
    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - state.page) <= windowSize) {
        wrap.appendChild(pageBtn(String(i), i, { current: i === state.page }));
      } else if (Math.abs(i - state.page) === windowSize + 1) {
        var ellipsis = document.createElement("span");
        ellipsis.className = "atlas-page-ellipsis";
        ellipsis.textContent = "…";
        wrap.appendChild(ellipsis);
      }
    }
    wrap.appendChild(pageBtn("Next ›", state.page + 1, { disabled: state.page >= totalPages }));
  }

  // ---------------------------------------------------------
  // 3. Explorer controls
  // ---------------------------------------------------------
  document.querySelectorAll(".atlas-chip[data-filter]").forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.filter = chip.dataset.filter;
      state.page = 1;
      writeStateToURL();
      applyState();
    });
  });
  var clearBtn = document.getElementById("atlas-clear-filters");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      state.filter = "all"; state.q = ""; state.sort = "featured"; state.page = 1;
      writeStateToURL();
      applyState();
    });
  }
  var searchInput = document.getElementById("atlas-search-input");
  if (searchInput) {
    var debounceId;
    searchInput.addEventListener("input", function () {
      clearTimeout(debounceId);
      var val = searchInput.value;
      debounceId = setTimeout(function () {
        state.q = val;
        state.page = 1;
        writeStateToURL(true);
        applyState();
      }, 150);
    });
  }
  var sortSelect = document.getElementById("atlas-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      state.sort = sortSelect.value;
      state.page = 1;
      writeStateToURL();
      applyState();
    });
  }

  // ---------------------------------------------------------
  // 4. Carousel (virtualized 3D deck, progressive enhancement)
  // ---------------------------------------------------------
  var carouselRoot = document.getElementById("atlas-carousel");
  var track = document.getElementById("atlas-carousel-track");
  var liveRegion = document.getElementById("atlas-carousel-live");
  var dotsWrap = document.getElementById("atlas-carousel-dots");
  var carouselItems = [];   // current filtered/sorted project list
  var activeIndex = 0;
  var RENDER_WINDOW = 2;    // render active-2..active+2 = 5 slides max

  function setMotionMode() {
    if (!carouselRoot) return;
    carouselRoot.setAttribute("data-motion", reduceMotionMQ.matches ? "reduced" : "full");
  }
  setMotionMode();
  reduceMotionMQ.addEventListener("change", setMotionMode);

  function badgeHTML(p) {
    if (p.evidenceStatus) {
      return '<span class="ev-badge" data-status="' + p.evidenceStatus + '">' + evLabel(p.evidenceStatus) + "</span>";
    }
    var group = TYPE_GROUP[p.type] || "tool";
    return '<span class="type-badge" data-type-group="' + group + '">' + escapeHTML(typeLabel(p.type)) + "</span>";
  }

  function slideCardHTML(p) {
    var d = p.detail;
    var thumb = d.thumbnail_url || "";
    var attribution = d.thumbnail_attribution || "";
    return (
      '<div class="atlas-slide-card">' +
        '<div class="atlas-slide-media">' +
          (thumb ? '<img src="' + thumb + '" alt="' + escapeHTML(attribution || d.title) + '" loading="lazy" />' : '<div class="atlas-card-placeholder" aria-hidden="true"><span>' + escapeHTML(initials(d.title)) + "</span></div>") +
        "</div>" +
        '<div class="atlas-slide-body">' +
          '<div class="kicker">' + badgeHTML(p) +
            (d.category ? '<span class="tag">' + escapeHTML(d.category) + "</span>" : "") +
          "</div>" +
          "<h3>" + escapeHTML(d.title || p.slug) + "</h3>" +
          '<p class="result">' + escapeHTML(d.headline || d.summary || "") + "</p>" +
          '<div class="atlas-slide-actions">' +
            (d.live_report_url ? '<a class="btn btn-primary btn-sm" href="' + d.live_report_url + '" target="_blank" rel="noopener">View live</a>' : "") +
            '<button type="button" class="btn btn-ghost btn-sm" data-open-detail="' + p.slug + '">Details</button>' +
            '<a class="btn btn-ghost btn-sm" href="' + d.github_url + '" target="_blank" rel="noopener">GitHub</a>' +
          "</div>" +
        "</div>" +
      "</div>"
    );
  }

  var slidePool = [];     // persistent DOM elements, never torn down between navigations
  var slotOffsets = [];   // parallel array: the offset (-WIN..WIN) each pool slot currently represents
  var SLOT_COUNT = RENDER_WINDOW * 2 + 1;

  function rebuildCarousel(list) {
    if (!carouselRoot || !track) return;
    carouselItems = list;
    activeIndex = 0;
    ensurePool();
    updateSlidePool(true /* instant: fresh filter/search result set, no meaningful "from" state */);
    renderDots();
    updateLiveRegion();
  }

  function ensurePool() {
    if (slidePool.length) return;
    track.innerHTML = "";
    for (var s = 0; s < SLOT_COUNT; s++) {
      var slide = document.createElement("div");
      slide.className = "atlas-slide";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      track.appendChild(slide);
      slidePool.push(slide);
      slotOffsets.push(s - RENDER_WINDOW);
    }
  }

  function updateSlidePool(instantSlots) {
    // instantSlots: true = every slot skips its transition (full reset), or an array of
    // pool indices that should skip their transition just this once (wrap-around recycling)
    if (!carouselItems.length) return;
    var n = carouselItems.length;
    var instantAll = instantSlots === true;
    var instantSet = Array.isArray(instantSlots) ? instantSlots : null;

    for (var s = 0; s < slidePool.length; s++) {
      var slide = slidePool[s];
      var offset = slotOffsets[s];
      var idx = ((activeIndex + offset) % n + n) % n;
      var p = carouselItems[idx];
      var skipTransition = instantAll || (instantSet && instantSet.indexOf(s) > -1);

      if (skipTransition) slide.style.transition = "none";

      if (slide.dataset.slug !== p.slug) {
        slide.innerHTML = slideCardHTML(p);
        slide.dataset.slug = p.slug;
      }
      slide.dataset.active = offset === 0 ? "true" : "false";
      slide.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
      slide.setAttribute("aria-label", (idx + 1) + " of " + n + ": " + p.detail.title);
      positionSlide(slide, offset, n);

      if (skipTransition) {
        slide.offsetHeight; // force reflow so the instant position commits before re-enabling transition
        slide.style.transition = "";
      }
    }
  }

  function updateLiveRegion() {
    if (!liveRegion || !carouselItems.length) return;
    var active = carouselItems[activeIndex];
    liveRegion.textContent = "Showing " + (activeIndex + 1) + " of " + carouselItems.length + ": " + active.detail.title;
  }

  function positionSlide(slide, offset, total) {
    var abs = Math.min(Math.abs(offset), 3);
    var dir = offset === 0 ? 0 : (offset > 0 ? 1 : -1);
    var zShift = -abs * 160;
    var rotate = dir * Math.min(abs, 2) * 22;
    var scale = 1 - abs * 0.12;
    var opacity = abs > 2 ? 0 : 1 - abs * 0.32;
    slide.style.transform =
      "translateX(-50%) translateX(" + (dir * abs * 42) + "%) translateZ(" + zShift + "px) rotateY(" + (-rotate) + "deg) scale(" + scale + ")";
    slide.style.opacity = String(Math.max(opacity, 0));
    slide.style.zIndex = String(100 - abs);
  }

  function renderDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    var n = carouselItems.length;
    var maxDots = 12;
    for (var i = 0; i < Math.min(n, maxDots); i++) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Go to slide " + (i + 1) + " of " + n);
      btn.setAttribute("aria-current", i === activeIndex ? "true" : "false");
      btn.addEventListener("click", function (i) { return function () { goTo(i); }; }(i));
      dotsWrap.appendChild(btn);
    }
    if (n > maxDots) {
      var more = document.createElement("span");
      more.className = "mono";
      more.style.fontSize = ".7rem";
      more.style.color = "var(--muted)";
      more.style.alignSelf = "center";
      more.textContent = "+" + (n - maxDots);
      dotsWrap.appendChild(more);
    }
  }

  function goTo(i) {
    if (!carouselItems.length) return;
    var n = carouselItems.length;
    var newIndex = ((i % n) + n) % n;
    var delta = newIndex - activeIndex;
    // shortest-path delta so Home/End/dot-jumps don't spin through every intermediate slide
    if (delta > n / 2) delta -= n;
    if (delta < -n / 2) delta += n;

    if (Math.abs(delta) >= SLOT_COUNT) {
      // jump too large for any slot to stay on-screen through it — reset every slot instantly
      activeIndex = newIndex;
      updateSlidePool(true);
    } else {
      var wrapped = [];
      for (var s = 0; s < slotOffsets.length; s++) {
        slotOffsets[s] -= delta;
        if (slotOffsets[s] < -RENDER_WINDOW) { slotOffsets[s] += SLOT_COUNT; wrapped.push(s); }
        else if (slotOffsets[s] > RENDER_WINDOW) { slotOffsets[s] -= SLOT_COUNT; wrapped.push(s); }
      }
      activeIndex = newIndex;
      updateSlidePool(wrapped);
    }
    renderDots();
    updateLiveRegion();
  }
  function next() { goTo(activeIndex + 1); }
  function prev() { goTo(activeIndex - 1); }

  var prevBtn = document.getElementById("atlas-carousel-prev");
  var nextBtn = document.getElementById("atlas-carousel-next");
  if (prevBtn) prevBtn.addEventListener("click", prev);
  if (nextBtn) nextBtn.addEventListener("click", next);

  if (carouselRoot) {
    carouselRoot.setAttribute("tabindex", "0");
    carouselRoot.setAttribute("role", "region");
    carouselRoot.setAttribute("aria-roledescription", "carousel");
    carouselRoot.setAttribute("aria-label", "Exoplanet report highlights");
    carouselRoot.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0); }
      else if (e.key === "End") { e.preventDefault(); goTo(carouselItems.length - 1); }
    });

    // pointer drag / touch swipe
    var dragging = false, startX = 0, deltaX = 0, rafId = null;
    function onPointerDown(e) {
      dragging = true; startX = (e.touches ? e.touches[0].clientX : e.clientX); deltaX = 0;
      carouselRoot.setPointerCapture && e.pointerId != null && carouselRoot.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      deltaX = x - startX;
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      if (deltaX > 60) prev();
      else if (deltaX < -60) next();
      deltaX = 0;
    }
    carouselRoot.addEventListener("pointerdown", onPointerDown);
    carouselRoot.addEventListener("pointermove", onPointerMove);
    carouselRoot.addEventListener("pointerup", onPointerUp);
    carouselRoot.addEventListener("pointercancel", onPointerUp);
    carouselRoot.addEventListener("touchstart", onPointerDown, { passive: true });
    carouselRoot.addEventListener("touchmove", onPointerMove, { passive: true });
    carouselRoot.addEventListener("touchend", onPointerUp);

    // subtle cursor parallax tilt (fine-pointer, motion-ok only)
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (canHover && !reduceMotionMQ.matches) {
      carouselRoot.addEventListener("mousemove", function (e) {
        var r = carouselRoot.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () {
          track.style.transform = "rotateY(" + (px * 3) + "deg)";
        });
      });
      carouselRoot.addEventListener("mouseleave", function () {
        track.style.transform = "";
      });
    }
  }

  // event delegation for "Details" buttons inside slides/cards
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest && e.target.closest("[data-open-detail]");
    if (trigger) openDetail(trigger.getAttribute("data-open-detail"), trigger);
  });

  // ---------------------------------------------------------
  // 5. Detail modal
  // ---------------------------------------------------------
  var modalOverlay = document.getElementById("atlas-modal-overlay");
  var modalBody = document.getElementById("atlas-modal-body");
  var lastFocused = null;

  var TYPE_LABELS = {
    "exoplanet-report": "Exoplanet report",
    "detection-method": "Detection method",
    "research-benchmark": "Research benchmark",
    "astro-lab": "Interactive lab",
    "platform": "Platform",
    "research-academic": "Research",
    "game": "Game",
    "coursework": "Coursework"
  };
  var TYPE_GROUP = {
    "research-benchmark": "research", "research-academic": "research",
    "astro-lab": "tool", "platform": "tool",
    "game": "light", "coursework": "archive"
  };
  function typeLabel(type) { return TYPE_LABELS[type] || type; }
  function initials(title) {
    var words = (title || "").split(/\s+/).filter(Boolean).slice(0, 2);
    var out = words.map(function (w) { return w.charAt(0); }).join("").toUpperCase();
    return out || "?";
  }
  function evLabel(status) {
    return ({
      "public-data-reanalysis": "Public-data reanalysis",
      "reproduced-from-bundled-data": "Reproduced from bundled data",
      "null-or-mixed-result": "Null / mixed result",
      "algorithm-validated-on-synthetic-signal": "Validated on synthetic signal"
    })[status] || status;
  }
  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function list(items) {
    if (!items || !items.length) return "<p>Not stated.</p>";
    return "<ul>" + items.map(function (i) { return "<li>" + escapeHTML(i) + "</li>"; }).join("") + "</ul>";
  }

  function relatedProjects(p, max) {
    return projects
      .filter(function (o) { return o.slug !== p.slug && (o.type === p.type || o.category === p.category); })
      .slice(0, max || 4);
  }

  function renderDetail(p) {
    var d = p.detail;
    var thumb = d.thumbnail_url || "";
    var isExoplanet = p.type === "exoplanet-report" || p.type === "detection-method";
    modalBody.innerHTML =
      (thumb ?
        '<div class="atlas-modal-media"><img src="' + thumb + '" alt="" />' +
        '<button type="button" class="atlas-modal-close" data-close-modal aria-label="Close">&times;</button></div>'
        : '<button type="button" class="atlas-modal-close" data-close-modal aria-label="Close" style="position:static;margin:16px 16px 0 auto;display:flex">&times;</button>'
      ) +
      '<div class="atlas-modal-body">' +
        '<div class="kicker">' + badgeHTML(p) +
          (d.category ? '<span class="tag">' + escapeHTML(d.category) + "</span>" : "") +
          (d.planet_class ? '<span class="tag">' + escapeHTML(d.planet_class) + "</span>" : "") +
        "</div>" +
        "<h2 id=\"atlas-modal-title\">" + escapeHTML(d.title) + "</h2>" +
        '<p class="question">' + escapeHTML(d.summary || "") + "</p>" +
        '<div class="atlas-modal-result"><strong>' + (isExoplanet ? "Principal result:" : "Key result:") + '</strong> ' + escapeHTML(d.headline || "") +
          (d.evidence_status_note ? "<br><br><em>" + escapeHTML(d.evidence_status_note) + "</em>" : "") +
          (d.headline_stat ? "<br><br><span class=\"mono\" style=\"font-size:.85rem\">" + escapeHTML(d.headline_stat) + "</span>" : "") +
        "</div>" +
        '<div class="atlas-modal-grid">' +
          '<div class="atlas-modal-field"><h4>' + (isExoplanet ? "Instruments" : "Tech / instruments") + '</h4>' + list(d.tech_or_instruments) + "</div>" +
          '<div class="atlas-modal-field"><h4>Datasets</h4>' + list(d.datasets) + "</div>" +
          '<div class="atlas-modal-field"><h4>Methods</h4>' + list(d.methods) + "</div>" +
          (isExoplanet ?
            '<div class="atlas-modal-field"><h4>Molecules discussed</h4>' + (d.molecules && d.molecules.length ? list(d.molecules) : "<p>None discussed in this report.</p>") + "</div>"
            : "") +
        "</div>" +
        '<div class="atlas-modal-actions">' +
          (d.live_report_url ? '<a class="btn btn-primary" href="' + d.live_report_url + '" target="_blank" rel="noopener">' + (isExoplanet ? "Read the full report" : "Open the live demo") + '</a>' : "") +
          '<a class="btn btn-ghost" href="' + d.github_url + '" target="_blank" rel="noopener">View on GitHub</a>' +
        "</div>" +
        '<div class="atlas-modal-related"><h4>Related repositories</h4><div class="atlas-related-list">' +
          relatedProjects(p).map(function (r) {
            return '<a href="#" data-open-detail="' + r.slug + '">' + escapeHTML(r.detail.title || r.slug) + "</a>";
          }).join("") +
        "</div></div>" +
      "</div>";
  }

  function openDetail(slug, trigger) {
    var p = bySlug[slug];
    if (!p || !modalOverlay) return;
    lastFocused = trigger || document.activeElement;
    renderDetail(p);
    modalOverlay.setAttribute("data-open", "true");
    modalOverlay.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
    var closeBtn = modalOverlay.querySelector("[data-close-modal]");
    (closeBtn || modalOverlay).focus();
    var params = new URLSearchParams(window.location.search);
    params.set("project", slug);
    window.history.pushState({ atlasProject: slug }, "", window.location.pathname + "?" + params.toString());
  }
  function closeDetail(skipHistory) {
    if (!modalOverlay) return;
    modalOverlay.setAttribute("data-open", "false");
    document.body.style.overflow = "";
    setTimeout(function () { modalOverlay.setAttribute("hidden", ""); }, 200);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
    if (!skipHistory) {
      var params = new URLSearchParams(window.location.search);
      params.delete("project");
      var qs = params.toString();
      window.history.pushState({}, "", window.location.pathname + (qs ? "?" + qs : ""));
    }
  }
  document.addEventListener("click", function (e) {
    if (e.target === modalOverlay || (e.target.closest && e.target.closest("[data-close-modal]"))) {
      closeDetail();
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modalOverlay && modalOverlay.getAttribute("data-open") === "true") {
      closeDetail();
    }
  });
  window.addEventListener("popstate", function () {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get("project");
    if (slug && bySlug[slug]) {
      lastFocused = document.activeElement;
      renderDetail(bySlug[slug]);
      modalOverlay.setAttribute("data-open", "true");
      modalOverlay.removeAttribute("hidden");
    } else if (modalOverlay && modalOverlay.getAttribute("data-open") === "true") {
      closeDetail(true);
    }
    readStateFromURL();
    applyState();
  });

  // ---------------------------------------------------------
  // 6. Init
  // ---------------------------------------------------------
  readStateFromURL();
  var initialList = applyState();

  var deepLinkSlug = new URLSearchParams(window.location.search).get("project");
  if (deepLinkSlug && bySlug[deepLinkSlug]) openDetail(deepLinkSlug);

  // scroll-reveal (mirrors index.html's .reveal pattern)
  if ("IntersectionObserver" in window && !reduceMotionMQ.matches) {
    document.body.classList.add("reveal-on");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  // theme toggle + mobile nav toggle (mirrors index.html behavior)
  var themeToggle = document.getElementById("themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      var current = docEl.getAttribute("data-theme") === "dark" ? "light" : "dark";
      docEl.setAttribute("data-theme", current);
      try { localStorage.setItem("theme", current); } catch (e) {}
    });
  }
  var navToggle = document.getElementById("navToggle");
  var navEl = document.getElementById("nav");
  if (navToggle && navEl) {
    navToggle.addEventListener("click", function () {
      var open = navEl.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  // ---------------------------------------------------------
  // 7. Shared bridge so the knowledge-graph script (loaded separately,
  //    lazily) can open the same project modal and stay in sync with
  //    card/carousel selection, using one shared identifier: the slug.
  // ---------------------------------------------------------
  var _openDetail = openDetail;
  openDetail = function (slug, trigger) {
    _openDetail(slug, trigger);
    window.dispatchEvent(new CustomEvent("atlas:project-selected", { detail: { slug: slug } }));
  };
  window.AtlasBridge = {
    openProject: function (slug) { openDetail(slug); },
    projectSlugs: projects.map(function (p) { return p.slug; })
  };

  // ---------------------------------------------------------
  // 8. Cinematic starfield background (ported from index.html's #space
  //    canvas — same technique, same reduced-motion/visibility handling,
  //    theme-aware palette). Ambient only: ~8s-scale drift, ~150 stars,
  //    pauses when the tab is hidden.
  // ---------------------------------------------------------
  (function () {
    var canvas = document.getElementById("atlas-space");
    if (!canvas) return;
    var reduce = reduceMotionMQ.matches;
    var ctx = canvas.getContext("2d"), W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
    var stars = [], shooting = [], scrollY = window.scrollY || 0, running = true;

    function theme() { return docEl.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
    function palette() {
      return theme() === "dark"
        ? { star: "226,236,255", maxA: 0.9, baseA: 0.35, shoot: "200,222,255", shootA: 0.9, count: 0.00010 }
        : { star: "40,70,130", maxA: 0.28, baseA: 0.10, shoot: "47,99,232", shootA: 0.35, count: 0.00006 };
    }
    var pal = palette();

    var links = [];               // sparse "constellation" links: pairs of star indices
    var LINK_MAX_DIST = 130;      // px, beyond this a link fades out until re-linked
    var LINKS_PER_STAR = 1;       // keep it sparse, not a spiderweb

    function computeLinks() {
      links = [];
      var linkCount = new Array(stars.length).fill(0);
      for (var i = 0; i < stars.length; i++) {
        if (linkCount[i] >= LINKS_PER_STAR) continue;
        var best = -1, bestDist = LINK_MAX_DIST;
        for (var j = 0; j < stars.length; j++) {
          if (i === j || linkCount[j] >= LINKS_PER_STAR) continue;
          var dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < bestDist) { bestDist = d; best = j; }
        }
        if (best > -1) { links.push([i, best]); linkCount[i]++; linkCount[best]++; }
      }
    }

    function resize() {
      W = window.innerWidth; H = window.innerHeight;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var target = Math.min(150, Math.floor(W * H * pal.count));
      stars = [];
      for (var i = 0; i < target; i++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3,
          vy: Math.random() * 0.20 + 0.04, vx: (Math.random() - 0.5) * 0.06,
          tw: Math.random() * Math.PI * 2, tws: Math.random() * 0.02 + 0.006,
          depth: Math.random() * 0.6 + 0.2
        });
      }
      computeLinks();
    }
    function spawnShoot() {
      if (reduce) return;
      var fromTop = Math.random() < 0.5;
      shooting.push({
        x: Math.random() * W * 0.7, y: fromTop ? -20 : Math.random() * H * 0.4,
        len: Math.random() * 90 + 60, sp: Math.random() * 5 + 5, ang: Math.PI / 5,
        life: 0, max: Math.random() * 40 + 50
      });
    }
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      var px = scrollY * 0.03;

      // constellation links first, so star dots render on top of the lines
      for (var l = 0; l < links.length; l++) {
        var sa = stars[links[l][0]], sb = stars[links[l][1]];
        if (!sa || !sb) continue;
        var ldx = sa.x - sb.x, ldy = sa.y - sb.y;
        var ldist = Math.sqrt(ldx * ldx + ldy * ldy);
        if (ldist > LINK_MAX_DIST * 1.3) continue; // drifted apart / just wrapped — fade out until relink
        var lineA = (1 - ldist / (LINK_MAX_DIST * 1.3)) * pal.baseA * 1.4;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = "rgba(" + pal.star + "," + lineA.toFixed(3) + ")";
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        s.y += s.vy; s.x += s.vx; s.tw += s.tws;
        if (s.y > H + 5) { s.y = -5; s.x = Math.random() * W; }
        if (s.x < -5) s.x = W + 5; else if (s.x > W + 5) s.x = -5;
        var a = pal.baseA + (pal.maxA - pal.baseA) * (0.5 + 0.5 * Math.sin(s.tw));
        var yy = s.y - px * s.depth;
        ctx.beginPath();
        ctx.arc(s.x, ((yy % (H + 10)) + (H + 10)) % (H + 10), s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + pal.star + "," + a.toFixed(3) + ")";
        ctx.fill();
      }
      for (var j = shooting.length - 1; j >= 0; j--) {
        var m = shooting[j]; m.life++;
        var dx = Math.cos(m.ang) * m.sp, dy = Math.sin(m.ang) * m.sp;
        m.x += dx; m.y += dy;
        var g = ctx.createLinearGradient(m.x, m.y, m.x - Math.cos(m.ang) * m.len, m.y - Math.sin(m.ang) * m.len);
        g.addColorStop(0, "rgba(" + pal.shoot + "," + pal.shootA + ")");
        g.addColorStop(1, "rgba(" + pal.shoot + ",0)");
        ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.beginPath();
        ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - Math.cos(m.ang) * m.len, m.y - Math.sin(m.ang) * m.len); ctx.stroke();
        if (m.life > m.max || m.x > W + 120 || m.y > H + 120) shooting.splice(j, 1);
      }
      requestAnimationFrame(draw);
    }
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });
    document.addEventListener("visibilitychange", function () {
      running = !document.hidden;
      if (running && !reduce) requestAnimationFrame(draw);
    });
    new MutationObserver(function () { pal = palette(); }).observe(docEl, { attributes: true, attributeFilter: ["data-theme"] });

    resize();
    if (reduce) {
      ctx.clearRect(0, 0, W, H);
      for (var l0 = 0; l0 < links.length; l0++) {
        var sa0 = stars[links[l0][0]], sb0 = stars[links[l0][1]];
        ctx.beginPath(); ctx.moveTo(sa0.x, sa0.y); ctx.lineTo(sb0.x, sb0.y);
        ctx.strokeStyle = "rgba(" + pal.star + "," + (pal.baseA * 0.7).toFixed(3) + ")";
        ctx.lineWidth = 0.6; ctx.stroke();
      }
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k];
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + pal.star + "," + pal.baseA.toFixed(3) + ")"; ctx.fill();
      }
    } else {
      requestAnimationFrame(draw);
      setInterval(function () { if (running && Math.random() < 0.5) spawnShoot(); }, 4200);
      setInterval(function () { if (running) computeLinks(); }, 3000);
    }
  })();
})();
