# Biswajit Research Universe

An immersive Three.js research portfolio for **Biswajit Jana**, built around astrophysics, astronomical instrumentation, exoplanets, precision spectroscopy, feedback control and scientific computing.

> Standalone successor concept to the existing academic portfolio. The original live site remains preserved on `main`; this branch contains the new cinematic 3D experience.

## Experience

The website treats the portfolio as a connected research system instead of a conventional stack of project cards. A persistent WebGL scene evolves as the visitor scrolls through the page:

- **Identity / Research Core** — a GPU-rendered stellar field, orbital geometry and a central research core.
- **Research Universe** — interactive project nodes connected by scientific themes.
- **EXOhSPEC** — camera movement into an instrumentation/control-system region with stability telemetry and optical/control geometry.
- **Exoplanets** — the camera moves through atmosphere-analysis nodes for targets including WASP-121 b, WASP-107 b, HD 189733 b and K2-18 b.
- **Scientific Software** — the constellation is presented as a computational research network.
- **Research Trajectory** — engineering, astrophysics and precision instrumentation are shown as a coherent research path.
- **Contact** — the scene pulls back to reveal the complete system.

## Interaction

The current version includes:

- scroll-driven camera choreography across seven scene states;
- pointer parallax and orbit motion;
- clickable Three.js research nodes with contextual project panels;
- GPU star field and glow sprites;
- multiple orbital planes and constellation links;
- conceptual EXOhSPEC instrument geometry;
- responsive layouts for desktop/mobile;
- reduced-motion support and a manual motion control;
- semantic HTML beneath the WebGL layer so the portfolio remains readable and indexable.

## Design language

The visual system deliberately retains the warm **spectral-instrument** identity of the existing portfolio instead of using a generic blue sci-fi dashboard. Amber/brass represents the research core and instrumentation, cyan identifies exoplanet science, rust identifies computational work, and restrained green is used for research/output state.

## Stack

- HTML5
- CSS3
- JavaScript ES modules
- Three.js
- GitHub Pages compatible — no build step required

## Structure

```text
index.html             semantic portfolio / scroll scenes
universe.css           visual system, responsive layout and HUD components
research-universe.js   Three.js scene, nodes, raycasting and camera choreography
```

## Development branch

This work is currently isolated on `research-universe-v2` so the existing portfolio on `main` remains unchanged. The intended standalone repository name is:

**`biswajit-research-universe`**

## Author

**Biswajit Jana**  
Astrophysics · Astronomical Instrumentation · Scientific Computing
