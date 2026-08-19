import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const qs = (s, root = document) => root.querySelector(s);
const qsa = (s, root = document) => [...root.querySelectorAll(s)];
const canvas = qs('#universe-canvas');
const labelLayer = qs('#label-layer');
const graphStatus = qs('#graph-status');
const nodePanel = qs('#node-panel');
const nodeLink = qs('#node-link');
const mobile = innerWidth < 760;
const reduceMedia = matchMedia('(prefers-reduced-motion: reduce)');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.35 : 1.75));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0c0805, 0.021);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 260);
camera.position.set(0, 2.6, 19);

const C = { amber: 0xe3a35a, rust: 0xc66743, cyan: 0x7fcad2, green: 0x85bd8b, ivory: 0xf2e6d2, bg: 0x0c0805, blue: 0x78a7ff };
const root = new THREE.Group();
const orbitalRoot = new THREE.Group();
const nodeRoot = new THREE.Group();
const graphRoot = new THREE.Group();
const instrumentRoot = new THREE.Group();
const pathRoot = new THREE.Group();
root.add(orbitalRoot, nodeRoot, graphRoot, instrumentRoot, pathRoot);
scene.add(root);

function makeGlowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,248,232,1)');
  g.addColorStop(.12, 'rgba(255,210,142,.97)');
  g.addColorStop(.42, 'rgba(223,136,69,.30)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glowTex = makeGlowTexture();

function rand(seed) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h >>> 0);
}

const starCount = mobile ? 1250 : 3000;
const starGeometry = new THREE.BufferGeometry();
const starNow = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);
const morphs = {};
const tmpColor = new THREE.Color();

function makeMorph(kind) {
  const a = new Float32Array(starCount * 3);
  const opticalPath = [
    [-30, -4, -7], [-17, -2, -3], [-8, 1.5, -1], [0, 0, 0], [10, 2.5, 1], [19, -1, 3], [29, 1, 8]
  ];
  for (let i = 0; i < starCount; i++) {
    const j = i * 3, r1 = rand(i + 1), r2 = rand(i + 33), r3 = rand(i + 91);
    if (kind === 'sphere') {
      const r = 18 + r1 * 74, t = r2 * Math.PI * 2, u = Math.acos(2 * r3 - 1);
      a[j] = Math.sin(u) * Math.cos(t) * r;
      a[j + 1] = Math.cos(u) * r * .58;
      a[j + 2] = Math.sin(u) * Math.sin(t) * r;
    } else if (kind === 'disk') {
      const r = 3 + Math.sqrt(r1) * 42, t = r2 * Math.PI * 9 + r * .07;
      a[j] = Math.cos(t) * r;
      a[j + 1] = (r3 - .5) * (1.3 + r * .025);
      a[j + 2] = Math.sin(t) * r * .78;
    } else if (kind === 'instrument') {
      const seg = Math.min(opticalPath.length - 2, Math.floor(r1 * (opticalPath.length - 1)));
      const f = r2, p0 = opticalPath[seg], p1 = opticalPath[seg + 1];
      a[j] = THREE.MathUtils.lerp(p0[0], p1[0], f) + (r3 - .5) * 2.2;
      a[j + 1] = THREE.MathUtils.lerp(p0[1], p1[1], f) + (rand(i + 212) - .5) * 2.1;
      a[j + 2] = THREE.MathUtils.lerp(p0[2], p1[2], f) + (rand(i + 512) - .5) * 2.1;
    } else if (kind === 'software') {
      const gx = (i % 17) - 8, gy = (Math.floor(i / 17) % 11) - 5, layer = Math.floor(i / 187) % 7;
      a[j] = gx * 2.45 + (r1 - .5) * .8;
      a[j + 1] = gy * 1.8 + (r2 - .5) * .7;
      a[j + 2] = (layer - 3) * 2.3 + (r3 - .5) * .8;
    } else if (kind === 'timeline') {
      const x = -38 + (i / (starCount - 1)) * 76;
      a[j] = x;
      a[j + 1] = Math.sin(x * .22) * 2.2 + (r1 - .5) * 1.5;
      a[j + 2] = Math.cos(x * .13) * 3 + (r2 - .5) * 2.2;
    }
  }
  return a;
}
['sphere', 'disk', 'instrument', 'software', 'timeline'].forEach(k => morphs[k] = makeMorph(k));
starNow.set(morphs.sphere);
for (let i = 0; i < starCount; i++) {
  tmpColor.setHex(rand(i + 8) > .86 ? C.amber : (rand(i + 19) > .92 ? C.cyan : C.ivory));
  const s = .32 + rand(i + 43) * .68, j = i * 3;
  starColors[j] = tmpColor.r * s; starColors[j + 1] = tmpColor.g * s; starColors[j + 2] = tmpColor.b * s;
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(starNow, 3));
starGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: .06, vertexColors: true, transparent: true, opacity: .84, sizeAttenuation: true, depthWrite: false }));
scene.add(stars);
let starTarget = morphs.sphere;

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.18, 4), new THREE.MeshBasicMaterial({ color: C.amber, wireframe: true, transparent: true, opacity: .35 }));
const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.amber, transparent: true, opacity: .68, depthWrite: false }));
coreGlow.scale.set(6.8, 6.8, 1);
root.add(core, coreGlow);

