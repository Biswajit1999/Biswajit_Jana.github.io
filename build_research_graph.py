#!/usr/bin/env python3
"""
Deterministically builds data/research-graph.json from data/full-portfolio.json.

No external graph-mining tool, no LLM call at build time, no runtime API call
from the browser: every node and edge here is derived directly from the same
manifest the Atlas page already uses, so there is exactly one source of truth
for facts about these repositories. Every edge carries provenance back to the
repo it came from. Nothing is inferred from a title, topic, or thumbnail —
only from the researched `instruments`/`category`/`planet_class`/`molecules`/
`methods`/`evidence_status` fields already fact-checked when the manifest was
built.

Positions are computed once, here, at build time (a small pure-Python
spring-repulsion layout) and baked into the JSON. The browser never runs a
physics simulation — it just draws the precomputed graph. That's cheaper and
more predictable than shipping a force-directed layout engine to the client.

Run after editing data/full-portfolio.json:

    python build_research_graph.py
"""
import json
import math
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "full-portfolio.json"
OUT_PATH = ROOT / "data" / "research-graph.json"

# Real instrument/mission/survey names worth graphing as their own node,
# distinguished from generic software tech (Python, JavaScript, React, ...).
MIN_FREQ_METHOD = 2   # only graph a method/technique if >=2 repos share it
MIN_FREQ_MOLECULE = 1


import re

# canonical label -> regex patterns (matched case-insensitively against the raw string,
# stripped of any trailing citation/parenthetical) that should collapse to it
INSTRUMENT_ALIASES = [
    ("JWST/NIRISS", [r"jwst.*niriss"]),
    ("JWST/NIRSpec", [r"jwst.*nirspec"]),
    ("JWST/MIRI", [r"jwst.*miri"]),
    ("JWST/NIRCam", [r"jwst.*nircam"]),
    ("JWST", [r"^jwst$"]),
    ("TESS", [r"^tess\b"]),
    ("HST/ACS-WFC", [r"hst.*acs.?wfc", r"^acs.?wfc"]),
    ("HST/STIS", [r"hst.*stis", r"^stis"]),
    ("HST/WFC3", [r"hst.*wfc3", r"^wfc3"]),
    ("HST", [r"^hst$", r"^hubble"]),
    ("Spitzer", [r"^spitzer"]),
    ("Kepler", [r"^kepler"]),
    ("HARPS-N", [r"harps-n"]),
    ("GIANO-B", [r"giano-b"]),
    ("HARPS", [r"^harps\b"]),
    ("CARMENES", [r"^carmenes"]),
    ("ESPRESSO", [r"^espresso"]),
    ("Keck/HIRES", [r"keck.*hires"]),
    ("Keck", [r"^keck$"]),
    ("Gemini North", [r"gemini"]),
    ("Gaia", [r"^gaia"]),
    ("DESI", [r"^desi"]),
    ("2MRS", [r"^2mrs"]),
    ("NANOGrav", [r"nanograv"]),
    ("GWOSC / LIGO-Virgo", [r"gwosc", r"^ligo", r"^virgo"]),
    ("OGLE", [r"^ogle"]),
    ("MOA", [r"^moa\b"]),
    ("KMTNet", [r"^kmtnet"]),
    ("Roman Space Telescope", [r"roman space"]),
    ("SDSS", [r"^sdss", r"sdss_access", r"^boss$"]),
]

_INSTRUMENT_COMPILED = [(label, [re.compile(p) for p in pats]) for label, pats in INSTRUMENT_ALIASES]


def norm_instrument(raw):
    cleaned = re.sub(r"\s*\(.*?\)\s*", "", raw).strip().lower()
    cleaned = re.sub(r"\s*/\s*boss$", "", cleaned)  # "SDSS / BOSS" -> "sdss"
    if not cleaned:
        return None
    for label, patterns in _INSTRUMENT_COMPILED:
        if any(p.search(cleaned) for p in patterns):
            return label
    return None


