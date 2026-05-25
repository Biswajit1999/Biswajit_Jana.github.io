(() => {
  const $ = (id) => document.getElementById(id);
  const controls = {
    period: $('period'),
    inclination: $('inclination'),
    observer: $('observer'),
    mass: $('mass'),
    radius: $('radius')
  };
  const labels = {
    period: $('periodValue'),
    inclination: $('inclinationValue'),
    observer: $('observerValue'),
    mass: $('massValue'),
    radius: $('radiusValue')
  };
  const metrics = {
    freq: $('freqMetric'),
    lc: $('lcMetric'),
    compact: $('compactMetric'),
    density: $('densityMetric'),
    preset: $('presetLabel'),
    visible: $('visibleLabel'),
    caption: $('simCaption')
  };

  const canvas = $('pulsarCanvas');
  const signalCanvas = $('signalCanvas');
  const storyButton = $('storyMode');
  if (!canvas || !signalCanvas || !storyButton) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  const sig = signalCanvas.getContext('2d', { alpha: false });
  const surfaceCanvas = document.createElement('canvas');
  const surfaceCtx = surfaceCanvas.getContext('2d', { willReadFrequently: true });
  const start = performance.now();
  let storyMode = true;

  injectCrabNebulaFigure();
  moveCaptionOutsideStage();

  const presets = {
    birth: { label: 'Preset: young neutron star', caption: 'Surface mode: procedural hot crust granulation, polar cap heating, compact plasma spurs, and stronger 3D limb shading.', period: 0.28, inclination: 42, observer: 55, mass: 1.42, radius: 12.2 },
    lighthouse: { label: 'Preset: lighthouse geometry', caption: 'Cleaner beam mode: fewer internal bands, a brighter lighthouse core, and slightly brighter magnetic field arcs for context.', period: 0.80, inclination: 68, observer: 64, mass: 1.40, radius: 12.0 },
    nebula: { label: 'Preset: Crab-like pulsar wind', caption: 'Crab section: the simulation keeps the beam dominant while the nebula image below shows the real pulsar-powered remnant.', period: 0.09, inclination: 58, observer: 50, mass: 1.55, radius: 11.5 },
    clock: { label: 'Preset: millisecond clock', caption: 'Millisecond mode: rapid spin, narrow pulses, compact hot crust, and a bright forward beam when geometry aligns.', period: 0.035, inclination: 34, observer: 38, mass: 1.65, radius: 12.4 },
    pta: { label: 'Preset: timing-array reference', caption: 'Timing-array mode: a repeatable pulse profile from a stable millisecond pulsar clock.', period: 0.012, inclination: 48, observer: 47, mass: 1.45, radius: 12.0 }
  };

  const stars = Array.from({ length: 300 }, (_, i) => ({
    x: fract(Math.sin(i * 12.9898) * 43758.5453),
    y: fract(Math.sin(i * 78.233) * 24634.6345),
    r: 0.25 + fract(Math.sin(i * 38.17) * 19341.14) * 1.65,
    a: 0.10 + fract(Math.sin(i * 91.7) * 7821.31) * 0.80,
    warm: fract(Math.sin(i * 48.57) * 2811.71) > 0.86
  }));

  function injectCrabNebulaFigure() {
    if (document.getElementById('crab-nebula-figure')) return;
    const style = document.createElement('style');
    style.textContent = `
      .astro-figure{margin:24px 0;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:rgba(255,255,255,.035)}
      .astro-figure img{display:block;width:100%;max-height:560px;object-fit:cover;background:#030813}
      .astro-figure figcaption{padding:13px 15px;color:var(--muted);font-size:.86rem;line-height:1.55;border-top:1px solid var(--line)}
      .astro-figure figcaption b{color:var(--cyan);font-family:var(--mono);font-size:.72rem;text-transform:uppercase;letter-spacing:.12em}
    `;
    document.head.appendChild(style);

    const nebulae = document.getElementById('nebulae');
    if (nebulae) {
      const fig = document.createElement('figure');
      fig.className = 'astro-figure';
      fig.id = 'crab-nebula-figure';
      fig.innerHTML = `
        <a href="https://esahubble.org/images/heic0515a/" target="_blank" rel="noopener">
          <img src="https://cdn.esahubble.org/archives/images/screen/heic0515a.jpg" alt="Hubble image of the Crab Nebula, a pulsar wind nebula powered by the central Crab pulsar" loading="lazy">
        </a>
        <figcaption><b>Crab Nebula reference image.</b> The Crab Nebula is the classic pulsar wind nebula: a supernova remnant powered by the central Crab pulsar. Credit: NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble).</figcaption>
      `;
      const secondPara = nebulae.querySelector('p:nth-of-type(2)');
      if (secondPara) secondPara.insertAdjacentElement('afterend', fig);
      else nebulae.appendChild(fig);
    }

    const refs = document.querySelector('#references ol');
    if (refs && !document.getElementById('ref-crab-hubble')) {
      const li = document.createElement('li');
      li.id = 'ref-crab-hubble';
      li.innerHTML = `NASA, ESA, Loll, A., Hester, J. and De Martin, D. (2005) ‘Most detailed image of the Crab Nebula’. ESA/Hubble. Available at: <a href="https://esahubble.org/images/heic0515a/" target="_blank" rel="noopener">https://esahubble.org/images/heic0515a/</a>.`;
      refs.insertBefore(li, refs.firstChild);
    }
  }

  function moveCaptionOutsideStage() {
    const stage = canvas.closest('.stage');
    if (stage && metrics.caption && metrics.caption.parentElement === stage) {
      stage.insertAdjacentElement('afterend', metrics.caption);
    }
    if (metrics.caption) {
      Object.assign(metrics.caption.style, {
        position: 'static', maxWidth: 'none', margin: '12px 14px 0', borderRadius: '14px',
        background: 'rgba(3,8,18,.72)', color: '#b5c2da', pointerEvents: 'none'
      });
    }
  }

  function fract(x) { return x - Math.floor(x); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function angleLerp(a, b, t) { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; }
  function hash3(x, y, z) { return fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123); }
  function noise3(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const fx = x - ix, fy = y - iy, fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
    const n000 = hash3(ix, iy, iz), n100 = hash3(ix + 1, iy, iz), n010 = hash3(ix, iy + 1, iz), n110 = hash3(ix + 1, iy + 1, iz);
    const n001 = hash3(ix, iy, iz + 1), n101 = hash3(ix + 1, iy, iz + 1), n011 = hash3(ix, iy + 1, iz + 1), n111 = hash3(ix + 1, iy + 1, iz + 1);
    const x00 = n000 * (1 - ux) + n100 * ux, x10 = n010 * (1 - ux) + n110 * ux, x01 = n001 * (1 - ux) + n101 * ux, x11 = n011 * (1 - ux) + n111 * ux;
    return (x00 * (1 - uy) + x10 * uy) * (1 - uz) + (x01 * (1 - uy) + x11 * uy) * uz;
  }
  function fbm3(x, y, z) { let v = 0, a = .52, f = 1; for (let i = 0; i < 5; i++) { v += a * noise3(x * f, y * f, z * f); f *= 2.05; a *= .50; } return v; }

  function normalize(v) { const n = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / n, y: v.y / n, z: v.z / n }; }
  function cross(a, b) { return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }; }
  function scaleV(v, k) { return { x: v.x * k, y: v.y * k, z: v.z * k }; }
  function addV(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
  function makeBasis(axis) { const w = normalize(axis); const reference = Math.abs(w.y) > .85 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }; const u = normalize(cross(reference, w)); const v = normalize(cross(w, u)); return { u, v, w }; }
  function localToWorld(p, basis) { return addV(addV(scaleV(basis.u, p.x), scaleV(basis.w, p.y)), scaleV(basis.v, p.z)); }
  function rotateX(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c }; }
  function rotateY(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c }; }
  function rotateZ(p, a) { const c = Math.cos(a), s = Math.sin(a); return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z }; }
  function cameraTransform(p) { return rotateY(rotateX(rotateZ(p, -0.10), -0.62), 0.42); }
  function projectPoint(p, cx, cy, scale) { const q = 4.8 / (4.8 + p.z); return { x: cx + p.x * scale * q, y: cy - p.y * scale * q, z: p.z, q }; }

  function state() {
    const P = parseFloat(controls.period.value), inc = parseFloat(controls.inclination.value), obs = parseFloat(controls.observer.value), mass = parseFloat(controls.mass.value), radius = parseFloat(controls.radius.value);
    const freq = 1 / P, lcKm = 299792.458 * P / (2 * Math.PI), compact = 1.4766 * mass / radius;
    const density = (3 * mass * 1.98847e30) / (4 * Math.PI * Math.pow(radius * 1000, 3));
    return { P, inc, obs, mass, radius, freq, lcKm, compact, density };
  }
  function updateLabels() {
    const s = state();
    labels.period.textContent = s.P < .1 ? `${(s.P * 1000).toFixed(0)} ms` : `${s.P.toFixed(2)} s`;
    labels.inclination.textContent = `${s.inc.toFixed(0)}°`; labels.observer.textContent = `${s.obs.toFixed(0)}°`; labels.mass.textContent = `${s.mass.toFixed(2)} M☉`; labels.radius.textContent = `${s.radius.toFixed(1)} km`;
    metrics.freq.textContent = s.freq > 100 ? `${s.freq.toFixed(1)} Hz` : `${s.freq.toFixed(2)} Hz`; metrics.lc.textContent = s.lcKm > 1000 ? `${Math.round(s.lcKm).toLocaleString()} km` : `${s.lcKm.toFixed(0)} km`;
    metrics.compact.textContent = s.compact.toFixed(3); metrics.density.textContent = `${(s.density / 1e17).toFixed(2)}×10¹⁷ kg m⁻³`;
  }
  function setStoryMode(on) { storyMode = on; storyButton.classList.toggle('active', storyMode); storyButton.textContent = storyMode ? 'Story mode on' : 'Manual mode'; storyButton.setAttribute('aria-pressed', String(storyMode)); }
  storyButton.addEventListener('click', () => setStoryMode(!storyMode));
  Object.values(controls).forEach((control) => control.addEventListener('input', () => { setStoryMode(false); updateLabels(); }));
  function applyPreset(name) { const p = presets[name]; if (!p || !storyMode) return; ['period', 'inclination', 'observer', 'mass', 'radius'].forEach((k) => controls[k].value = p[k]); metrics.preset.textContent = p.label; metrics.caption.textContent = p.caption; updateLabels(); }

  const presetObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) applyPreset(entry.target.dataset.preset); }), { threshold: 0.45, rootMargin: '-10% 0px -45% 0px' });
  document.querySelectorAll('[data-preset]').forEach((section) => presetObserver.observe(section));
  const revealObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  function resizeCanvas(canvasEl) { const rect = canvasEl.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = Math.max(1, Math.floor(rect.width * dpr)); const h = Math.max(1, Math.floor(rect.height * dpr)); if (canvasEl.width !== w || canvasEl.height !== h) { canvasEl.width = w; canvasEl.height = h; } return { w, h, dpr }; }
  function beamSeparationDeg(phase, incDeg, obsDeg) { const a = incDeg * Math.PI / 180, z = obsDeg * Math.PI / 180; const c = Math.sin(a) * Math.sin(z) * Math.cos(phase) + Math.cos(a) * Math.cos(z); return Math.acos(clamp(c, -1, 1)) * 180 / Math.PI; }
  function pulseIntensity(phase, s) { const width = 5.5 + (90 - s.inc) * .036; const d1 = beamSeparationDeg(phase, s.inc, s.obs), d2 = beamSeparationDeg(phase + Math.PI, s.inc, s.obs); return Math.max(Math.exp(-.5 * (d1 / width) ** 2), .42 * Math.exp(-.5 * (d2 / width) ** 2)); }
  function observerScreenAngle(s) { const obs = s.obs * Math.PI / 180; const v = normalize({ x: Math.sin(obs), y: Math.cos(obs), z: .18 }); const p = projectPoint(cameraTransform(v), 0, 0, 1); return Math.atan2(-p.y, p.x); }

  function drawBackground(w, h, time) {
    ctx.fillStyle = '#020713'; ctx.fillRect(0, 0, w, h);
    const r = Math.min(w, h); const g = ctx.createRadialGradient(w * .45, h * .5, r * .04, w * .55, h * .48, r * .82);
    g.addColorStop(0, 'rgba(36,120,190,.14)'); g.addColorStop(.38, 'rgba(25,75,155,.050)'); g.addColorStop(.68, 'rgba(105,35,160,.024)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (const st of stars) { const t = .60 + .40 * Math.sin(time * .9 + st.x * 19); ctx.fillStyle = st.warm ? `rgba(255,220,180,${st.a * t})` : `rgba(185,225,255,${st.a * t})`; ctx.beginPath(); ctx.arc(st.x * w, st.y * h, st.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawEyeIcon(x, y, size, glow) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y); ctx.strokeStyle = `rgba(255,224,145,${.62 + glow * .34})`; ctx.lineWidth = Math.max(1.2, size * .12); ctx.shadowColor = 'rgba(255,211,107,.45)'; ctx.shadowBlur = size * (.25 + glow * .35);
    ctx.beginPath(); ctx.moveTo(-size, 0); ctx.quadraticCurveTo(0, -size * .62, size, 0); ctx.quadraticCurveTo(0, size * .62, -size, 0); ctx.stroke();
    ctx.fillStyle = `rgba(255,235,170,${.55 + glow * .35})`; ctx.beginPath(); ctx.arc(0, 0, size * .26, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = 'rgba(10,20,35,.75)'; ctx.beginPath(); ctx.arc(0, 0, size * .11, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function drawObserverSightline(cx, cy, scale, s, phase) {
    const angle = observerScreenAngle(s), sep = beamSeparationDeg(phase, s.inc, s.obs), near = smoothstep(24, 2, sep), len = scale * .64;
    const x1 = cx + Math.cos(angle) * scale * .23, y1 = cy + Math.sin(angle) * scale * .23, x2 = cx + Math.cos(angle) * len, y2 = cy + Math.sin(angle) * len;
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.setLineDash([7, 8]); ctx.strokeStyle = `rgba(255,211,107,${.18 + near * .46})`; ctx.lineWidth = Math.max(1, scale * .0021); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); drawEyeIcon(x2, y2, scale * (.018 + near * .006), near); return { angle, near, sep };
  }

  function drawDipoleField(cx, cy, scale, basis, phase, compactBoost) {
    const shells = [.72, 1.03, 1.42, 1.86, 2.28], azimuths = [.15, 1.05, 1.95, 2.85, 3.75, 4.65, 5.55], lines = [];
    for (const shell of shells) for (const az0 of azimuths) {
      const az = az0 + phase * .050, points = [];
      for (let i = 0; i <= 118; i++) { const theta = .25 + (Math.PI - .50) * i / 118, r = shell * Math.sin(theta) ** 2; const p = { x: r * Math.sin(theta) * Math.cos(az), y: r * Math.cos(theta), z: r * Math.sin(theta) * Math.sin(az) }; points.push(projectPoint(cameraTransform(localToWorld(p, basis)), cx, cy, scale * .205)); }
      lines.push({ depth: points.reduce((a, b) => a + b.z, 0) / points.length, points });
    }
    lines.sort((a, b) => a.depth - b.depth); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.shadowColor = 'rgba(65,205,255,.18)'; ctx.shadowBlur = scale * .0022;
    for (const line of lines) { const mid = line.points[Math.floor(line.points.length / 2)]; ctx.beginPath(); line.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = `rgba(72,218,255,${(.024 + .062 * mid.q + compactBoost * .018).toFixed(3)})`; ctx.lineWidth = Math.max(.58, mid.q * .70); ctx.stroke(); }
    ctx.restore();
  }

  function drawMovingFieldParticles(cx, cy, scale, basis, time, compactBoost) {
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 280; i++) { const shell = .78 + fract(Math.sin(i * 31.7) * 8101.4) * 1.82, az = fract(Math.sin(i * 17.2) * 9104.7) * Math.PI * 2, u = fract(fract(Math.sin(i * 72.1) * 4567.1) + time * (.014 + .010 * fract(i * .37))); const theta = .25 + (Math.PI - .50) * u, r = shell * Math.sin(theta) ** 2; const pLocal = { x: r * Math.sin(theta) * Math.cos(az + time * .06), y: r * Math.cos(theta), z: r * Math.sin(theta) * Math.sin(az + time * .06) }; const p = projectPoint(cameraTransform(localToWorld(pLocal, basis)), cx, cy, scale * .205); const nearPole = (1 - Math.sin(theta)) ** 2, a = .055 + nearPole * .28 + compactBoost * .06, rad = Math.max(.42, scale * (.0010 + nearPole * .0012)); ctx.fillStyle = `rgba(105,240,255,${a.toFixed(3)})`; ctx.beginPath(); ctx.arc(p.x, p.y, rad * p.q, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawVolumetricBeam(cx, cy, angle, length, width, rgb, alpha, crossing, reverse = false) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle); ctx.globalCompositeOperation = 'screen';
    const flare = 1 + crossing * .65;
    const layers = [
      { w: 2.20, a: .105, blur: .30 },
      { w: 1.18, a: .190, blur: .22 },
      { w: .42, a: .580, blur: .16 }
    ];
    for (const layer of layers) {
      const layerWidth = width * layer.w * flare;
      const grad = ctx.createLinearGradient(0, 0, length, 0);
      grad.addColorStop(0, `rgba(255,255,255,${Math.min(1, alpha * layer.a * 1.6)})`);
      grad.addColorStop(.18, `rgba(${rgb},${Math.min(1, alpha * layer.a * 2.0)})`);
      grad.addColorStop(.62, `rgba(${rgb},${alpha * layer.a * .72})`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grad; ctx.shadowColor = `rgba(${rgb},.72)`; ctx.shadowBlur = width * layer.blur;
      ctx.beginPath(); ctx.moveTo(0, -layerWidth * .12); ctx.bezierCurveTo(length * .25, -layerWidth * .38, length * .62, -layerWidth * .54, length, -layerWidth * .62); ctx.lineTo(length, layerWidth * .62); ctx.bezierCurveTo(length * .62, layerWidth * .54, length * .25, layerWidth * .38, 0, layerWidth * .12); ctx.closePath(); ctx.fill();
    }
    const core = ctx.createLinearGradient(0, 0, length, 0); core.addColorStop(0, `rgba(255,255,255,${Math.min(1, alpha * 1.55)})`); core.addColorStop(.15, `rgba(${rgb},${Math.min(1, alpha * 1.2)})`); core.addColorStop(.70, `rgba(${rgb},${alpha * .34})`); core.addColorStop(1, `rgba(${rgb},0)`); ctx.strokeStyle = core; ctx.lineWidth = Math.max(2.4, width * (reverse ? .038 : .070) * flare); ctx.shadowBlur = width * .28 * flare; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(length, reverse ? width * .12 : -width * .16); ctx.stroke(); ctx.restore();
  }

  function drawForwardObserverFlare(cx, cy, scale, crossing) { if (crossing < .08) return; ctx.save(); ctx.globalCompositeOperation = 'screen'; const glare = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * (.20 + crossing * .06)); glare.addColorStop(0, `rgba(255,255,255,${.28 * crossing})`); glare.addColorStop(.25, `rgba(95,245,255,${.18 * crossing})`); glare.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = glare; ctx.beginPath(); ctx.arc(cx, cy, scale * (.20 + crossing * .06), 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

  function shadeNeutronSurface(cx, cy, R, phase, compactBoost, beamAngle) {
    const res = 230; if (surfaceCanvas.width !== res) { surfaceCanvas.width = res; surfaceCanvas.height = res; }
    const img = surfaceCtx.createImageData(res, res), data = img.data, light = normalize({ x: -.35, y: -.45, z: .82 }); const c = Math.cos(phase * .55), ss = Math.sin(phase * .55), capX = Math.cos(beamAngle), capY = Math.sin(beamAngle);
    for (let py = 0; py < res; py++) { const y = (py / (res - 1)) * 2 - 1; for (let px = 0; px < res; px++) { const x = (px / (res - 1)) * 2 - 1, rr = x * x + y * y, idx = (py * res + px) * 4; if (rr > 1) { data[idx + 3] = 0; continue; } const z = Math.sqrt(1 - rr), sx = x * c + z * ss, sz = -x * ss + z * c, sy = y; const lon = Math.atan2(sz, sx), lat = Math.asin(sy); const n1 = fbm3(sx * 3.8 + phase * .020, sy * 3.8, sz * 3.8), n2 = fbm3(sx * 13.2 - phase * .050, sy * 13.2 + phase * .035, sz * 13.2), n3 = fbm3(sx * 35 + 2, sy * 35 - phase * .11, sz * 35 + phase * .08); const cellular = Math.abs(Math.sin(24 * lon + 18 * lat + 4 * n2 + phase * .18)); const granular = clamp(.15 * n1 + .42 * n2 + .34 * n3 + .09 * cellular, 0, 1), brightGran = smoothstep(.54, .92, granular), fissures = clamp(smoothstep(.982, .999, Math.abs(Math.sin(7 * lon + 11 * lat + n1 * 5))) * .35 + smoothstep(.989, .999, Math.abs(Math.sin(15 * lon - 9 * lat + n2 * 4))) * .55, 0, 1); const dotLight = clamp(x * light.x + y * light.y + z * light.z, 0, 1), limb = z ** .58, rim = (1 - z) ** 2.4, spec = dotLight ** 22 * .50; const cap1 = Math.exp(-(((x - capX * .48) ** 2) / .030 + ((y - capY * .48) ** 2) / .018)), cap2 = Math.exp(-(((x + capX * .48) ** 2) / .035 + ((y + capY * .48) ** 2) / .022)), polarHeat = clamp(cap1 * .90 + cap2 * .36, 0, 1); const shade = .24 + .92 * limb, crust = .22 + .78 * granular, veinDark = 1 - fissures * .26; let r = (5 + 24 * crust + brightGran * 38 + polarHeat * 170 + spec * 140) * shade * veinDark + rim * 10, g = (18 + 74 * crust + brightGran * 112 + polarHeat * 210 + spec * 160 + fissures * 45) * shade * veinDark + rim * (44 + compactBoost * 30), b = (72 + 126 * crust + brightGran * 128 + polarHeat * 185 + spec * 185 + fissures * 65) * shade + rim * (130 + compactBoost * 70); data[idx] = clamp(r, 0, 255); data[idx + 1] = clamp(g, 0, 255); data[idx + 2] = clamp(b, 0, 255); data[idx + 3] = 255; } }
    surfaceCtx.putImageData(img, 0, 0); ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(surfaceCanvas, cx - R, cy - R, R * 2, R * 2); ctx.restore();
  }

  function drawSurfaceSpurs(cx, cy, R, beamAngle, phase, crossing) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; [beamAngle, beamAngle + Math.PI].forEach((base, pole) => { const count = pole ? 8 : 16; for (let i = 0; i < count; i++) { const a = base + (fract(Math.sin(i * 8.23 + pole) * 2331.7) - .5) * .72, len = R * (.34 + fract(Math.sin(i * 17.7) * 833.1) * .72) * (pole ? .58 : 1), sr = R * (.70 + fract(Math.sin(i * 23.1) * 431.4) * .16); const x0 = cx + Math.cos(a) * sr, y0 = cy + Math.sin(a) * sr, x1 = cx + Math.cos(a) * (sr + len), y1 = cy + Math.sin(a) * (sr + len), alpha = (.095 + crossing * .17) * (pole ? .50 : 1); const grad = ctx.createLinearGradient(x0, y0, x1, y1); grad.addColorStop(0, `rgba(255,255,255,${alpha * .55})`); grad.addColorStop(.24, `rgba(100,245,255,${alpha})`); grad.addColorStop(1, 'rgba(100,245,255,0)'); ctx.strokeStyle = grad; ctx.lineWidth = Math.max(.7, R * (.009 + crossing * .005)); ctx.shadowColor = 'rgba(97,247,255,.38)'; ctx.shadowBlur = R * .08; ctx.beginPath(); ctx.moveTo(x0, y0); const bend = Math.sin(phase * .35 + i) * R * .10; ctx.quadraticCurveTo((x0 + x1) / 2 - Math.sin(a) * bend, (y0 + y1) / 2 + Math.cos(a) * bend, x1, y1); ctx.stroke(); } }); ctx.restore();
  }
  function drawNeutronStar(cx, cy, scale, phase, s, compactBoost, beamAngle, crossing) {
    const R = scale * (.062 + ((s.mass - 1) / 1.3) * .010 + ((s.radius - 9) / 7) * .007); ctx.save(); ctx.globalCompositeOperation = 'screen'; const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (3.7 + compactBoost)); halo.addColorStop(0, 'rgba(255,255,255,.62)'); halo.addColorStop(.14, `rgba(175,255,255,${.52 + compactBoost * .10})`); halo.addColorStop(.34, `rgba(80,225,255,${.25 + compactBoost * .08})`); halo.addColorStop(.70, `rgba(70,110,255,${.08 + compactBoost * .05})`); halo.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, R * (3.7 + compactBoost), 0, Math.PI * 2); ctx.fill(); ctx.restore(); shadeNeutronSurface(cx, cy, R, phase, compactBoost, beamAngle); drawSurfaceSpurs(cx, cy, R, beamAngle, phase, crossing); ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = `rgba(230,255,255,${.28 + compactBoost * .12})`; ctx.lineWidth = Math.max(1, R * .030); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  function drawSpinAndMagneticAxes(cx, cy, scale, axisScreen) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = 'rgba(255,211,107,.18)'; ctx.lineWidth = Math.max(1, scale * .0016); ctx.beginPath(); ctx.moveTo(cx, cy - scale * .16); ctx.lineTo(cx, cy + scale * .16); ctx.stroke(); ctx.strokeStyle = 'rgba(255,120,216,.24)'; ctx.beginPath(); ctx.moveTo(cx - axisScreen.x * scale * .18, cy - axisScreen.y * scale * .18); ctx.lineTo(cx + axisScreen.x * scale * .18, cy + axisScreen.y * scale * .18); ctx.stroke(); ctx.restore(); }

  function drawPulsar(now) {
    const { w, h } = resizeCanvas(canvas), s = state(), time = (now - start) / 1000, scale = Math.min(w, h), cx = w * .48, cy = h * .50, displayFreq = Math.min(2.8, Math.max(.18, s.freq * .22)), phase = time * displayFreq * Math.PI * 2, inc = s.inc * Math.PI / 180, compactBoost = clamp((s.compact - .12) / .20, 0, 1);
    const magnetic = normalize({ x: Math.sin(inc) * Math.cos(phase), y: Math.cos(inc), z: Math.sin(inc) * Math.sin(phase) }), basis = makeBasis(magnetic), projectedAxis = projectPoint(cameraTransform(magnetic), 0, 0, 1), physicalBeamAngle = Math.atan2(-projectedAxis.y, projectedAxis.x), beamTowardCamera = clamp((cameraTransform(magnetic).z + 1) / 2, 0, 1), I = pulseIntensity(phase, s);
    drawBackground(w, h, time); drawDipoleField(cx, cy, scale, basis, phase, compactBoost); drawMovingFieldParticles(cx, cy, scale, basis, time, compactBoost); const observer = drawObserverSightline(cx, cy, scale, s, phase);
    const apparentBeamAngle = angleLerp(physicalBeamAngle, observer.angle, I * .58), counterAngle = apparentBeamAngle + Math.PI, mainAlpha = .60 + .22 * beamTowardCamera + .42 * I, counterAlpha = .10 + .07 * (1 - beamTowardCamera) + .05 * I;
    drawVolumetricBeam(cx, cy, apparentBeamAngle, scale * (1.16 + .08 * I), scale * .205, '86,235,255', mainAlpha, I, false); drawVolumetricBeam(cx, cy, counterAngle, scale * .88, scale * .105, '162,88,245', counterAlpha, I * .35, true); drawForwardObserverFlare(cx, cy, scale, I); drawSpinAndMagneticAxes(cx, cy, scale, { x: Math.cos(physicalBeamAngle), y: Math.sin(physicalBeamAngle) }); drawNeutronStar(cx, cy, scale, phase, s, compactBoost, physicalBeamAngle, I);
    metrics.visible.textContent = I > .45 ? 'Beam crossing: visible pulse' : I > .12 ? 'Beam crossing: grazing' : 'Beam crossing: missed';
  }

  function drawSignal(now) {
    const { w, h } = resizeCanvas(signalCanvas), s = state(), time = (now - start) / 1000; sig.clearRect(0, 0, w, h); sig.fillStyle = '#040b18'; sig.fillRect(0, 0, w, h); sig.strokeStyle = 'rgba(255,255,255,.055)'; sig.lineWidth = 1; for (let i = 1; i < 7; i++) { const y = h * i / 7; sig.beginPath(); sig.moveTo(0, y); sig.lineTo(w, y); sig.stroke(); } for (let i = 1; i < 10; i++) { const x = w * i / 10; sig.beginPath(); sig.moveTo(x, 0); sig.lineTo(x, h); sig.stroke(); } sig.strokeStyle = 'rgba(97,247,255,.98)'; sig.shadowColor = 'rgba(97,247,255,.32)'; sig.shadowBlur = 8; sig.lineWidth = Math.max(2, w * .0022); sig.beginPath(); for (let x = 0; x < w; x++) { const u = x / w, ph = (u * 6 + time * Math.min(s.freq, 14) * .08) * Math.PI * 2, pulse = pulseIntensity(ph, s), baseline = .020 * Math.sin(u * 26 + time * .7), y = h * (.76 - Math.min(1, pulse + baseline) * .62); if (x === 0) sig.moveTo(x, y); else sig.lineTo(x, y); } sig.stroke(); sig.shadowBlur = 0; sig.fillStyle = 'rgba(181,196,218,.9)'; sig.font = `${Math.max(11, w * .018)}px JetBrains Mono, monospace`; sig.fillText(`LIVE RADIO PROFILE | P = ${s.P < .1 ? (s.P * 1000).toFixed(0) + ' ms' : s.P.toFixed(2) + ' s'} | visibility = ${metrics.visible.textContent.replace('Beam crossing: ', '')}`, 16, 26);
  }
  function loop(now) { drawPulsar(now); drawSignal(now); requestAnimationFrame(loop); }
  updateLabels(); applyPreset('birth'); requestAnimationFrame(loop); window.addEventListener('resize', updateLabels);
})();