function orbit(radius, tiltX, tiltZ, color = C.amber, opacity = .15) {
  const curve = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2);
  const pts = curve.getPoints(220).map(p => new THREE.Vector3(p.x, 0, p.y));
  const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
  line.rotation.x = tiltX; line.rotation.z = tiltZ; orbitalRoot.add(line); return line;
}
[2.1, 3.05, 4.25, 5.6, 7.2].forEach((r, i) => orbit(r, Math.PI / 2 + (i - 2) * .055, (i - 2) * .11, i === 3 ? C.cyan : C.amber, .065 + i * .018));
orbit(5.0, .9, .38, C.rust, .12); orbit(6.4, 1.08, -.6, C.cyan, .095);

const NODE_DATA = [
  { id: 'exohspec', title: 'EXOhSPEC', kicker: 'Instrumentation', text: 'Closed-loop thermal and adaptive-optics stabilisation for a high-resolution precision-RV spectrograph.', kind: 'instrument', p: [-5.4, 2.3, -.5], c: C.amber, url: '#instrumentation' },
  { id: 'control', title: 'Feedback Control', kicker: 'Control systems', text: 'State-machine control, TEC response, AO correction and environmental stability.', kind: 'instrument', p: [-3.1, -1.7, 1.4], c: C.amber, url: '#instrumentation' },
  { id: 'wasp121', title: 'WASP-121 b', kicker: 'Exoplanet atmosphere', text: 'Ultra-hot Jupiter phase-curve research with a pronounced day-night thermal contrast.', kind: 'planet', p: [4.8, 2.45, -1], c: C.cyan, graphSlug: 'wasp-121b-exoplanet-report' },
  { id: 'wasp107', title: 'WASP-107 b', kicker: 'Exoplanet atmosphere', text: 'Warm-Neptune atmospheric analysis using JWST-era archival data.', kind: 'planet', p: [6.0, -.3, 1.2], c: C.cyan, graphSlug: 'wasp-107b-exoplanet-report' },
  { id: 'hd189', title: 'HD 189733 b', kicker: 'Transmission spectrum', text: 'Cobalt-blue hot Jupiter research focused on transmission spectroscopy and atmospheric haze.', kind: 'planet', p: [3.55, -2.65, .1], c: C.cyan, graphSlug: 'hd189733b-exoplanet-report' },
  { id: 'k218', title: 'K2-18 b', kicker: 'Temperate sub-Neptune', text: 'Atmospheric evidence and interpretation for a temperate sub-Neptune.', kind: 'planet', p: [1.7, 3.8, 1.6], c: C.cyan, graphSlug: 'k2-18b-exoplanet-report' },
  { id: 'detection', title: 'Detection Methods', kicker: 'Algorithms', text: 'Transit photometry, radial velocity, microlensing and direct-imaging explainers backed by quantitative code.', kind: 'software', p: [-1.0, 4.8, -1.7], c: C.rust },
  { id: 'aether', title: 'AETHER', kicker: 'Computational visual laboratory', text: 'Interactive Three.js particle, shader, mathematical and astrophysical visual experiments.', kind: 'software', p: [1.2, -4.5, -1.2], c: C.rust },
  { id: 'github', title: 'Research Software', kicker: 'Open source', text: 'Analysis scripts, reproducible reports, scientific web tools and control-system code.', kind: 'software', p: [-5.1, -3.2, -1.4], c: C.rust, url: 'https://github.com/Biswajit1999' },
  { id: 'papers', title: 'Publications & Research', kicker: 'Research output', text: 'Technical writing, papers, preprints, posters and long-form research documentation.', kind: 'paper', p: [5.4, -3.8, -2.5], c: C.green, url: '#research' }
];

