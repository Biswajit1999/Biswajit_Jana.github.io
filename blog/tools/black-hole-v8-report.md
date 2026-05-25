# Relativistic Black Hole Raytracer v8 — Technical Report

**Author:** Biswajit Jana  
**Project:** [biswajit1999.github.io/blog/tools/black-hole-v8.html](https://biswajit1999.github.io/blog/tools/black-hole-v8.html)  
**Stack:** WebGL 1 · Three.js · GLSL · Vanilla JavaScript  
**Date:** May 2026

---

## 1. Overview

This document describes the physics, mathematics, and engineering decisions behind a fully browser-based relativistic black hole raytracer. The simulator renders a spinning Kerr black hole with a physically motivated accretion disk in real time, running entirely on the GPU as a WebGL fragment shader. No server, no compute backend — the physics runs on the visitor's graphics card at 30–60 fps.

The project was built iteratively: each version corrected either a physical approximation or a visual artifact, progressing from a basic Schwarzschild sketch to a near-cinematic Kerr raytracer with Novikov-Thorne thermodynamics, Dormand-Prince integration, and a full tidal disruption event sequence.

---

## 2. Coordinate System and Units

All ray-tracing is done in **Schwarzschild radius units** where $r_s = 1$. In general relativity, the Schwarzschild radius is:

$$r_s = \frac{2GM}{c^2}$$

For a black hole of mass $M$, the conversion to physical units is $r_s \approx 2.953 \text{ km} \times (M/M_\odot)$. In the simulator, $r = 1$ means one Schwarzschild radius from the singularity. The event horizon sits at $r = 1$, the photon sphere at $r = 1.5$, and the innermost stable circular orbit (ISCO) depends on spin.

The relationship between Schwarzschild units and gravitational mass $M$ (in natural units $G = c = 1$) is:

$$r_s = 2M \quad \Longrightarrow \quad r_M = \frac{r}{2}$$

This conversion appears throughout the code whenever a formula requires $M$-units (e.g., Keplerian velocity, ISCO calculation).

---

## 3. Light Ray Propagation — The Binet Equation

### 3.1 Null Geodesics in Schwarzschild Spacetime

Light follows null geodesics. In the Schwarzschild metric, the path of a photon can be reduced to a single ordinary differential equation using the substitution $u = 1/r$. This is the **Binet equation** for null rays:

$$\frac{d^2u}{d\phi^2} = -u + \frac{3M}{c^2} u^2 = -u + \frac{3}{2} u^2$$

where $\phi$ is the azimuthal angle swept by the photon and the last equality uses $2M = 1$ (our units). The term $-u$ is the flat-space behaviour; $\frac{3}{2}u^2$ is the general-relativistic correction that causes photon bending and photon-sphere capture.

### 3.2 Kerr Correction (Frame-Dragging)

For a spinning black hole with dimensionless spin parameter $a = J/M_{\max}$, frame-dragging adds an additional coupling. The simulator approximates this in the Binet equation as:

$$\frac{d^2u}{d\phi^2} = -u + \left(\frac{3}{2} + 0.10 \cdot a\right) u^2$$

The $0.10a$ term tilts the effective photon-sphere radius and introduces the asymmetric lensing pattern visible at high spin. This is a perturbative Kerr correction; the full Boyer-Lindquist treatment would require a coupled system of four ODEs, which is not practical in a real-time fragment shader.

In GLSL:

```glsl
float binetF(float u, float spin) {
    return -u + (1.5 + spin * 0.10) * u * u;
}
```

### 3.3 Initial Conditions

For a ray starting at camera position $\mathbf{p}_0$ (radius $r_0$) with direction $\hat{d}$, the impact parameter is:

$$b = |\mathbf{p}_0 \times \hat{d}|$$

The initial $u_0 = 1/r_0$ and the initial derivative:

$$u'_0 = \pm\sqrt{\frac{1}{b^2} - u_0^2(1 - u_0)}$$

The sign is positive if the ray is initially moving inward (toward the BH) and negative if moving outward. Rays with $b < b_{\text{crit}} = 3\sqrt{3}/2 \approx 2.598$ (in $M$-units) are captured by the black hole regardless of initial direction.

---

## 4. Numerical Integration — Dormand-Prince RK4(5)

### 4.1 Why Adaptive Integration?

The original implementation used a fixed-step 4th-order Runge-Kutta integrator. The problem: near the photon sphere ($r \approx 1.5 r_s$), geodesics curve sharply and a large step size introduces significant numerical error. Far from the black hole, in nearly flat space, the same small step size wastes computation doing nothing.

The solution is an **adaptive step-size integrator** that takes small steps where curvature is high and large steps in flat space.

### 4.2 Dormand-Prince (DOPRI5) Scheme

The Dormand-Prince method is a 6-stage, 5th-order explicit Runge-Kutta method. It uses the 6 stage evaluations to produce both a 4th-order and a 5th-order estimate; the difference is the error. In this implementation, only the 5th-order update is used (local extrapolation), while the adaptive step size is driven by a curvature proxy rather than a formal error estimate (to avoid the cost of two separate outputs per step in a GPU shader).

The 6 Butcher tableau stages for state $(u, u') = (u, \dot{u})$:

$$k_1 = f(u_n), \quad k_2 = f\!\left(u_n + \tfrac{h}{5}k_1\right), \quad \ldots$$

with Dormand-Prince coefficients. The 5th-order update:

$$u_{n+1} = u_n + h\left(\frac{35}{384}k_1 + \frac{500}{1113}k_3 + \frac{125}{192}k_4 - \frac{2187}{6784}k_5 + \frac{11}{84}k_6\right)$$

### 4.3 Curvature-Adaptive Step Size

Rather than tracking the formal error estimate (expensive on GPU), the step size is controlled by a **proximity function**:

$$d\phi = \text{clamp}\!\left(\frac{d\phi_{\text{base}}}{(3.8u)^2 + 0.4|u'| + 0.35 + 4.0 \cdot \delta_{\text{disk}}},\ 0.04\, d\phi_{\text{base}},\ 2.5\, d\phi_{\text{base}}\right)$$

where:
- $u = 1/r$ — large near the BH, forcing small steps
- $|u'|$ — large when the ray is plunging steeply, also forcing small steps
- $d\phi_{\text{base}} = \phi_{\text{target}} / N_{\text{steps}}$ — the base step from the "Steps" slider
- $\delta_{\text{disk}} = \text{smoothstep}(0.35r, 0, |y_{\text{prev}}|)$ — the **disk-plane proximity penalty** described in Section 7.1

The step budget terminates at $\phi_{\text{acc}} \geq \phi_{\text{target}}$ (exact arc budget), not at a loop iteration count.

---

## 5. The Accretion Disk — Novikov-Thorne Physics

### 5.1 ISCO — Innermost Stable Circular Orbit

Matter can only orbit stably outside the ISCO. Inside, it spirals inward rapidly. For a Kerr black hole the ISCO radius in $M$-units is:

$$r_{\text{ISCO}} = 3 + Z_2 - \text{sgn}(a)\sqrt{(3 - Z_1)(3 + Z_1 + 2Z_2)}$$

$$Z_1 = 1 + (1-a^2)^{1/3}\!\left[(1+a)^{1/3} + (1-a)^{1/3}\right]$$

$$Z_2 = \sqrt{3a^2 + Z_1^2}$$

For a Schwarzschild black hole ($a = 0$): $r_{\text{ISCO}} = 6M = 3r_s$.  
For a maximally spinning Kerr ($a \to 1$): $r_{\text{ISCO}} \to 1M = 0.5r_s$.

### 5.2 Novikov-Thorne Temperature Profile

The Novikov-Thorne (1973) solution to the relativistic thin-disk equations gives the local radiative flux as:

$$F(r) \propto \frac{\dot{M}}{r^3} \cdot \mathcal{NT}(r)$$

where the zero-torque factor is:

$$\mathcal{NT}(r) = 1 - \sqrt{\frac{r_{\text{ISCO}}}{r}}$$

This function is exactly zero at the ISCO (no emission from the plunge region), peaks at $r \approx 2.25\, r_{\text{ISCO}}$, and declines as $r^{-3/4}$ at large radii. Because $F \propto T^4$ by Stefan-Boltzmann, the temperature profile is:

$$T(r) \propto \left(\frac{\mathcal{NT}(r)}{r^3}\right)^{1/4}$$

Critically, this function is **strictly monotonic with no oscillation** — no sine-wave banding is physically motivated. Earlier simulator versions used `sin(r × 3.1)` as a fake ring modulator; the NT profile replaces this entirely.

In GLSL, normalised to $[0,1]$:

```glsl
float rr      = max(r / isco, 1.0002);
float NT      = max(1.0 - 1.0 / sqrt(rr), 0.0);
float NT_ramp = smoothstep(0.0, 0.18, NT);          // smooth ISCO onset
float t_phys  = NT_ramp * pow(max(NT / (rr*rr*rr), 0.0), 0.25);
float t_rad   = clamp(t_phys * 2.8, 0.0, 1.0);
```

### 5.3 Novikov-Thorne Surface Density

The surface density of the disk follows:

$$\Sigma(r) \propto \frac{\mathcal{NT}(r)}{(r/r_{\text{ISCO}})^{3/4}}$$

This peaks at $r \approx 2.78\, r_{\text{ISCO}}$ and is also free of oscillation. In GLSL:

```glsl
float sigma   = NT_ramp * NT / pow(rr, 0.75);
float density = clamp(sigma / 0.20, 0.0, 1.25);
```

---

## 6. Relativistic Optics of the Disk

### 6.1 Keplerian Orbital Velocity

In the equatorial plane, the Keplerian orbital speed in the Newtonian limit (used for the velocity projection) is:

$$v_{\text{orb}} = \sqrt{\frac{M}{r_M}} = \sqrt{\frac{1}{r_M}} \quad (G = c = 1)$$

capped at $v_{\text{orb}} \leq c/\sqrt{2} \approx 0.707c$ to remain sub-relativistic. The Lorentz factor is $\gamma = (1 - v^2)^{-1/2}$.

### 6.2 Relativistic Doppler Beaming

For a disk element at azimuthal angle $\phi_{\text{az}}$, the line-of-sight component of its orbital velocity is:

$$v_{\text{los}} = v_{\text{orb}} \sin(\phi_{\text{az}})$$

The full relativistic Doppler factor (including transverse Doppler and beaming) is:

$$D = \frac{1}{\gamma(1 - v_{\text{los}})}$$

The gravitational redshift at radius $r$ in Schwarzschild geometry is:

$$g_{\text{grav}} = \sqrt{1 - \frac{1}{r}}$$

The combined photon energy ratio observed at infinity versus emitted:

$$g = D \cdot g_{\text{grav}}$$

Bolometric specific intensity transforms as (Liouville's theorem):

$$I_{\text{obs}} \propto g^4 \cdot I_{\text{em}}$$

This is what produces the dramatic brightness asymmetry: the approaching side of the disk ($v_{\text{los}} > 0$, $D > 1$) is boosted by $D^4$, making it appear $\sim 10\times$ brighter than the receding side at $v \approx 0.5c$.

### 6.3 Blackbody Colour Mapping

The observed temperature is shifted from the intrinsic temperature by the energy ratio $g$:

$$T_{\text{obs}} = T_{\text{em}} \cdot g$$

The normalised temperature parameter $t_{\text{obs}}$ is mapped to HDR linear-light RGB via a piecewise-linear approximation of the Planckian locus (the path a perfect blackbody traces through colour space from $\sim 1500$ K dark brown-red to $\sim 40000$ K hard UV blue). Key anchor points:

| $t$ | Temperature | Colour |
|-----|------------|--------|
| 0.00 | ~1500 K | dark brown-red |
| 0.14 | ~2500 K | deep red |
| 0.30 | ~3500 K | orange |
| 0.48 | ~5000 K | amber-gold |
| 0.62 | ~7000 K | warm white |
| 0.74 | ~10 000 K | pure white |
| 0.88 | ~20 000 K | blue-white |
| 1.00 | ~40 000 K | hard UV blue |

---

## 7. Rendering Pipeline

### 7.1 Disk Intersection — Sub-Step Interpolation

The disk occupies the equatorial plane ($y = 0$). During ray integration, a disk crossing is detected when the ray's height changes sign: $y_{\text{prev}} \cdot y_{\text{cur}} < 0$. A naive implementation snaps to whichever step endpoint is chosen, grouping rays into discrete angular buckets and producing radial spoke artifacts.

The fix is **sub-step linear interpolation**. Given the height at the previous step $y_{\text{prev}}$ and current step $y_{\text{cur}}$, the exact crossing fraction is:

$$t = \frac{y_{\text{prev}}}{y_{\text{prev}} - y_{\text{cur}}} \in [0, 1]$$

The exact 3D crossing position is then:

$$\mathbf{p}_{\text{hit}} = \text{mix}(\mathbf{p}_{\text{prev}},\ \mathbf{p}_{\text{cur}},\ t)$$

The exact radius and azimuth are read from $\mathbf{p}_{\text{hit}}$:

$$r_{\text{hit}} = |\mathbf{p}_{\text{hit}}|, \qquad \phi_{\text{az}} = \text{atan2}(z_{\text{hit}},\ x_{\text{hit}})$$

In GLSL:

```glsl
float t       = prevH / (prevH - h);
vec3  hitPos  = mix(prevPos, pos, t);
float r_hit   = length(hitPos);
float az_hit  = atan(hitPos.z, hitPos.x);
diskCol       = diskEmit(r_hit, az_hit, ...);
```

### 7.2 Disk-Plane Proximity Penalty

To prevent the Doppler gradient from varying too rapidly between adjacent pixels (which would cause temporal aliasing), the adaptive step-size formula includes a disk proximity term:

$$\delta_{\text{disk}} = \text{smoothstep}(0.35r,\ 0,\ |y_{\text{prev}}|)$$

This peaks at 1.0 when the ray is at the disk plane and decays over 35% of the current radius. Adding $4.0 \cdot \delta_{\text{disk}}$ to the step-size denominator forces steps up to 12× finer near the disk, pinning the crossing azimuth consistently across Temporal AA frames.

### 7.3 Kerr Angular Velocity for Noise Animation

The accretion plasma rotates. To animate the organic texture co-rotating with the disk rather than sitting static, the noise UV coordinates use the **Kerr angular velocity**:

$$\Omega_{\text{Kerr}} = \frac{1}{r_M^{3/2} + a}$$

where $r_M$ is radius in $M$-units and $a$ is the spin parameter. This correctly accounts for frame-dragging near the ISCO (where Newtonian $\Omega \approx r^{-3/2}$ deviates significantly from the Kerr value).

The noise is sampled in **logarithmic-radial + arc-length azimuthal** coordinates:

$$\mathbf{UV}_{\text{noise}} = \left(\ln\!\left(\frac{r}{r_{\text{ISCO}}}\right) \times 2.2,\ (\phi_{\text{az}} + \Omega_{\text{Kerr}} t) \cdot r \times 0.10\right)$$

Equal increments in $\ln r$ correspond to equal fractional radial steps, which is the natural scale for a differentially-rotating disk (logarithmic spirals arise naturally from differential rotation).

### 7.4 Background — ESO Milky Way Panorama

The background is the real ESO 0932a Milky Way panorama (4096 × 2048 px, captured by ESO/S. Brunier). It is loaded as a WebGL texture and sampled using standard equirectangular projection:

$$\phi_{\text{lon}} = \text{atan2}(d_z, d_x), \qquad \theta_{\text{lat}} = \arcsin(d_y)$$

$$u = \frac{\phi_{\text{lon}}}{2\pi} + 0.5, \qquad v = \frac{\theta_{\text{lat}}}{\pi} + 0.5$$

If the image fails to load (network error), the renderer falls back to a procedurally generated galaxy texture: galactic nebulae as radial canvas gradients, plus 26,000 tiny 1–2 px point stars with a realistic luminosity function.

### 7.5 Tonemapping — AGX

The disk emission is HDR (values well above 1.0 for the photon ring and Doppler-boosted region). The AGX tonemapper converts to display-referred sRGB:

$$\text{AGX}(\mathbf{v}) = \text{agxC}\!\left(\text{clamp}\!\left(\frac{\log_2(\text{compress}(\mathbf{v})) + 12.474}{16.5},\ 0,\ 1\right)\right)$$

where $\text{agxC}$ is a degree-6 polynomial approximating the AGX S-curve, and $\text{compress}$ is the AGX input matrix rotation that maps the display gamut to a $[0,1]$ log-encoded signal. This preserves saturated hue better than Reinhard and avoids the blown-out white core of simple exposure-based tonemapping.

### 7.6 Temporal Anti-Aliasing (TAA)

The raytracer uses an 8-frame Halton sequence jitter on the camera ray origin:

$$\mathbf{uv} = \mathbf{uv}_{\text{screen}} + \frac{\mathbf{j}}{(W, H)}, \qquad \mathbf{j} = (H_2(n) - 0.5,\ H_3(n) - 0.5)$$

where $H_b(n)$ is the $n$-th element of the base-$b$ Halton low-discrepancy sequence. Each frame is blended into a history buffer:

$$\mathbf{C}_{\text{out}} = \text{mix}(\mathbf{C}_{\text{cur}},\ \mathbf{C}_{\text{hist}},\ w_h \cdot \text{react})$$

$$\text{react} = \text{clamp}(1 - |\ell_{\text{cur}} - \ell_{\text{hist}}| \times 5,\ 0,\ 1)$$

The history weight $w_h$ and neighbourhood clamp width are **camera-velocity adaptive**:

$$w_h = 0.88 - 0.33 \cdot s, \qquad \text{clip} = 0.08 + 0.20 \cdot s$$

$$s = \text{min}\!\left(\frac{v_{\text{cam}}}{0.8\, r_{\text{orbit}}},\ 1\right)$$

When the camera is stationary ($s = 0$): $w_h = 0.88$, tight neighbourhood → clean accumulation over 8 frames. When orbiting ($s \to 1$): $w_h = 0.55$, wide clamp → prefer current frame, reject stale lensed history.

---

## 8. Secondary Lensed Image

Rays that orbit more than once around the black hole intersect the disk a second time, producing the characteristic bright photon ring just inside the shadow boundary. This is enabled by continuing integration past the first disk crossing:

```glsl
if(!hitDisk){
    diskCol  = diskEmit(r_hit, az_hit, ...);
    hitDisk  = true;
} else if(uSec > 0.5 && !hitSec){
    diskCol += diskEmit(r_hit, az_hit, ..., bright * 0.22);
    hitSec   = true;
}
```

The secondary image is weighted to 22% brightness to match the expected $e^{-\pi} \approx 0.04$ photon ring flux ratio in full GR, but boosted for cinematic visibility.

---

## 9. Tidal Disruption Event (TDE) Sequence

The simulator includes a scripted Tidal Disruption Event — a star falling into the black hole and being shredded, triggering AGN jets.

### 9.1 Tidal Disruption Radius

A star of mass $m_*$ and radius $R_*$ is tidally disrupted when the black hole's tidal gravity exceeds the star's self-gravity. This occurs at the **Hills radius**:

$$r_T \approx R_* \left(\frac{M_{\text{BH}}}{m_*}\right)^{1/3}$$

For a solar-type star near a $10\, M_\odot$ stellar-mass black hole, $r_T \approx 8\text{–}12\, r_s$. The simulator triggers the disruption phase when the star crosses 8 $r_s$.

### 9.2 Infall Animation

The star follows an exponential infall (a rough approximation of free-fall from large distances):

$$\frac{dr}{dt} = -k \cdot r_{\text{approach}} \cdot r, \qquad k = 0.12 \cdot v_{\text{approach}}$$

This produces acceleration as the star falls — a constant-speed orbit would be unrealistic. The approach speed slider $v_{\text{approach}}$ controls how many seconds the event takes at the current setting.

### 9.3 Phase Sequence

| Phase | Trigger | Visual |
|-------|---------|--------|
| Approach | $r > 8\, r_s$ | Blue-white star growing in angular size |
| Disrupting | $r < 8\, r_s$ | Orange tidal streamer, tidal elongation |
| Flash | $r < 2.8\, r_s$ | Brilliant white-blue disruption burst, 1.8 s duration |
| Eaten | After flash | Star sprite removed; jets auto-enable and flare $+1.4\times$ power over $\sim 25$ s |

### 9.4 AGN Jet Model

The relativistic jet is rendered as a cone aligned with the black hole's spin axis:

$$I_{\text{jet}}(\hat{d}) = \text{smoothstep}(\theta_{\text{edge}}, 0.02, \theta_d) \cdot P(t,y) \cdot j_{\text{pow}}$$

where $\theta_d = \text{atan}(r_{xz}, |d_y|)$ is the angle from the jet axis and $P(t, y) = 0.5 + 0.5\sin(3.1t + 7y)$ is a travelling-wave pulse simulating jet knot ejection.

---

## 10. Fe K-α Spectrograph

The simulator includes a real-time iron K-α line profile calculator in the UI. The broad, asymmetric Fe K-α line at 6.4 keV is a hallmark of black hole accretion and is used observationally to measure spin.

The profile is computed by integrating over the disk annuli from $r_{\text{ISCO}}$ to $400\, r_s$, weighting each annulus by emissivity $\propto r^{-3}$ and computing the observed line energy for every azimuthal angle:

$$E_{\text{obs}} = E_{\text{rest}} \cdot D \cdot g_{\text{grav}} = 6.4 \text{ keV} \cdot D \cdot \sqrt{1 - \frac{2}{r}}$$

The resulting histogram of $E_{\text{obs}}$ values, Gaussian-smoothed with $\sigma \approx 2.4$ bins, gives the characteristic double-peaked profile skewed toward lower energies by gravitational redshift and the receding disk half.

---

## 11. Artifact Resolution History

| Artifact | Root Cause | Fix Applied |
|----------|-----------|-------------|
| Fake blob stars over galaxy | `overlayStars()` called on ESO image `onload` | Removed call from `onload`; kept only in procedural fallback |
| No background galaxy | URL pointed to `.tif` (browsers can't decode TIFF) | Changed to `.jpg`; added multi-format fallback chain |
| Radial banding rings | `sin(r × 3.1)` fake ring modulator | Replaced with Novikov-Thorne Σ profile |
| Outer blade artifacts | `hitDisk=true` set in zero-emission zone → galaxy dimmed to 6% | Changed detection cutoff from `r ≤ rout` to `r ≤ 0.68 rout` |
| Blade/spoke artifacts | Fixed-step RK4 stepping unevenly across disk | Replaced with DP45 + disk-plane proximity penalty |
| TAA flickering spokes | Screen-space Halton + integrator dither double-jittering | Removed integrator dither; sub-step interpolation handles variance |
| TAA boiling when orbiting | History weight fixed at 0.88 regardless of camera motion | Camera-velocity-adaptive `histW` and `clip` |
| Segmented fan / discrete azimuths | Snap to step endpoint on disk crossing | Sub-step interpolation: `t = prevH/(prevH−h)`, `mix(prevPos,pos,t)` |
| Star not visible | `uStarShow` gated on `mode===2` (Lab only) | Removed mode gate; star renders in any mode |

---

## 12. Performance Characteristics

All computation runs in a single GLSL fragment shader per pixel. At 1920×1080 with 360 integration steps per ray:

- **Fragment invocations per frame:** ~2.1 million
- **DP45 evaluations per pixel:** up to 400 (loop limit), typically ~180 for disk rays
- **Float operations per pixel:** ~15,000–25,000 (disk rays with full NT + noise + Doppler)
- **Typical frame time:** 16–33 ms (30–60 fps) on a mid-range GPU

The adaptive step-size integrator saves roughly 40% of integration work compared to a fixed-step 400-iteration loop by taking large steps in flat space and concentrating evaluations near the photon sphere and disk plane.

---

## 13. Key References

1. **Novikov, I. D. & Thorne, K. S. (1973)** — "Astrophysics of Black Holes." In *Black Holes (Les Astres Occlus)*, eds. C. DeWitt & B. DeWitt, Gordon & Breach. [Original NT disk solution]

2. **Page, D. N. & Thorne, K. S. (1974)** — "Disk-Accretion onto a Black Hole. I. Time-Averaged Structure of Accretion Disk." *ApJ* 191, 499. [Radiative flux formula]

3. **Luminet, J.-P. (1979)** — "Image of a spherical black hole with thin accretion disk." *A&A* 75, 228. [First raytraced BH image; Binet equation method]

4. **James, O. et al. (2015)** — "Gravitational lensing by spinning black holes in astrophysics, and in the movie Interstellar." *Classical and Quantum Gravity* 32(6). [DNGR renderer; inspiration for visual style]

5. **Dormand, J. R. & Prince, P. J. (1980)** — "A family of embedded Runge-Kutta formulae." *J. Comput. Appl. Math.* 6(1), 19–26. [DOPRI5 integrator coefficients]

6. **Bardeen, J. M., Press, W. H. & Teukolsky, S. A. (1972)** — "Rotating Black Holes: Locally Nonrotating Frames, Energy Extraction, and Scalar Synchrotron Radiation." *ApJ* 178, 347. [Kerr ISCO formula]

7. **ESO/S. Brunier** — ESO 0932a Milky Way Panorama. [Background galaxy texture, used under ESO public domain licence]

---

## 14. Source Code

The complete, self-contained source is in a single HTML file:  
[`blog/tools/black-hole-v8.html`](https://github.com/Biswajit1999/Biswajit_Jana.github.io/blob/main/blog/tools/black-hole-v8.html)

Live demo: [biswajit1999.github.io/blog/tools/black-hole-v8.html](https://biswajit1999.github.io/blog/tools/black-hole-v8.html)
