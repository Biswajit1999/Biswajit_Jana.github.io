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
          Project: "#60a5fa", Instrument: "#5eead4", Method: "#93c5fd",
          Molecule: "#c4b5fd", PlanetClass: "#fbbf24", AnalysisType: "#2dd4bf",
          Domain: "#f59e0b", Technology: "#22d3ee",
          link: "rgba(125,167,218,0.34)", domainLink: "rgba(245,158,11,0.72)", repositoryLink: "rgba(96,165,250,0.42)",
          linkLit: "#fbbf24", bg: "rgba(0,0,0,0)"
        }
      : {
          Project: "#1e3a5f", Instrument: "#0f766e", Method: "#1d4ed8",
          Molecule: "#6d28d9", PlanetClass: "#b45309", AnalysisType: "#0f766e",
          Domain: "#c2410c", Technology: "#0e7490",
          link: "rgba(30,58,95,0.28)", domainLink: "rgba(194,65,12,0.68)", repositoryLink: "rgba(30,58,95,0.38)",
          linkLit: "#c2410c", bg: "rgba(0,0,0,0)"
        };
  }
  var NODE_SIZE = {
    Project: 6.8, Domain: 18, Technology: 7.2, Instrument: 7.4,
    Method: 5.6, Molecule: 6.2, PlanetClass: 6.4, AnalysisType: 7.8
  };
  var ALL_TYPES = ["Project", "Domain", "Technology", "Instrument", "Method", "Molecule", "PlanetClass", "AnalysisType"];

  var loaded = false, graphData = null, Graph = null, pal = palette(), refreshGraphTheme = null;
  var activeTypeFilters = new Set(ALL_TYPES);
  var selectedId = null, litNeighbors = null;
  var searchTerm = "";

  var DOMAIN_RULES = [
    ["Exoplanets & atmospheres", /exoplanet|transit|radial.?velocity|planet|atmospher|brown.?dwarf|microlens|coronagraph/i],
    ["Astronomical instrumentation", /spectrograph|instrument|calibrat|exohspec|detector|optics|ccd|telescope|doppler/i],
    ["Survey data & provenance", /archive|catalog|gaia|euclid|sdss|tess|hubble|jwst|provenance|cross.?match/i],
    ["Cosmology & fundamental physics", /cosmolog|supernova|hubble.?diagram|dark.?matter|gravit|quantum|multiverse|wormhole|relativ/i],
    ["Time-domain & high-energy astronomy", /gamma.?ray|pulsar|frb|transient|supernova|variab|timing|gravitational.?wave/i],
    ["Scientific computing & inference", /machine.?learning|bayes|monte.?carlo|simulation|numerical|statistics|signal|benchmark|inference/i],
    ["Interactive laboratories", /lab|visuali[sz]|simulator|explorer|playground|studio|observatory|dashboard/i],
    ["Research platforms & documentation", /portfolio|profile|atlas|platform|journal|notes|coursework|github\.io|documentation/i]
  ];

  function domainFor(node, repo) {
    var text = [node.label, node.projectType || "", repo && repo.name, repo && repo.description,
      repo && repo.language, repo && (repo.topics || []).join(" ")].filter(Boolean).join(" ");
    for (var i = 0; i < DOMAIN_RULES.length; i++) if (DOMAIN_RULES[i][1].test(text)) return DOMAIN_RULES[i][0];
    return "Research software & experiments";
  }

  function architectureGraph(data, repos) {
    var nodes = data.nodes.map(function (node) { return Object.assign({}, node); });
    var edges = data.edges.map(function (edge) { return Object.assign({}, edge); });
    var nodeIndex = {};
    var edgeKeys = new Set();
    nodes.forEach(function (node) { nodeIndex[node.id] = node; });
    edges.forEach(function (edge) { edgeKeys.add(String(edge.source) + "→" + String(edge.target) + ":" + edge.relation); });

    function addNode(node) {
      if (!nodeIndex[node.id]) { nodeIndex[node.id] = node; nodes.push(node); }
      return nodeIndex[node.id];
    }
    function addEdge(source, target, relation, extra) {
      var key = source + "→" + target + ":" + relation;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push(Object.assign({ source: source, target: target, relation: relation, relationStatus: "public-metadata" }, extra || {}));
    }

    var root = addNode({ id: "domain:portfolio-core", type: "Domain", label: "Biswajit Jana · Research portfolio", isRoot: true });
    var repoIndex = {};
    var projectBySlug = {};
    var projectDomain = {};
    (repos || []).forEach(function (repo) { repoIndex[String(repo.name).toLowerCase()] = repo; });
    nodes.filter(function (node) { return node.type === "Project"; }).forEach(function (node) {
      projectBySlug[String(node.slug || node.id.replace(/^project:/, "")).toLowerCase()] = node;
    });

    function connectProject(project, repo) {
      var domain = domainFor(project, repo);
      var domainId = "domain:" + domain.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      addNode({ id: domainId, type: "Domain", label: domain });
      addEdge(root.id, domainId, "CONTAINS_DOMAIN");
      addEdge(domainId, project.id, "CONTAINS_REPOSITORY", { sourceRepo: project.slug });
      projectDomain[project.id] = domainId;
      if (repo) {
        project.githubUrl = repo.html_url || project.githubUrl;
        project.liveUrl = repo.homepage || (repo.has_pages ? "https://biswajit1999.github.io/" + encodeURIComponent(repo.name) + "/" : project.liveUrl);
        project.description = repo.description || "";
        project.stars = repo.stargazers_count || 0;
        project.updatedAt = repo.pushed_at || repo.updated_at;
        project.language = repo.language || "";
        if (repo.language) {
          var techId = "technology:" + repo.language.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          addNode({ id: techId, type: "Technology", label: repo.language });
          addEdge(project.id, techId, "USES_TECHNOLOGY", { sourceRepo: project.slug });
        }
      }
    }

    nodes.filter(function (node) { return node.type === "Project"; }).forEach(function (project) {
      connectProject(project, repoIndex[String(project.slug || "").toLowerCase()]);
    });

    (repos || []).forEach(function (repo) {
      if (projectBySlug[String(repo.name).toLowerCase()]) return;
      var id = "project:" + repo.name;
      var project = addNode({
        id: id, type: "Project", label: repo.name.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); }),
        slug: repo.name, projectType: "live-repository", githubUrl: repo.html_url, liveOnly: true
      });
      connectProject(project, repo);
    });

    var degree = {};
    edges.forEach(function (edge) {
      degree[edge.source] = (degree[edge.source] || 0) + 1;
      degree[edge.target] = (degree[edge.target] || 0) + 1;
    });
    nodes.forEach(function (node) { node.degree = degree[node.id] || 0; });

    /* Give the force simulation an architectural starting point: a fixed domain
       ring, repository constellations around each domain, and outer semantic
       layers. The forces may refine the satellites, but the portfolio skeleton
       remains legible and repeatable rather than collapsing into a generic blob. */
    root.fx = 0; root.fy = 0; root.fz = 0;
    var domains = nodes.filter(function (node) { return node.type === "Domain" && !node.isRoot; })
      .sort(function (a, b) { return a.label.localeCompare(b.label); });
    var domainById = {};
    domains.forEach(function (domain, index) {
      var angle = (index / Math.max(1, domains.length)) * Math.PI * 2;
      domain.fx = Math.cos(angle) * 235;
      domain.fy = Math.sin(angle * 2) * 72;
      domain.fz = Math.sin(angle) * 235;
      domainById[domain.id] = domain;
    });
    var domainSlots = {};
    nodes.filter(function (node) { return node.type === "Project"; }).forEach(function (project) {
      var domainId = projectDomain[project.id];
      var anchor = domainById[domainId] || root;
      var slot = domainSlots[domainId] || 0;
      domainSlots[domainId] = slot + 1;
      var angle = slot * 2.3999632297;
      var spread = 42 + 10 * Math.sqrt(slot + 1);
      project.x = anchor.fx + Math.cos(angle) * spread;
      project.y = anchor.fy + Math.sin(angle) * spread * 0.68;
      project.z = anchor.fz + Math.sin(angle * 1.7) * spread;
    });
    var semanticSlots = {};
    nodes.filter(function (node) { return node.type !== "Project" && node.type !== "Domain"; }).forEach(function (node) {
      var slot = semanticSlots[node.type] || 0;
      semanticSlots[node.type] = slot + 1;
      var layer = ALL_TYPES.indexOf(node.type);
      var angle = slot * 2.3999632297 + layer * 0.63;
      var radius = 330 + layer * 16 + Math.sqrt(slot + 1) * 9;
      node.x = Math.cos(angle) * radius;
      node.y = Math.sin(angle * 1.41) * 150;
      node.z = Math.sin(angle) * radius;
    });
    return { nodes: nodes, edges: edges, repositoryCount: nodes.filter(function (n) { return n.type === "Project"; }).length };
  }

  function loadGraph() {
    if (loaded) return;
    loaded = true;
    var reposReady = window.AtlasReposReady || Promise.resolve(window.AtlasLiveRepos || []);
    Promise.all([
      fetch("data/research-graph.json").then(function (r) { if (!r.ok) throw new Error("Graph unavailable"); return r.json(); }),
      reposReady.catch(function () { return []; })
    ]).then(function (results) {
        graphData = architectureGraph(results[0], results[1]);
        var note = document.getElementById("atlas-graph-note");
        if (note) note.textContent = "Complete public-repository topology with curated scientific relationships; select any node to trace its immediate context.";
        var repoMetric = document.getElementById("atlas-architecture-repos");
        var linkMetric = document.getElementById("atlas-architecture-links");
        if (repoMetric) repoMetric.textContent = String(graphData.repositoryCount);
        if (linkMetric) linkMetric.textContent = String(graphData.edges.length);
        render();
      })
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
        .nodeVal(function (n) {
          if (n.isRoot) return 34;
          return (NODE_SIZE[n.type] || 3) + Math.min(7, Math.sqrt(n.degree || 0));
        })
        .nodeResolution(14)
        .nodeRelSize(4.6)
        .nodeColor(nodeColor)
        .nodeOpacity(0.92)
        .linkColor(linkColor)
        .linkWidth(function (l) { return isLit(l) ? 2.2 : (l.relation === "CONTAINS_DOMAIN" ? 1.65 : (l.relation === "CONTAINS_REPOSITORY" ? 1.05 : 0.72)); })
        .linkOpacity(0.64)
        .linkCurvature(function (l) { return l.relation === "CONTAINS_DOMAIN" ? 0.24 : (l.relation === "CONTAINS_REPOSITORY" ? 0.08 : 0.025); })
        .linkDirectionalParticles(function (l) { return !reduceMotionMQ.matches && l.relation === "CONTAINS_DOMAIN" ? 2 : 0; })
        .linkDirectionalParticleWidth(1.8)
        .linkDirectionalParticleSpeed(0.0035)
        .linkDirectionalParticleColor(function () { return pal.Domain; })
        .onNodeClick(function (n) { selectNode(n.id); focusNode(n); })
        .onBackgroundClick(function () { clearSelection(); })
        .cooldownTime(reduceMotionMQ.matches ? 0 : 1200)
        .onEngineStop(function () {
          var fitMs = reduceMotionMQ.matches ? 0 : 600;
          fitToGraph(fitMs);
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
      var distance = (radius * 1.0) / Math.sin(fovRad / 2);

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

    wireControls();
    wireSemanticList();
    refreshVisibility();

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
    function linkColor(l) {
      if (isLit(l)) return pal.linkLit;
      if (l.relation === "CONTAINS_DOMAIN") return pal.domainLink;
      if (l.relation === "CONTAINS_REPOSITORY") return pal.repositoryLink;
      return pal.link;
    }
    refreshGraphTheme = function () {
      if (Graph) Graph.nodeColor(nodeColor).linkColor(linkColor);
    };

    function endpointId(endpoint) { return typeof endpoint === "object" ? endpoint.id : endpoint; }
    function refreshVisibility() {
      var directMatches = new Set();
      graphData.nodes.forEach(function (node) {
        if (!activeTypeFilters.has(node.type)) return;
        if (!searchTerm || node.label.toLowerCase().indexOf(searchTerm) > -1) directMatches.add(node.id);
      });
      function visibleNode(node) {
        if (!activeTypeFilters.has(node.type)) return false;
        if (!searchTerm) return true;
        if (directMatches.has(node.id)) return true;
        var neighbors = neighborIndex[node.id] || new Set();
        return Array.from(neighbors).some(function (id) { return directMatches.has(id); });
      }
      function visibleLink(link) {
        var source = graphData.nodes.find(function (node) { return node.id === endpointId(link.source); });
        var target = graphData.nodes.find(function (node) { return node.id === endpointId(link.target); });
        return !!(source && target && visibleNode(source) && visibleNode(target));
      }
      Graph.nodeVisibility(visibleNode).linkVisibility(visibleLink);
      var nodeCount = graphData.nodes.filter(visibleNode).length;
      var edgeCount = graphData.edges.filter(visibleLink).length;
      var status = document.getElementById("atlas-graph-status");
      if (status) status.textContent = nodeCount + " visible nodes · " + edgeCount + " visible relationships";
    }

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
        searchTerm = "";
        var searchInput = document.getElementById("atlas-graph-search");
        if (searchInput) searchInput.value = "";
        activeTypeFilters = new Set(ALL_TYPES);
        document.querySelectorAll("[data-graph-type-filter]").forEach(function (checkbox) { checkbox.checked = true; });
        refreshVisibility();
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
        refreshVisibility();
      });
      document.querySelectorAll("[data-graph-type-filter]").forEach(function (cb) {
        cb.addEventListener("change", function () {
          var type = cb.getAttribute("data-graph-type-filter");
          if (cb.checked) activeTypeFilters.add(type); else activeTypeFilters.delete(type);
          Graph.nodeColor(nodeColor);
          refreshVisibility();
        });
      });
      var listToggle = document.getElementById("atlas-graph-list-toggle");
      var listWrap = document.getElementById("atlas-graph-list-wrap");
      if (listToggle && listWrap) listToggle.addEventListener("click", function () {
        var open = listWrap.hidden;
        listWrap.hidden = !open;
        listToggle.setAttribute("aria-expanded", open ? "true" : "false");
        listToggle.textContent = open ? "Hide relationship index" : "Relationship index";
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

    var html = '<button type="button" class="atlas-graph-panel-close" aria-label="Close node details">&times;</button>' +
      "<h4>" + escapeHTML(node.label) + "</h4>" +
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
    var closeBtn = panel.querySelector(".atlas-graph-panel-close");
    if (closeBtn) closeBtn.addEventListener("click", function () {
      panel.hidden = true;
      selectedId = null;
      litNeighbors = null;
      if (Graph) Graph.nodeColor(nodeColor).linkColor(linkColor);
    });
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

  new MutationObserver(function () {
    pal = palette();
    if (refreshGraphTheme) refreshGraphTheme();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

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