const nodes = [], pickables = [], labels = [];
function makeLabel(d, group, className = '') {
  if (!labelLayer) return null;
  const el = document.createElement('button');
  el.type = 'button'; el.className = `world-label ${className}`.trim();
  el.innerHTML = `<span>${d.kicker || d.kind || 'Research'}</span><b>${d.title || d.label}</b>`;
  el.dataset.kind = d.kind || 'graph';
  el.addEventListener('click', () => focusObject(group, d));
  labelLayer.appendChild(el);
  labels.push({ el, object: group, data: d });
  return el;
}

for (const d of NODE_DATA) {
  const g = new THREE.Group(); g.position.set(...d.p); g.userData = d;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: d.c, transparent: true, opacity: .88, depthWrite: false })); halo.scale.set(.86, .86, 1); g.add(halo);
  const m = new THREE.Mesh(new THREE.SphereGeometry(.12, 18, 14), new THREE.MeshBasicMaterial({ color: d.c })); m.userData = { ...d, group: g }; g.add(m);
  g.userData.pick = m; nodeRoot.add(g); nodes.push(g); pickables.push(m); makeLabel(d, g);
}

function makeCurvePath(a, b, color, phase) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const mid = va.clone().lerp(vb, .5).add(new THREE.Vector3(0, 1.1 + Math.abs(vb.x - va.x) * .09, 0));
  const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .085, depthWrite: false }));
  nodeRoot.add(line);
  const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: .7, depthWrite: false }));
  pulse.scale.set(.24, .24, 1); pathRoot.add(pulse);
  return { curve, pulse, phase };
}
const pulses = NODE_DATA.map((d, i) => makeCurvePath([0, 0, 0], d.p, d.c, i / NODE_DATA.length));

function edgeBox(size, position, color = C.amber, rot = [0, 0, 0]) {
  const mesh = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), new THREE.LineBasicMaterial({ color, transparent: true, opacity: .38 }));
  mesh.position.set(...position); mesh.rotation.set(...rot); instrumentRoot.add(mesh); return mesh;
}
const benchY = -2.1, benchZ = -1.1;
const bench = new THREE.Mesh(new THREE.BoxGeometry(15.8, .12, 5.3), new THREE.MeshBasicMaterial({ color: 0x5b3b22, transparent: true, opacity: .13, wireframe: true }));
bench.position.set(-1.6, benchY - .55, benchZ); instrumentRoot.add(bench);
edgeBox([1.0, .9, 1.0], [-8.1, benchY, benchZ], C.amber);
edgeBox([.35, 2.0, 2.0], [-5.6, benchY, benchZ], C.cyan, [0, .28, 0]);
edgeBox([1.3, 2.3, .35], [-2.9, benchY, benchZ], C.amber, [0, -.48, .14]);
edgeBox([.8, 2.1, .8], [.1, benchY, benchZ], C.rust, [.2, .4, .4]);
edgeBox([1.6, 1.6, .35], [3.2, benchY, benchZ], C.cyan, [0, -.18, 0]);
edgeBox([.28, 2.3, 2.8], [6.1, benchY, benchZ], C.green, [0, -.02, 0]);
const opticalPts = [[-8.6, benchY, benchZ], [-5.8, benchY, benchZ], [-3.15, benchY + .25, benchZ], [.1, benchY - .15, benchZ], [3.2, benchY + .1, benchZ], [6.0, benchY, benchZ]];
const beamCurve = new THREE.CatmullRomCurve3(opticalPts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', .3);
const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(beamCurve.getPoints(100)), new THREE.LineBasicMaterial({ color: C.amber, transparent: true, opacity: .8 })); instrumentRoot.add(beam);
const beamPulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.cyan, transparent: true, opacity: .9, depthWrite: false })); beamPulse.scale.set(.42, .42, 1); instrumentRoot.add(beamPulse);
for (let i = 0; i < 12; i++) {
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? C.cyan : C.amber }));
  sensor.position.set(-7.5 + (i % 6) * 2.6, benchY + 1.35 + Math.floor(i / 6) * .52, benchZ + (i % 2 ? 1.6 : -1.6)); instrumentRoot.add(sensor);
}
const detectorGrid = new THREE.GridHelper(2.5, 10, C.green, 0x4e6f54); detectorGrid.rotation.z = Math.PI / 2; detectorGrid.position.set(6.25, benchY, benchZ); instrumentRoot.add(detectorGrid);
instrumentRoot.visible = false;

