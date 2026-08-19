# Biswajit Research Universe

An immersive 3D successor to my academic portfolio, built around astrophysics, precision astronomical instrumentation, exoplanet research, control systems, and scientific computing.

> Development branch: `research-universe-v2`  
> Intended standalone repository: `biswajit-research-universe`

## Design principle

This project does not replace research content with visual effects. Semantic HTML remains the readable portfolio layer; Three.js progressively enhances it with a spatial research map, camera choreography, particle morphing, and graph-backed interactions.

## Current experience

- GPU particle field with adaptive desktop/mobile density
- scroll-driven camera choreography across seven research scenes
- pointer parallax plus click-drag orbital control
- particle topology morphs: cosmic field → optical path → orbital disk → computational lattice → timeline
- interactive research nodes with raycast selection and camera fly-to
- floating screen-space labels anchored to 3D project positions
- animated information pulses along research connections
- EXOhSPEC optical-bench scene with input/fibre, steering element, dispersive optics, camera optics, detector, sensor nodes, and animated beam propagation
- real portfolio graph integration from `data/research-graph.json`
- project links resolved from graph metadata where available
- responsive layouts and reduced-motion support
- static GitHub Pages compatibility; no build step required

## Real research graph

The visualization reads the existing generated portfolio graph at runtime. The source graph currently contains project, instrument, method, molecule, planet-class, and analysis-type nodes connected by curated evidence relationships.

The WebGL layer samples that graph for performance while the underlying data remains the source of truth.

## Scene map

1. **Identity / Hero** — compact research cosmos
2. **Research Universe** — connected portfolio graph
3. **EXOhSPEC** — optical/instrumentation architecture
4. **Exoplanets** — orbital research system
5. **Scientific Software** — computational lattice
6. **Research trajectory** — chronological particle topology
7. **Contact** — resolved wide-field closing state

## Core files

- `index.html` — semantic portfolio narrative and interface layer
- `universe.css` — base visual system
- `universe-v2.css` — cinematic/3D interaction presentation layer
- `research-universe.js` — Three.js scene, morphing, camera choreography, raycasting, project focus, graph integration
- `data/research-graph.json` — generated portfolio knowledge graph

## Interaction

- **Scroll** — travel between research scenes
- **Pointer move** — restrained parallax
- **Click + drag** — orbit the research universe
- **Click a node/label** — fly the camera to the selected research object
- **Double-click the 3D background** — return from project focus
- **Reduce motion** — disable non-essential movement

## Preservation

The existing live portfolio on `main` is intentionally preserved. This development branch is isolated and should not be merged into the existing live site unless the successor experience is deliberately chosen to replace it.

## Author

**Biswajit Jana**  
Astrophysics · Astronomical Instrumentation · Exoplanets · Scientific Computing
