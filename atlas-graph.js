/* ============================================================
   RESEARCH KNOWLEDGE GRAPH — real 3D, via Three.js + 3d-force-graph
   Loads data/research-graph.json (built offline by build_research_graph.py
   from the same manifest the rest of the page uses — no GitHub API call,
   no LLM call, nothing invented at runtime) only once the graph section
   nears the viewport. The 3D view is a progressive enhancement: the real
   semantic list (already in the HTML, server-baked) is the accessible,
   no-JS-safe, crawlable version this script only adds a visualization on
   top of. Drag to orbit, scroll to zoom, click a node for its connections.
   ============================================================ */
(function () {
  "use strict";

  var section = document.getElementById("atlas-graph-section");
  if (!section) return;

  var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var isNarrow = function () { return window.innerWidth < 760; };

  // resolved colors (WebGL can't read CSS custom properties) — kept in step
  // with the token values in atlas.css's :root / [data-theme="dark"] blocks
  function isDark() { return document.documentElement.getAttribute("data-theme") === "dark"; }
  function palette() {
    return isDark()
      ? {
          Project: "#e0973d", Instrument: "#a3ab5a", Method: "#e0973d",
          Molecule: "#b08a92", PlanetClass: "#d97a5a", AnalysisType: "#d97a5a",
          link: "rgba(224,151,61,0.22)", linkLit: "#e0973d", bg: "rgba(0,0,0,0)"
        }
      : {
          Project: "#a4530a", Instrument: "#5f6b1f", Method: "#a4530a",
          Molecule: "#6b4a52", PlanetClass: "#9c3b23", AnalysisType: "#9c3b23",
          link: "rgba(90,55,20,0.16)", linkLit: "#a4530a", bg: "rgba(0,0,0,0)"
        };
  }
  var NODE_SIZE = {
    Project: 5, Instrument: 3.2, Method: 2.6, Molecule: 3, PlanetClass: 3, AnalysisType: 3.2
  };

  var loaded = false, graphData = null, Graph = null, pal = palette();
  var activeTypeFilters = new Set(["Project", "Instrument", "Method", "Molecule", "PlanetClass", "AnalysisType"]);
  var selectedId = null, litNeighbors = null;
  var searchTerm = "";

  function loadGraph() {
    if (loaded) return;
    loaded = true;
    fetch("data/research-graph.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { graphData = data; render(); })
      .catch(function () {
        var note = document.getElementById("atlas-graph-note");
        if (note) note.textContent = "The interactive graph could not load. The relationship list below still has the full data.";
      });
  }

  var io = ("IntersectionObserver" in window)
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { loadGraph(); io.disconnect(); } });
      }, { rootMargin: "200px" })
    : null;
  if (io) io.observe(section); else loadGraph();

  function render() {
    var container = document.getElementById("atlas-graph-canvas");
    if (!container || !graphData) return;

    if (isNarrow() || typeof ForceGraph3D === "undefined") {
      container.hidden = true;
      var listWrap = document.getElementById("atlas-graph-list-wrap");
      if (listWrap) listWrap.hidden = false;
      wireSemanticList();
      return;
    }

    var neighborIndex = {}; // nodeId -> Set of connected nodeIds (built once, reused on every click)
    graphData.nodes.forEach(function (n) { neighborIndex[n.id] = new Set(); });
    graphData.edges.forEach(function (e) {
      if (neighborIndex[e.source]) neighborIndex[e.source].add(e.target);
      if (neighborIndex[e.target]) neighborIndex[e.target].add(e.source);
    });

    var orbitTimer = null;
    var orbitDistance = 300; // replaced with the real fitted distance once layout settles
    var orbitCenter = { x: 0, y: 0, z: 0 }; // the graph's actual look-at point (rarely the world origin)
    var orbitY = 0;

    try {
      Graph = ForceGraph3D()(container);
      // Only set an explicit size when the container actually has one yet. 3d-force-graph's
      // .width()/.height() setters also write that exact value as an inline style onto the
      // container element -- if this section is constructed before the page has finished
      // laying out (it mounts via IntersectionObserver 200px before entering view, which can
      // beat web fonts and grid resolution) container.clientWidth can read 0 here, and
      // .width(0) would pin the container at 0px forever via that inline style, since nothing
      // else would ever touch it again. Skipping it in that case is safe: the ResizeObserver
      // below only fires on an actual size CHANGE, so a real 0 -> real-size transition still
      // gets caught and applied there once the container settles.
      if (container.clientWidth && container.clientHeight) {
        Graph.width(container.clientWidth).height(container.clientHeight);
      }
      Graph
        // cooldownTicks defaults to Infinity, so the only thing that was ending the layout
        // pass was the cooldownTime wall clock -- meaning convergence quality depended on
        // how many real-time rAF ticks the browser actually delivered in that window, not
        // a fixed amount of physics. warmupTicks runs as a synchronous loop instead (not
        // rAF-driven), guaranteeing the same solid convergence every time regardless of
        // frame timing, before the very first frame is even painted.
        .warmupTicks(220)
        .graphData({ nodes: graphData.nodes, links: graphData.edges })
        .backgroundColor(pal.bg)
        .showNavInfo(false)
        .nodeLabel(function (n) { return n.label; })
        .nodeVal(function (n) { return NODE_SIZE[n.type] || 3; })
        .nodeColor(nodeColor)
        .nodeOpacity(0.92)
        .linkColor(linkColor)
        .linkWidth(function (l) { return isLit(l) ? 1.4 : 0.5; })
        .linkOpacity(0.35)
        .onNodeClick(function (n) { selectNode(n.id); focusNode(n); })
        .onBackgroundClick(function () { clearSelection(); })
        .cooldownTime(reduceMotionMQ.matches ? 0 : 1200)
        .onEngineStop(function () {
          var fitMs = reduceMotionMQ.matches ? 0 : 600;
          fitToGraph(fitMs);
          // fitToGraph's camera move is tweened over fitMs; starting the orbit immediately
          // would read the camera's pre-tween position for its starting angle and effectively
          // cut the tween short. Wait for it to actually finish first.
          if (!reduceMotionMQ.matches && !orbitTimer) setTimeout(startOrbit, fitMs + 30);
        });
    } catch (err) {
      // never leave a silently-broken empty box -- fall back to the accessible,
      // server-baked list the same way the fetch-failure and narrow-viewport paths do
      container.hidden = true;
      var listWrapEl = document.getElementById("atlas-graph-list-wrap");
      if (listWrapEl) listWrapEl.hidden = false;
      var noteEl = document.getElementById("atlas-graph-note");
      if (noteEl) noteEl.textContent = "The interactive graph could not load. The relationship list below still has the full data.";
      wireSemanticList();
      return;
    }

    // the graph is constructed as soon as this section nears the viewport (IntersectionObserver,
    // 200px early), which can be before the page's layout has fully settled — web fonts loading,
    // the CSS grid resolving its 1fr track, etc. don't fire a window "resize" event, so a
    // window-resize-only listener can leave the renderer's canvas sized to a stale, wrong
    // container size while the bordered box around it settles to its real size. Watch the
    // container itself instead, and re-fit whenever its actual size changes for any reason.
    var appliedInitialSize = !!(container.clientWidth && container.clientHeight);
    function applySize(w, h) {
      if (!w || !h) return false;
      Graph.width(w).height(h);
      fitToGraph(0);
      appliedInitialSize = true;
      return true;
    }
    if ("ResizeObserver" in window) {
      var lastW = container.clientWidth, lastH = container.clientHeight;
      var containerObserver = new ResizeObserver(function () {
        var w = container.clientWidth, h = container.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w; lastH = h;
        applySize(w, h);
      });
      containerObserver.observe(container);
      section.addEventListener("atlas:graph-teardown", function () { containerObserver.disconnect(); }, { once: true });
    }
    // backup for the case where the container is 0x0 at construction: don't rely on
    // ResizeObserver alone to catch that transition (its exact firing behavior can vary),
    // poll a few times over the first couple of seconds and stop as soon as a real size
    // shows up or the graph already has one
    if (!appliedInitialSize) {
      var sizeRetries = 0;
      var sizeRetryTimer = setInterval(function () {
        sizeRetries++;
        if (appliedInitialSize || applySize(container.clientWidth, container.clientHeight) || sizeRetries >= 10) {
          clearInterval(sizeRetryTimer);
        }
      }, 200);
      section.addEventListener("atlas:graph-teardown", function () { clearInterval(sizeRetryTimer); }, { once: true });
    }

    // 3d-force-graph's own zoomToFit always aims the camera at the world origin (see its
    // fitToBbox source — the "center" it fits around is hardcoded, not the graph's actual
    // bounding box), so with a large graph and a short cooldown the layout can still be
    // off-origin when framing happens, leaving the cluster shifted to one side of the
    // canvas. This computes the real bounding box from the settled node positions and
    // frames/orbits around THAT instead.
    function fitToGraph(ms) {
      var nodes = graphData.nodes;
      // centroid (average position), not the bounding-box midpoint -- d3-force's default
      // forceCenter() pulls the centroid toward the origin each tick, but a handful of
      // outlier nodes can still stretch the box's min/max bounds asymmetrically, which
      // drags the BOX's midpoint away from where the graph's actual mass sits. Framing
      // around the box midpoint left the dense cluster visibly off to one side even
      // though the true center of mass was correctly near the origin.
      var center = { x: 0, y: 0, z: 0 }, n = 0;
      nodes.forEach(function (node) {
        if (typeof node.x !== "number") return;
        center.x += node.x; center.y += node.y; center.z += node.z; n++;
      });
      if (!n) return; // no positioned nodes yet
      center.x /= n; center.y /= n; center.z /= n;
      // bounding-sphere radius around that centroid (farthest node from it), so outliers
      // still get included in the frame without pulling the look-at point off the mass
      var radius = 0;
      nodes.forEach(function (node) {
        if (typeof node.x !== "number") return;
        var d = Math.hypot(node.x - center.x, node.y - center.y, node.z - center.z);
        if (d > radius) radius = d;
      });
      radius = Math.max(radius, 20);

      var camera = Graph.camera();
      var fovRad = (camera.fov || 50) * Math.PI / 180;
      var distance = (radius * 1.35) / Math.sin(fovRad / 2);

      // keep whatever horizontal viewing angle the camera currently has (or a pleasant
      // default on first run) rather than always approaching from the same axis
      var cur = Graph.cameraPosition();
      var dx = cur.x - center.x, dz = cur.z - center.z;
      if (!dx && !dz) { dx = 0.6; dz = 1; }
      var horizLen = Math.hypot(dx, dz) || 1;
      var camPos = {
        x: center.x + (dx / horizLen) * distance * 0.86,
        y: center.y + distance * 0.5,
        z: center.z + (dz / horizLen) * distance * 0.86
      };
      Graph.cameraPosition(camPos, center, ms || 0);

      orbitCenter = center;
      orbitY = camPos.y;
      orbitDistance = Math.hypot(camPos.x - center.x, camPos.y - center.y, camPos.z - center.z);
    }

    // gentle auto-orbit only while nothing is selected, and only when motion is welcome —
    // this is the one continuous ambient motion in the scene, matching "ambient" motion
    // tokens elsewhere on the page rather than a constant spinning showpiece.
    // Orbits around the graph's actual look-at center (not the world origin) and keeps
    // facing that same point on every tick, so the cluster never drifts off-canvas.
    function startOrbit() {
      var angle = Math.atan2(
        Graph.cameraPosition().x - orbitCenter.x,
        Graph.cameraPosition().z - orbitCenter.z
      );
      orbitTimer = setInterval(function () {
        if (selectedId || document.hidden) return;
        angle += Math.PI / 1400;
        Graph.cameraPosition({
          x: orbitCenter.x + orbitDistance * Math.sin(angle),
          y: orbitY,
          z: orbitCenter.z + orbitDistance * Math.cos(angle)
        }, orbitCenter);
      }, 30);
      section.addEventListener("atlas:graph-teardown", function () { clearInterval(orbitTimer); }, { once: true });
    }

    wireControls();
    wireSemanticList();

    window.addEventListener("atlas:project-selected", function (e) {
      var pid = "project:" + e.detail.slug;
      if (neighborIndex[pid]) { selectNode(pid); }
    });

    function isLit(link) {
      if (!selectedId) return false;
      var s = typeof link.source === "object" ? link.source.id : link.source;
      var t = typeof link.target === "object" ? link.target.id : link.target;
      return s === selectedId || t === selectedId;
    }
    function nodeColor(n) {
      var base = pal[n.type] || pal.Method;
      if (searchTerm && n.label.toLowerCase().indexOf(searchTerm) === -1) return "rgba(120,120,130,0.15)";
      if (!activeTypeFilters.has(n.type)) return "rgba(120,120,130,0.08)";
      if (selectedId) {
        if (n.id === selectedId) return base;
        if (litNeighbors && litNeighbors.has(n.id)) return base;
        return "rgba(120,120,130,0.18)";
      }
      return base;
    }
    function linkColor(l) { return isLit(l) ? pal.linkLit : pal.link; }

    function focusNode(n) {
      var distRatio = 1 + 80 / Math.hypot(n.x || 1, n.y || 1, n.z || 1);
      Graph.cameraPosition(
        { x: (n.x || 0) * distRatio, y: (n.y || 0) * distRatio, z: (n.z || 0) * distRatio },
        n, 700
      );
    }

    function selectNode(nodeId) {
      selectedId = nodeId;
      litNeighbors = neighborIndex[nodeId] || new Set();
      Graph.nodeColor(nodeColor).linkColor(linkColor).linkWidth(function (l) { return isLit(l) ? 1.4 : 0.5; });
      renderDetailPanel(nodeId, neighborIndex);
    }
    function clearSelection() {
      selectedId = null; litNeighbors = null;
      Graph.nodeColor(nodeColor).linkColor(linkColor);
      var panel = document.getElementById("atlas-graph-panel");
      if (panel) panel.hidden = true;
    }
    window._atlasGraphSelectNode = selectNode; // used by the semantic-list click handler below

    // moves the camera along the line to whatever it's currently looking at, preserving
    // the viewing angle -- a dolly zoom rather than a jump -- and updates orbitDistance so
    // the auto-orbit (if running) continues at the new zoom level instead of snapping back
    function zoomBy(factor) {
      var pos = Graph.cameraPosition();
      var dx = pos.x - orbitCenter.x, dy = pos.y - orbitCenter.y, dz = pos.z - orbitCenter.z;
      var dist = Math.hypot(dx, dy, dz) || orbitDistance || 300;
      var newDist = Math.min(Math.max(dist * factor, 40), 6000);
      var scale = newDist / dist;
      Graph.cameraPosition({
        x: orbitCenter.x + dx * scale,
        y: orbitCenter.y + dy * scale,
        z: orbitCenter.z + dz * scale
      }, orbitCenter, 200);
      orbitDistance = newDist;
    }

    function wireControls() {
      var resetBtn = document.getElementById("atlas-graph-reset");
      if (resetBtn) resetBtn.addEventListener("click", function () {
        clearSelection();
        fitToGraph(600);
      });
      var zoomInBtn = document.getElementById("atlas-graph-zoom-in");
      if (zoomInBtn) zoomInBtn.addEventListener("click", function () { zoomBy(0.8); });
      var zoomOutBtn = document.getElementById("atlas-graph-zoom-out");
      if (zoomOutBtn) zoomOutBtn.addEventListener("click", function () { zoomBy(1.25); });
      var search = document.getElementById("atlas-graph-search");
      if (search) search.addEventListener("input", function () {
        searchTerm = search.value.trim().toLowerCase();
        Graph.nodeColor(nodeColor);
      });
      document.querySelectorAll("[data-graph-type-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var type = cb.getAttribute("data-graph-type-filter");
          if (cb.checked) activeTypeFilters.add(type); else activeTypeFilters.delete(type);
          Graph.nodeColor(nodeColor);
        });
      });
    }
  }

  function renderDetailPanel(nodeId, neighborIndex) {
    var panel = document.getElementById("atlas-graph-panel");
    if (!panel || !graphData) return;
    var node = graphData.nodes.find(function (n) { return n.id === nodeId; });
    if (!node) { panel.hidden = true; return; }
    panel.hidden = false;

    var neighborIds = Array.from(neighborIndex[nodeId] || []);
    var relatedProjects = neighborIds
      .filter(function (id) { return id.indexOf("project:") === 0; })
      .map(function (id) { return graphData.nodes.find(function (n) { return n.id === id; }); })
      .filter(Boolean);

    var html = "<h4>" + escapeHTML(node.label) + "</h4>" +
      "<p class=\"mono\" style=\"font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em\">" + escapeHTML(node.type) + "</p>";

    if (node.type === "Project") {
      html += '<button type="button" class="btn btn-primary btn-sm" id="atlas-graph-open-project">Open project</button>';
      if (node.githubUrl) html += ' <a class="btn btn-ghost btn-sm" href="' + escapeAttr(node.githubUrl) + '" target="_blank" rel="noopener">GitHub</a>';
    } else if (relatedProjects.length) {
      html += "<p style=\"font-size:.86rem;color:var(--ink-soft)\">Appears in " + relatedProjects.length + " " + (relatedProjects.length === 1 ? "project" : "projects") + ":</p>" +
        '<div class="atlas-related-list">' +
        relatedProjects.slice(0, 12).map(function (p) {
          return '<a href="#" data-graph-open-project="' + escapeAttr(p.slug) + '">' + escapeHTML(p.label) + "</a>";
        }).join("") + "</div>";
    }

    var relatedEdges = graphData.edges.filter(function (e) { return (e.source === nodeId || e.target === nodeId) && e.note; });
    if (relatedEdges.length) {
      html += '<div style="margin-top:14px;font-size:.82rem;color:var(--muted)">' +
        relatedEdges.slice(0, 2).map(function (e) { return "<p>" + escapeHTML(e.note) + "</p>"; }).join("") +
        "</div>";
    }

    panel.innerHTML = html;
    var openBtn = document.getElementById("atlas-graph-open-project");
    if (openBtn) openBtn.addEventListener("click", function () {
      if (window.AtlasBridge) window.AtlasBridge.openProject(node.slug);
    });
    panel.querySelectorAll("[data-graph-open-project]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var slug = a.getAttribute("data-graph-open-project");
        if (window._atlasGraphSelectNode) window._atlasGraphSelectNode("project:" + slug);
        if (window.AtlasBridge) window.AtlasBridge.openProject(slug);
      });
    });
  }

  function wireSemanticList() {
    var list = document.getElementById("atlas-graph-semantic-list");
    if (!list || list.dataset.wired) return;
    list.dataset.wired = "1";
    list.addEventListener("click", function (e) {
      var link = e.target.closest("[data-graph-node]");
      if (!link) return;
      e.preventDefault();
      var id = link.getAttribute("data-graph-node");
      if (window._atlasGraphSelectNode) window._atlasGraphSelectNode(id);
      else if (id.indexOf("project:") === 0 && window.AtlasBridge) {
        window.AtlasBridge.openProject(id.replace("project:", ""));
      }
    });
  }

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function escapeAttr(s) { return escapeHTML(s); }

  window.addEventListener("resize", function () {
    if (!graphData) return;
    var container = document.getElementById("atlas-graph-canvas");
    var listWrap = document.getElementById("atlas-graph-list-wrap");
    if (isNarrow()) {
      if (container) container.hidden = true;
      if (listWrap) listWrap.hidden = false;
    } else {
      if (container && !Graph) render();
      if (container) container.hidden = false;
      if (listWrap) listWrap.hidden = true;
      if (Graph) Graph.width(container.clientWidth).height(container.clientHeight);
    }
  });
})();