def load_projects():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def build_graph(projects):
    nodes = {}   # id -> node dict
    edges = []

    def add_node(node_id, node_type, label, **extra):
        if node_id not in nodes:
            nodes[node_id] = {"id": node_id, "type": node_type, "label": label, **extra}
        return node_id

    method_counts = Counter()
    molecule_counts = Counter()
    for p in projects:
        for m in p.get("methods", []):
            method_counts[m] += 1
        for m in p.get("molecules", []):
            molecule_counts[m] += 1

    for p in projects:
        pid = "project:" + p["slug"]
        add_node(pid, "Project", p["title"], projectType=p["type"], slug=p["slug"],
                  githubUrl=p["github_url"], liveUrl=p.get("live_report_url"))

        # ANALYZES / BELONGS_TO_CLASS — exoplanet target + planet class
        if p.get("planet_class"):
            cls_id = "class:" + p["planet_class"]
            add_node(cls_id, "PlanetClass", p["planet_class"])
            edges.append({
                "source": pid, "target": cls_id, "relation": "BELONGS_TO_CLASS",
                "evidenceLevel": "published", "relationStatus": "curated",
                "sourceRepo": p["slug"], "sourceUrl": p["github_url"],
            })

        # HAS_SPECTRUM_TYPE / analysis category
        if p.get("category"):
            cat_id = "category:" + p["category"]
            add_node(cat_id, "AnalysisType", p["category"])
            edges.append({
                "source": pid, "target": cat_id, "relation": "HAS_SPECTRUM_TYPE",
                "evidenceLevel": "reproduced", "relationStatus": "curated",
                "sourceRepo": p["slug"], "sourceUrl": p["github_url"],
            })

        # USES_INSTRUMENT — from tech_or_instruments, filtered to real instrument names
        seen_instr = set()
        for raw in p.get("tech_or_instruments", []):
            label = norm_instrument(raw)
            if not label or label in seen_instr:
                continue
            seen_instr.add(label)
            instr_id = "instrument:" + label
            add_node(instr_id, "Instrument", label)
            edges.append({
                "source": pid, "target": instr_id, "relation": "USES_INSTRUMENT",
                "evidenceLevel": "reproduced", "relationStatus": "curated",
                "sourceRepo": p["slug"], "sourceUrl": p["github_url"],
            })

        # USES_METHOD — only methods shared across >=2 repos, to avoid one-off islands
        for m in p.get("methods", []):
            if method_counts[m] < MIN_FREQ_METHOD:
                continue
            method_id = "method:" + m
            add_node(method_id, "Method", m)
            edges.append({
                "source": pid, "target": method_id, "relation": "USES_METHOD",
                "evidenceLevel": "reproduced", "relationStatus": "curated",
                "sourceRepo": p["slug"], "sourceUrl": p["github_url"],
            })

        # REPORTS_DETECTION / CITES_AS_CONTEXT / REPORTS_NO_EVIDENCE — molecules
        note = (p.get("evidence_status_note") or "")
        is_literature_only = "literature-context-only" in note or "literature citation" in note.lower()
        for mol in p.get("molecules", []):
            mol_id = "molecule:" + mol
            add_node(mol_id, "Molecule", mol)
            if p.get("evidence_status") == "null-or-mixed-result":
                relation = "REPORTS_NO_EVIDENCE"
                level = "no-evidence"
            elif is_literature_only:
                relation = "CITES_AS_CONTEXT"
                level = "contextual"
            else:
                relation = "REPORTS_DETECTION"
                level = "published"
            edges.append({
                "source": pid, "target": mol_id, "relation": relation,
                "evidenceLevel": level, "relationStatus": "curated",
                "sourceRepo": p["slug"], "sourceUrl": p["github_url"],
                "note": note[:220] if note else None,
            })

    return list(nodes.values()), edges


def layout(nodes, edges, iterations=250, width=1600, height=1100):
    """A minimal pure-Python spring-repulsion (Fruchterman-Reingold style) layout.
    Deterministic seed so rebuilds don't jitter the graph for no reason."""
    rnd = random.Random(42)
    pos = {n["id"]: [rnd.uniform(0, width), rnd.uniform(0, height)] for n in nodes}
    ids = list(pos.keys())
    n = len(ids)
    if n == 0:
        return pos
    area = width * height
    k = math.sqrt(area / n) * 0.9

    adj = {i: [] for i in ids}
    for e in edges:
        if e["source"] in adj and e["target"] in adj:
            adj[e["source"]].append(e["target"])
            adj[e["target"]].append(e["source"])

    for it in range(iterations):
        temp = width * 0.06 * (1 - it / iterations)
        disp = {i: [0.0, 0.0] for i in ids}

        # repulsion (all pairs is fine at this node count for a build-time script)
        for i in range(n):
            xi, yi = pos[ids[i]]
            for j in range(i + 1, n):
                xj, yj = pos[ids[j]]
                dx, dy = xi - xj, yi - yj
                dist = math.hypot(dx, dy) or 0.01
                force = (k * k) / dist
                fx, fy = dx / dist * force, dy / dist * force
                disp[ids[i]][0] += fx; disp[ids[i]][1] += fy
                disp[ids[j]][0] -= fx; disp[ids[j]][1] -= fy

        # attraction along edges
        for e in edges:
            s, t = e["source"], e["target"]
            if s not in pos or t not in pos:
                continue
            dx, dy = pos[s][0] - pos[t][0], pos[s][1] - pos[t][1]
            dist = math.hypot(dx, dy) or 0.01
            force = (dist * dist) / k
            fx, fy = dx / dist * force, dy / dist * force
            disp[s][0] -= fx; disp[s][1] -= fy
            disp[t][0] += fx; disp[t][1] += fy

        for i in ids:
            dx, dy = disp[i]
            dist = math.hypot(dx, dy) or 0.01
            capped = min(dist, temp)
            pos[i][0] += dx / dist * capped
            pos[i][1] += dy / dist * capped
            pos[i][0] = min(width, max(0, pos[i][0]))
            pos[i][1] = min(height, max(0, pos[i][1]))

    return pos


def build():
    projects = load_projects()
    nodes, edges = build_graph(projects)
    positions = layout(nodes, edges)
    for node in nodes:
        x, y = positions[node["id"]]
        node["x"] = round(x, 1)
        node["y"] = round(y, 1)

    node_ids = {n["id"] for n in nodes}
    orphans = node_ids - set(e["source"] for e in edges) - set(e["target"] for e in edges)
    orphans -= {n["id"] for n in nodes if n["type"] == "Project"}  # projects can't be orphans by construction
    edges = [e for e in edges if e["source"] in node_ids and e["target"] in node_ids]

    doc = {
        "generatedFrom": "data/full-portfolio.json",
        "nodeCount": len(nodes),
        "edgeCount": len(edges),
        "nodeTypes": sorted(set(n["type"] for n in nodes)),
        "edgeTypes": sorted(set(e["relation"] for e in edges)),
        "nodes": nodes,
        "edges": edges,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)

    print(f"Wrote {OUT_PATH}")
    print(f"Nodes: {len(nodes)} | Edges: {len(edges)}")
    print("By node type:", dict(Counter(n["type"] for n in nodes)))
    print("By edge type:", dict(Counter(e["relation"] for e in edges)))
    if orphans:
        print(f"WARNING: {len(orphans)} orphan non-project nodes (no edges): {sorted(orphans)[:10]}")


if __name__ == "__main__":
    build()
