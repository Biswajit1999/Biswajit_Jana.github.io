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
          Project: "#7fa1f7", Instrument: "#5cc4a8", Method: "#7fa1f7",
          Molecule: "#a696f0", PlanetClass: "#e0ab55", AnalysisType: "#e0ab55",
          link: "rgba(140,170,230,0.25)", linkLit: "#7fa1f7", bg: "rgba(0,0,0,0)"
        }
      : {
          Project: "#2f63e8", Instrument: "#157a67", Method: "#2f63e8",
          Molecule: "#6a4fc4", PlanetClass: "#a66c14", AnalysisType: "#a66c14",
          link: "rgba(20,40,80,0.18)", linkLit: "#2f63e8", bg: "rgba(0,0,0,0)"
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

    Graph = ForceGraph3D()(container)
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
      .cooldownTime(reduceMotionMQ.matches ? 0 : 4000)
      .onEngineStop(function () {
        // frame the graph to whatever scale the physics actually settled at,
        // instead of guessing a fixed camera distance
        var fitMs = reduceMotionMQ.matches ? 0 : 600;
        Graph.zoomToFit(fitMs, 40);
        // zoomToFit tweens the camera over fitMs — read the result only once that
        // tween has actually finished, not mid-flight
        setTimeout(function () {
          var pos = Graph.cameraPosition();
          var controls = Graph.controls && Graph.controls();
          var target = controls && controls.target ? controls.target : null;
          orbitCenter = target ? { x: target.x || 0, y: target.y || 0, z: target.z || 0 } : { x: 0, y: 0, z: 0 };
          orbitY = pos.y;
          orbitDistance = Math.hypot(pos.x - orbitCenter.x, pos.y - orbitCenter.y, pos.z - orbitCenter.z) || 300;
          if (!reduceMotionMQ.matches && !orbitTimer) startOrbit();
        }, fitMs + 50);
      });

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

    function wireControls() {
      var resetBtn = document.getElementById("atlas-graph-reset");
      if (resetBtn) resetBtn.addEventListener("click", function () {
        clearSelection();
        Graph.zoomToFit(600, 40);
      });
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