const graphNodes = new Map();
let graphEdges = [];
function graphColor(type) {
  return { Project: C.cyan, Instrument: C.amber, Method: C.rust, Molecule: C.green, PlanetClass: C.blue, AnalysisType: C.ivory }[type] || C.ivory;
}
async function loadResearchGraph() {
  try {
    const res = await fetch('./data/research-graph.json', { cache: 'force-cache' });
    const data = await res.json();
    const allowed = mobile ? 62 : 118;
    const projects = data.nodes.filter(n => n.type === 'Project');
    const support = data.nodes.filter(n => n.type !== 'Project');
    const selected = [...projects.slice(0, Math.min(projects.length, mobile ? 34 : 58)), ...support.slice(0, Math.max(0, allowed - Math.min(projects.length, mobile ? 34 : 58)))];
    const selectedIds = new Set(selected.map(n => n.id));
    const scale = .0145;
    selected.forEach((n, i) => {
      const g = new THREE.Group();
      const z = (rand(hashString(n.id)) - .5) * 7;
      g.position.set((n.x - 800) * scale, (550 - n.y) * scale, z);
      const color = graphColor(n.type), isProject = n.type === 'Project';
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: isProject ? .5 : .2, depthWrite: false }));
      const size = isProject ? .34 : .18; halo.scale.set(size, size, 1); g.add(halo);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(isProject ? .065 : .035, 10, 7), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isProject ? .95 : .58 }));
      const d = { id: n.id, title: n.label, kicker: n.type, kind: n.type === 'Project' ? 'planet' : 'graph', text: n.projectType ? `${n.projectType.replaceAll('-', ' ')} · connected through the portfolio research graph.` : `Research graph node: ${n.type}.`, url: n.liveUrl || n.githubUrl || null, githubUrl: n.githubUrl || null, liveUrl: n.liveUrl || null, slug: n.slug || null, graphNode: n, group: g };
      dot.userData = d; g.userData = d; g.add(dot); graphRoot.add(g); graphNodes.set(n.id, g);
      if (isProject) pickables.push(dot);
      if (isProject && i < (mobile ? 8 : 14)) makeLabel(d, g, 'graph-label');
    });
    const edgeMatCache = new Map();
    const edgeSubset = data.edges.filter(e => selectedIds.has(e.source) && selectedIds.has(e.target)).slice(0, mobile ? 90 : 210);
    edgeSubset.forEach((e, i) => {
      const a = graphNodes.get(e.source), b = graphNodes.get(e.target); if (!a || !b) return;
      const color = e.relation === 'USES_INSTRUMENT' ? C.amber : e.relation === 'REPORTS_DETECTION' ? C.green : C.cyan;
      let mat = edgeMatCache.get(color); if (!mat) { mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .055, depthWrite: false }); edgeMatCache.set(color, mat); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a.position, b.position]), mat); graphRoot.add(line);
      if (i % 13 === 0) graphEdges.push({ a, b, phase: rand(i + 8), color });
    });
    graphRoot.position.set(1.5, .2, -4.5); graphRoot.scale.setScalar(.82); graphRoot.visible = false;
    NODE_DATA.forEach(d => {
      if (!d.graphSlug) return;
      const project = projects.find(p => p.slug === d.graphSlug); if (project) { d.url = project.liveUrl || project.githubUrl; d.githubUrl = project.githubUrl; }
    });
    if (graphStatus) graphStatus.textContent = `${data.nodeCount} nodes · ${data.edgeCount} relationships · live portfolio graph`;
  } catch (err) {
    console.warn('Research graph unavailable', err);
    if (graphStatus) graphStatus.textContent = 'Research graph fallback active';
  }
}
loadResearchGraph();

const sceneEls = qsa('[data-scene]');
const CAM = {
  hero: { p: [0, 2.6, 19], t: [0, 0, 0], morph: 'sphere' },
  universe: { p: [8.8, 5.5, 16], t: [0, .4, 0], morph: 'sphere' },
  instrumentation: { p: [-10.8, .2, 10.8], t: [-1.6, -2.0, -1.0], morph: 'instrument' },
  exoplanets: { p: [10.8, 5.1, 10.5], t: [2.8, .2, -1.5], morph: 'disk' },
  software: { p: [-10.8, 5.0, 13], t: [-1, -.3, -1], morph: 'software' },
  research: { p: [3.0, 8.8, 16], t: [0, 0, 0], morph: 'timeline' },
  contact: { p: [0, .4, 22], t: [0, 0, 0], morph: 'sphere' }
};
let reduced = reduceMedia.matches;
const camPos = new THREE.Vector3(...CAM.hero.p), camTarget = new THREE.Vector3(...CAM.hero.t);
const desiredPos = camPos.clone(), desiredTarget = camTarget.clone();
let activeScene = 'hero', focused = null, hovered = null;
let mouseOrbitX = 0, mouseOrbitY = 0, dragYaw = 0, dragPitch = 0, dragging = false, dragLast = { x: 0, y: 0 };
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(10, 10);
raycaster.params.Points.threshold = .18;

function updateSceneVisuals(name) {
  starTarget = morphs[CAM[name].morph] || morphs.sphere;
  instrumentRoot.visible = name === 'instrumentation';
  graphRoot.visible = name === 'universe' || name === 'exoplanets' || name === 'software';
  orbitalRoot.visible = name !== 'instrumentation' && name !== 'software';
  pathRoot.visible = name === 'hero' || name === 'universe' || name === 'exoplanets';
  document.body.dataset.scene = name;
}
function setScene(name, force = false) {
  if (!CAM[name] || (!force && name === activeScene) || focused) return;
  activeScene = name; desiredPos.set(...CAM[name].p); desiredTarget.set(...CAM[name].t); updateSceneVisuals(name);
}
function updateScroll() {
  if (!focused) {
    let best = sceneEls[0], bestD = 1e9; const mid = innerHeight * .5;
    for (const el of sceneEls) { const r = el.getBoundingClientRect(), d = Math.abs((r.top + r.height * .5) - mid); if (d < bestD) { bestD = d; best = el; } }
    setScene(best.dataset.scene);
  }
  const h = document.documentElement.scrollHeight - innerHeight;
  qs('#progress-bar').style.width = (h ? scrollY / h * 100 : 0) + '%';
  qs('.topbar').classList.toggle('scrolled', scrollY > 20);
}
addEventListener('scroll', updateScroll, { passive: true }); updateScroll();

function resolveWorldPosition(group) { const v = new THREE.Vector3(); group.getWorldPosition(v); return v; }
function focusObject(group, d) {
  if (!group) return;
  focused = { group, data: d };
  const world = resolveWorldPosition(group);
  const outward = world.clone().normalize(); if (!Number.isFinite(outward.x) || outward.lengthSq() < .01) outward.set(0, 0, 1);
  desiredTarget.copy(world);
  desiredPos.copy(world.clone().add(outward.multiplyScalar(4.8)).add(new THREE.Vector3(0, 1.15, 2.4)));
  showPanel(d);
}
function showPanel(d) {
  nodePanel.hidden = false;
  qs('#node-kicker').textContent = d.kicker || d.kind || 'Research node';
  qs('#node-title').textContent = d.title || d.label || 'Research';
  qs('#node-text').textContent = d.text || 'Connected project in the research graph.';
  const url = d.url || d.liveUrl || d.githubUrl;
  nodeLink.hidden = !url;
  if (url) { nodeLink.href = url; nodeLink.target = url.startsWith('#') ? '' : '_blank'; nodeLink.rel = url.startsWith('#') ? '' : 'noopener'; nodeLink.textContent = d.liveUrl ? 'Open live project ↗' : d.githubUrl ? 'Open repository ↗' : 'Explore section ↗'; }
}
function clearFocus() {
  nodePanel.hidden = true; focused = null;
  desiredPos.set(...CAM[activeScene].p); desiredTarget.set(...CAM[activeScene].t); updateSceneVisuals(activeScene);
}
qs('#node-close').addEventListener('click', clearFocus);
qsa('[data-focus]').forEach(b => b.addEventListener('click', () => {
  const d = NODE_DATA.find(n => n.id === b.dataset.focus), n = nodes.find(n => n.userData.id === b.dataset.focus); if (d && n) focusObject(n, d);
}));

function setPointer(e) { pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1; }
function onPointerMove(e) {
  setPointer(e); mouseOrbitX = e.clientX / innerWidth - .5; mouseOrbitY = e.clientY / innerHeight - .5;
  if (dragging && !reduced) { dragYaw += (e.clientX - dragLast.x) * .0028; dragPitch += (e.clientY - dragLast.y) * .0018; dragPitch = THREE.MathUtils.clamp(dragPitch, -.24, .24); dragLast = { x: e.clientX, y: e.clientY }; }
}
addEventListener('pointermove', onPointerMove, { passive: true });
canvas.addEventListener('pointerdown', e => { dragging = true; dragLast = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
canvas.addEventListener('pointerup', e => { dragging = false; canvas.releasePointerCapture?.(e.pointerId); });
canvas.addEventListener('pointercancel', () => dragging = false);
canvas.addEventListener('dblclick', clearFocus);
canvas.addEventListener('click', e => {
  setPointer(e); raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length) { const d = hits[0].object.userData; focusObject(d.group || hits[0].object.parent, d); }
});

const motionBtn = qs('#motion-toggle');
function applyMotion() { document.body.classList.toggle('reduced-motion', reduced); motionBtn.setAttribute('aria-pressed', String(reduced)); motionBtn.textContent = reduced ? 'Enable motion' : 'Reduce motion'; }
motionBtn.addEventListener('click', () => { reduced = !reduced; applyMotion(); }); reduceMedia.addEventListener('change', e => { reduced = e.matches; applyMotion(); }); applyMotion();

function resize() { renderer.setSize(innerWidth, innerHeight, false); renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.3 : 1.75)); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize, { passive: true });

function updateLabels() {
  const w = innerWidth, h = innerHeight;
  for (const l of labels) {
    if (!l.object.visible || !l.object.parent?.visible) { l.el.classList.remove('visible'); continue; }
    const v = resolveWorldPosition(l.object).project(camera);
    const inView = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
    const sceneAllows = activeScene === 'hero' || activeScene === 'universe' || activeScene === 'exoplanets' || (l.data.id === focused?.data?.id);
    l.el.classList.toggle('visible', inView && sceneAllows && !reduced);
    if (inView) l.el.style.transform = `translate3d(${(v.x * .5 + .5) * w}px,${(-v.y * .5 + .5) * h}px,0) translate(-50%,-50%)`;
  }
}

const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime(), posAttr = starGeometry.attributes.position;
  const morphEase = reduced ? .08 : .032;
  for (let i = 0; i < starNow.length; i++) starNow[i] += (starTarget[i] - starNow[i]) * morphEase;
  posAttr.needsUpdate = true;

  const ease = reduced ? .14 : .045;
  camPos.lerp(desiredPos, ease); camTarget.lerp(desiredTarget, ease); camera.position.copy(camPos);
  if (!reduced && !focused) { camera.position.x += mouseOrbitX * .34; camera.position.y -= mouseOrbitY * .20; }
  camera.lookAt(camTarget);

  if (!reduced) {
    root.rotation.y = Math.sin(t * .11) * .038 + dragYaw;
    root.rotation.x = dragPitch;
    orbitalRoot.rotation.y = t * .018;
    core.rotation.x = t * .08; core.rotation.y = t * .13;
    stars.rotation.y = t * .0023;
  }
  nodes.forEach((n, i) => {
    const isFocused = focused?.data?.id === n.userData.id, isHover = hovered?.userData?.id === n.userData.id;
    const base = isFocused ? 2.0 : isHover ? 1.45 : 1;
    n.scale.lerp(new THREE.Vector3(base, base, base), .09);
    if (!reduced) n.position.y = NODE_DATA[i].p[1] + Math.sin(t * .55 + i) * .08;
  });
  coreGlow.material.opacity = .55 + Math.sin(t * 1.4) * .08;
  pulses.forEach(p => { const f = (t * .065 + p.phase) % 1; p.pulse.position.copy(p.curve.getPoint(f)); p.pulse.material.opacity = .26 + Math.sin(f * Math.PI) * .6; });
  if (instrumentRoot.visible) beamPulse.position.copy(beamCurve.getPoint((t * .11) % 1));

  if (!reduced) {
    raycaster.setFromCamera(pointer, camera); const hits = raycaster.intersectObjects(pickables, false); hovered = hits[0]?.object || null; canvas.style.cursor = hits.length ? 'pointer' : dragging ? 'grabbing' : 'grab';
  }
  updateLabels();
  renderer.render(scene, camera); requestAnimationFrame(animate);
}
animate();
