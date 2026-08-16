#!/usr/bin/env python3
"""
Regenerates atlas.html from data/full-portfolio.json.

Run after editing the manifest:

    python build_atlas.py

Bakes all 85 repos into real semantic HTML (progressive enhancement: the
page works with JavaScript disabled) and computes every statistic and
chart value from the manifest itself, so nothing here drifts out of sync
by hand-editing a number.

This does not call the GitHub API. Refreshing the manifest's own facts
from GitHub is a separate step: sync_research_data.py.
"""
import json
import html
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "full-portfolio.json"
GRAPH_PATH = ROOT / "data" / "research-graph.json"
OUT_PATH = ROOT / "atlas.html"
SITE_URL = "https://biswajit1999.github.io/Biswajit_Jana.github.io"


def asset_version():
    """Cache-busting version for atlas.css/js/graph.js, based on their own mtimes so
    browsers (including GitHub Pages visitors) always fetch the current file after a
    rebuild instead of serving something stale from cache."""
    mtimes = [
        (ROOT / f).stat().st_mtime
        for f in ("atlas.css", "atlas.js", "atlas-graph.js")
        if (ROOT / f).exists()
    ]
    return str(int(max(mtimes))) if mtimes else str(int(time.time()))

GRAPH_TYPE_LABELS = {
    "Project": "Repository", "Instrument": "Instrument", "Method": "Method",
    "Molecule": "Molecule", "PlanetClass": "Planet class", "AnalysisType": "Analysis type",
}

EV_LABELS = {
    "public-data-reanalysis": "Public-data reanalysis",
    "reproduced-from-bundled-data": "Reproduced from bundled data",
    "null-or-mixed-result": "Null / mixed result",
    "algorithm-validated-on-synthetic-signal": "Validated on synthetic signal",
}

TYPE_LABELS = {
    "exoplanet-report": "Exoplanet report",
    "detection-method": "Detection method",
    "research-benchmark": "Research benchmark",
    "astro-lab": "Interactive lab",
    "platform": "Platform",
    "research-academic": "Research",
    "game": "Game",
    "coursework": "Coursework",
}
TYPE_GROUP = {
    "exoplanet-report": None, "detection-method": None,   # these use the evidence badge instead
    "research-benchmark": "research", "research-academic": "research",
    "astro-lab": "tool", "platform": "tool",
    "game": "light", "coursework": "archive",
}

# one accent color per type, reused for the donut chart, icon badges, and card accents —
# a fixed small palette rather than one-off colors per component
TYPE_COLOR_VAR = {
    "exoplanet-report": "--accent",
    "detection-method": "--accent-2",
    "research-benchmark": "--status-reanalysis",
    "astro-lab": "--type-tool",
    "platform": "--status-synthetic",
    "research-academic": "--type-research",
    "game": "--type-light",
    "coursework": "--type-archive",
}

TYPE_SHORT_DESC = {
    "exoplanet-report": "TESS transit fit per planet, plus a statistical read of any public spectrum. Null results kept as reported.",
    "detection-method": "Transit, RV, microlensing, direct imaging, each built from scratch and proven on an injected signal.",
    "research-benchmark": "Focused reproducibility studies on real instrument data, each with one stated question and result.",
    "astro-lab": "Browser physics and astronomy simulators built to explore a concept, not just describe it.",
    "platform": "Larger multi-feature systems: an RV console, a real-catalogue 3D explorer, and similar.",
    "research-academic": "Thesis work, ML research, and teaching notebooks.",
    "game": "Lighter side projects, kept in the atlas rather than left off it.",
    "coursework": "Early or archived coursework.",
}

# simple stroke-based icons, one per type — basic shape primitives only, no hand-authored
# path data, so they stay legible at 20px and don't need per-icon visual tuning
TYPE_ICONS = {
    "exoplanet-report": '<circle cx="12" cy="12" r="4.2"/><ellipse cx="12" cy="12" rx="10" ry="3.1" transform="rotate(-18 12 12)"/>',
    "detection-method": '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>',
    "research-benchmark": '<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5 L10.5 15.5 L16.5 8.5"/>',
    "astro-lab": '<path d="M9 3 H15 M10 3 V9 L4.5 19 C4 20 4.7 21 6 21 H18 C19.3 21 20 20 19.5 19 L14 9 V3"/><line x1="7.5" y1="15" x2="16.5" y2="15"/>',
    "platform": '<rect x="4" y="4" width="16" height="4.2" rx="1.4"/><rect x="4" y="9.9" width="16" height="4.2" rx="1.4"/><rect x="4" y="15.8" width="16" height="4.2" rx="1.4"/>',
    "research-academic": '<path d="M12 4 L22 9 L12 14 L2 9 Z"/><path d="M6 11 V16 C6 17.5 8.5 19 12 19 C15.5 19 18 17.5 18 16 V11"/>',
    "game": '<rect x="2" y="8" width="20" height="10" rx="5"/><line x1="7" y1="11" x2="7" y2="15"/><line x1="5" y1="13" x2="9" y2="13"/><circle cx="16" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="18.3" cy="14.5" r="1.1" fill="currentColor" stroke="none"/>',
    "coursework": '<rect x="4" y="3" width="16" height="18" rx="1.5"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>',
}


def type_icon_svg(type_key, size=20):
    inner = TYPE_ICONS.get(type_key, TYPE_ICONS["astro-lab"])
    return (
        '<svg viewBox="0 0 24 24" width="' + str(size) + '" height="' + str(size) +
        '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + inner + "</svg>"
    )

FILTER_CHIPS = [
    ("all", "All"),
    ("exoplanet-report", "Exoplanet reports"),
    ("detection-method", "Detection methods"),
    ("research-benchmark", "Research benchmarks"),
    ("astro-lab", "Interactive labs"),
    ("platform", "Platforms"),
    ("research-academic", "Research & academic"),
    ("game", "Games"),
    ("jwst", "JWST"),
    ("tess", "TESS"),
    ("null-result", "Null / mixed result"),
]


def esc(s):
    return html.escape(str(s), quote=True) if s is not None else ""


def load_projects():
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def compute_stats(projects):
    total = len(projects)
    active = sum(1 for p in projects if p["status"] == "active")
    live_demos = sum(1 for p in projects if p.get("live_report_url"))
    exoplanet_targets = sum(1 for p in projects if p["type"] == "exoplanet-report")
    interactive = sum(1 for p in projects if p["type"] in ("astro-lab", "platform"))
    real_data_repos = sum(
        1 for p in projects
        if p["type"] in ("exoplanet-report", "detection-method", "research-benchmark")
    )
    return {
        "total": total,
        "active": active,
        "live_demos": live_demos,
        "exoplanet_targets": exoplanet_targets,
        "interactive": interactive,
        "real_data_repos": real_data_repos,
    }


def render_stats(stats):
    tiles = [
        (stats["total"], "Repositories in this atlas"),
        (stats["live_demos"], "Live, deployable demos"),
        (stats["exoplanet_targets"], "Individual exoplanet targets analyzed"),
        (stats["interactive"], "Interactive labs and platforms"),
        (stats["real_data_repos"], "Repos built on real public data"),
    ]
    out = ['<div class="atlas-stats reveal">']
    for v, k in tiles:
        out.append(
            '<div class="atlas-stat"><div class="v">' + str(v) + "</div>"
            '<div class="k">' + esc(k) + "</div></div>"
        )
    out.append("</div>")
    return "".join(out)


def render_badge(p):
    """Evidence badge for exoplanet/detection-method entries, type badge otherwise."""
    if p.get("evidence_status"):
        status = p["evidence_status"]
        return (
            '<span class="ev-badge" data-status="' + esc(status) + '">'
            + esc(EV_LABELS.get(status, status)) + "</span>"
        )
    group = TYPE_GROUP.get(p["type"], "tool")
    label = TYPE_LABELS.get(p["type"], p["type"])
    return (
        '<span class="type-badge" data-type-group="' + esc(group) + '">'
        + esc(label) + "</span>"
    )


def search_blob(p):
    parts = [
        p["title"], p.get("summary", ""), p.get("headline") or "", p.get("category") or "",
        p.get("planet_class") or "", " ".join(p.get("tech_or_instruments", [])),
        " ".join(p.get("tags", [])), TYPE_LABELS.get(p["type"], ""),
    ]
    return esc(" ".join(str(x) for x in parts if x).lower())


def render_placeholder_media(p):
    """Tasteful no-image fallback: initials on a token-driven gradient, not a stock photo."""
    initials = "".join(w[0] for w in p["title"].split()[:2] if w[0].isalnum()).upper() or "?"
    return (
        '<div class="atlas-card-placeholder" aria-hidden="true"><span>' + esc(initials) + "</span></div>"
    )


def render_card(p, order):
    thumb_url = p.get("thumbnail_url")
    attribution = p.get("thumbnail_attribution") or ""
    tech = p.get("tech_or_instruments", [])
    tags = "|".join(p.get("tags", []))
    detail_json = json.dumps(p, ensure_ascii=False).replace("</", "<\\/")

    # attribution is kept in alt text for assistive tech, not shown as a visible caption
    media_html = (
        ('<img src="' + esc(thumb_url) + '" alt="' + esc(attribution or (p["title"] + " illustration")) +
         '" loading="lazy" width="640" height="360" />')
        if thumb_url else render_placeholder_media(p)
    )

    return (
        '<article class="atlas-card reveal" data-slug="' + esc(p["slug"]) + '" '
        'data-order="' + str(order) + '" data-type="' + esc(p["type"]) + '" '
        'data-status="' + esc(p["status"]) + '" '
        'data-evidence-status="' + esc(p.get("evidence_status") or "") + '" '
        'data-tech="' + esc("|".join(tech)) + '" '
        'data-tags="' + esc(tags) + '" '
        'data-search="' + search_blob(p) + '">'
        + '<div class="atlas-card-media">' + media_html + "</div>"
        + '<div class="atlas-card-body">'
        + '<div class="kicker">' + render_badge(p)
        + (' <span class="tag">Archived</span>' if p["status"] == "archived" else "")
        + (' <span class="tag">New — details coming soon</span>' if p.get("needs_review") else "")
        + "</div>"
        + "<h3><a href=\"#\" data-open-detail=\"" + esc(p["slug"]) + "\">" + esc(p["title"]) + "</a></h3>"
        + "<p>" + esc(p.get("summary", "")) + "</p>"
        + '<ul class="tags">' + "".join('<li class="tag">' + esc(t) + "</li>" for t in tech[:3]) + "</ul>"
        + '<div class="atlas-card-links">'
        + ('<a href="' + esc(p["live_report_url"]) + '" target="_blank" rel="noopener">Live</a>' if p.get("live_report_url") else "")
        + '<a href="' + esc(p["github_url"]) + '" target="_blank" rel="noopener">GitHub</a>'
        + "</div></div>"
        + '<script type="application/json" class="atlas-detail-data">' + detail_json + "</script>"
        + "</article>"
    )


def render_filter_chips():
    out = ['<div class="atlas-filters" role="group" aria-label="Filter repositories">']
    for key, label in FILTER_CHIPS:
        pressed = "true" if key == "all" else "false"
        out.append(
            '<button type="button" class="atlas-chip" data-filter="' + key +
            '" aria-pressed="' + pressed + '">' + esc(label) + "</button>"
        )
    out.append('<button type="button" class="atlas-chip-clear" id="atlas-clear-filters">Clear all</button>')
    out.append("</div>")
    return "".join(out)


DONUT_R = 76
DONUT_STROKE = 22
DONUT_CIRC = 2 * 3.14159265 * DONUT_R


def render_type_donut(type_counts, total):
    """A real proportional donut (stroke-dasharray segments on stacked circles) with an
    icon+count legend — replaces a text bar-list with something you can read in one glance."""
    segments = []
    offset = 0.0
    ordered = sorted(type_counts.items(), key=lambda kv: -kv[1])
    for type_key, n in ordered:
        frac = n / total if total else 0
        length = frac * DONUT_CIRC
        color_var = TYPE_COLOR_VAR.get(type_key, "--accent")
        segments.append(
            '<circle class="donut-seg" cx="90" cy="90" r="' + str(DONUT_R) + '" '
            'stroke="var(' + color_var + ')" stroke-width="' + str(DONUT_STROKE) + '" fill="none" '
            'stroke-dasharray="' + f"{length:.2f} {DONUT_CIRC - length:.2f}" + '" '
            'stroke-dashoffset="' + f"{-offset:.2f}" + '" '
            'transform="rotate(-90 90 90)" stroke-linecap="butt" />'
        )
        offset += length

    legend = ['<div class="atlas-type-legend">']
    for type_key, n in ordered:
        pct = round(100 * n / total) if total else 0
        legend.append(
            '<div class="atlas-type-legend-row">'
            '<span class="atlas-type-legend-icon" style="color:var(' + TYPE_COLOR_VAR.get(type_key, "--accent") + ')">'
            + type_icon_svg(type_key, 18) + "</span>"
            '<span class="lbl">' + esc(TYPE_LABELS.get(type_key, type_key)) + "</span>"
            '<span class="n">' + str(n) + '<span class="pct"> · ' + str(pct) + "%</span></span>"
            "</div>"
        )
    legend.append("</div>")

    svg = (
        '<svg class="atlas-donut" viewBox="0 0 180 180" role="img" aria-label="Repository breakdown by type">'
        '<circle cx="90" cy="90" r="' + str(DONUT_R) + '" stroke="var(--line)" stroke-width="' + str(DONUT_STROKE) + '" fill="none" />'
        + "".join(segments) +
        '<text x="90" y="84" text-anchor="middle" class="donut-total">' + str(total) + "</text>"
        '<text x="90" y="104" text-anchor="middle" class="donut-caption">repositories</text>'
        "</svg>"
    )
    return '<div class="atlas-donut-wrap">' + svg + "".join(legend) + "</div>"


def render_method_cards(type_counts):
    """Icon-led cards sized by how many repos are actually in that category — a bento
    grid where the size variation is real information, not decoration."""
    ordered = sorted(TYPE_LABELS.keys(), key=lambda t: -type_counts.get(t, 0))
    ordered = [t for t in ordered if type_counts.get(t)]
    max_n = max(type_counts.get(t, 0) for t in ordered) if ordered else 1

    out = ['<div class="atlas-method-bento">']
    for t in ordered:
        n = type_counts.get(t, 0)
        size_class = "lg" if n >= max_n * 0.6 else ("md" if n >= max_n * 0.25 else "sm")
        out.append(
            '<div class="atlas-method-card reveal" data-size="' + size_class + '">'
            '<div class="atlas-method-icon" style="color:var(' + TYPE_COLOR_VAR.get(t, "--accent") + ');'
            'background:color-mix(in srgb, var(' + TYPE_COLOR_VAR.get(t, "--accent") + ') 14%, transparent)">'
            + type_icon_svg(t, 22) + "</div>"
            '<div class="atlas-method-count">' + str(n) + "</div>"
            "<h3>" + esc(TYPE_LABELS.get(t, t)) + "</h3>"
            "<p>" + esc(TYPE_SHORT_DESC.get(t, "")) + "</p>"
            "</div>"
        )
    out.append("</div>")
    return "".join(out)


def render_proportion_pills(counter, total, label_map=None, icon=None):
    """Compact icon + horizontal proportion pill per row — same information as a bar list,
    read in far less space and without feeling like a spreadsheet."""
    rows = counter.most_common(8)
    out = ['<div class="atlas-pill-chart">']
    for label, n in rows:
        display = (label_map or {}).get(label, label)
        pct = round(100 * n / total) if total else 0
        out.append(
            '<div class="atlas-pill-row">'
            '<span class="atlas-pill-label">' + esc(display) + "</span>"
            '<span class="atlas-pill-track"><span class="atlas-pill-fill" style="width:' + str(max(pct, 4)) + '%"></span></span>'
            '<span class="atlas-pill-n">' + str(n) + "</span>"
            "</div>"
        )
    out.append("</div>")
    return "".join(out)


def render_jsonld(projects, stats):
    items = []
    for i, p in enumerate(projects, start=1):
        is_article = p["type"] in ("exoplanet-report", "detection-method", "research-benchmark", "research-academic")
        items.append({
            "@type": "ListItem",
            "position": i,
            "item": {
                "@type": "ScholarlyArticle" if is_article else "SoftwareSourceCode",
                "name": p["title"],
                "url": p.get("live_report_url") or p["github_url"],
                "abstract": p.get("summary", ""),
                "author": {"@type": "Person", "name": "Biswajit Jana"},
                "codeRepository": p["github_url"],
            },
        })
    doc = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Constellation",
        "description": (
            str(stats["total"]) + " public repositories spanning exoplanet research reports, "
            "detection-method implementations, interactive astrophysics labs, and research platforms."
        ),
        "numberOfItems": stats["total"],
        "itemListElement": items,
    }
    return json.dumps(doc, ensure_ascii=False, indent=2)


def load_graph():
    if not GRAPH_PATH.exists():
        return None
    with open(GRAPH_PATH, encoding="utf-8") as f:
        return json.load(f)


def render_graph_section(graph):
    if not graph:
        return "", ""

    # semantic, crawlable, no-JS-safe list: grouped by type, each entity linking to its
    # related projects. This is the real content; the SVG is a progressive enhancement of it.
    by_type = {}
    for n in graph["nodes"]:
        by_type.setdefault(n["type"], []).append(n)

    proj_by_id = {n["id"]: n for n in graph["nodes"] if n["type"] == "Project"}
    edges_by_node = {}
    for e in graph["edges"]:
        edges_by_node.setdefault(e["source"], []).append(e)
        edges_by_node.setdefault(e["target"], []).append(e)

    list_html = ['<div id="atlas-graph-semantic-list">']
    for t in ("Instrument", "Method", "Molecule", "PlanetClass", "AnalysisType"):
        nodes = sorted(by_type.get(t, []), key=lambda n: n["label"])
        if not nodes:
            continue
        list_html.append(
            "<details><summary>" + esc(GRAPH_TYPE_LABELS.get(t, t)) + " (" + str(len(nodes)) + ")</summary><ul>"
        )
        for n in nodes:
            related = [e["source"] if e["target"] == n["id"] else e["target"] for e in edges_by_node.get(n["id"], [])]
            related_projects = [proj_by_id[r] for r in related if r in proj_by_id]
            links = ", ".join(
                '<a href="#" data-graph-node="' + esc(p["id"]) + '">' + esc(p["label"]) + "</a>"
                for p in related_projects[:6]
            )
            more = len(related_projects) - 6
            list_html.append(
                "<li><strong>" + esc(n["label"]) + "</strong>"
                + (" &mdash; used in " + links + (f" and {more} more" if more > 0 else "") if links else "")
                + "</li>"
            )
        list_html.append("</ul></details>")
    list_html.append("</div>")

    type_filters = "".join(
        '<label><input type="checkbox" data-graph-type-filter="' + t + '" checked /> '
        + '<span class="swatch sw-' + t.lower() + '"></span> ' + esc(GRAPH_TYPE_LABELS.get(t, t)) + "</label>"
        for t in ("Project", "Instrument", "Method", "Molecule", "PlanetClass", "AnalysisType")
        if by_type.get(t)
    )

    section = (
        '<section class="section section-band" id="atlas-graph-section">'
        '<div class="container">'
        '<div class="section-head">'
        '<p class="eyebrow">How it connects</p>'
        '<h2 class="section-title">Research knowledge graph</h2>'
        '<p class="section-lead">' + str(graph["nodeCount"]) + " entities and " + str(graph["edgeCount"])
        + " relationships across targets, instruments, methods, and molecules, built directly from the"
        " same manifest as the rest of this page. Every edge traces back to the repository it came from.</p>"
        "</div>"
        '<div class="atlas-graph-layout">'
        "<div>"
        '<div class="atlas-graph-toolbar">'
        '<input type="search" id="atlas-graph-search" placeholder="Search the graph..." />'
        '<div class="atlas-graph-legend">' + type_filters + "</div>"
        "</div>"
        '<div class="atlas-graph-canvas" id="atlas-graph-canvas"></div>'
        '<div class="atlas-graph-controls">'
        '<button type="button" class="btn btn-ghost btn-sm" id="atlas-graph-reset">Reset view</button>'
        "</div>"
        '<p id="atlas-graph-note" class="mono" style="font-size:.72rem;color:var(--muted);margin-top:8px">Drag to pan, scroll to zoom, click a node to see its connections.</p>'
        '<div class="atlas-graph-list-wrap" id="atlas-graph-list-wrap" hidden>' + "".join(list_html) + "</div>"
        "</div>"
        '<div class="atlas-graph-panel" id="atlas-graph-panel" hidden></div>'
        "</div>"
        "</div>"
        "</section>"
    )

    noscript_list = '<noscript><div class="container">' + "".join(list_html) + "</div></noscript>"
    return section, noscript_list


def build():
    projects = load_projects()
    graph = load_graph()
    graph_section_html, graph_noscript_html = render_graph_section(graph)
    stats = compute_stats(projects)

    cards_html = "\n".join(render_card(p, i) for i, p in enumerate(projects))
    stats_html = render_stats(stats)
    chips_html = render_filter_chips()
    jsonld = render_jsonld(projects, stats)

    type_counts = Counter(p["type"] for p in projects)
    category_counts = Counter(p["category"] for p in projects if p.get("category"))
    evidence_counts = Counter(
        EV_LABELS.get(p["evidence_status"], p["evidence_status"])
        for p in projects if p.get("evidence_status")
    )

    type_chart = render_type_donut(type_counts, stats["total"])
    method_cards = render_method_cards(type_counts)
    category_chart = render_proportion_pills(category_counts, sum(category_counts.values()) or 1)
    evidence_chart = render_proportion_pills(evidence_counts, sum(evidence_counts.values()) or 1)

    html_out = PAGE_TEMPLATE
    html_out = html_out.replace("{{JSONLD}}", jsonld)
    html_out = html_out.replace("{{STATS}}", stats_html)
    html_out = html_out.replace("{{FILTER_CHIPS}}", chips_html)
    html_out = html_out.replace("{{CARDS}}", cards_html)
    html_out = html_out.replace("{{RESULT_COUNT}}", str(stats["total"]) + " repositories")
    html_out = html_out.replace("{{TYPE_CHART}}", type_chart)
    html_out = html_out.replace("{{METHOD_CARDS}}", method_cards)
    html_out = html_out.replace("{{CATEGORY_CHART}}", category_chart)
    html_out = html_out.replace("{{EVIDENCE_CHART}}", evidence_chart)
    html_out = html_out.replace("{{TOTAL}}", str(stats["total"]))
    html_out = html_out.replace("{{EXO_TOTAL}}", str(stats["exoplanet_targets"]))
    html_out = html_out.replace("{{GRAPH_SECTION}}", graph_section_html)
    html_out = html_out.replace("{{GRAPH_NOSCRIPT}}", graph_noscript_html)
    html_out = html_out.replace("{{ASSET_V}}", asset_version())

    OUT_PATH.write_text(html_out, encoding="utf-8")
    print("Wrote " + str(OUT_PATH) + " (" + str(stats["total"]) + " repositories)")
    print("Stats: " + json.dumps(stats))
    print("Types: " + json.dumps(dict(type_counts)))


PAGE_TEMPLATE = r"""<!DOCTYPE html>
<html lang="en" data-theme="dark" class="no-js">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Constellation | Biswajit Jana</title>

<meta name="author" content="Biswajit Jana" />
<meta name="description" content="{{TOTAL}} public repositories: exoplanet research reports, detection-method implementations, interactive astrophysics labs, and research platforms, searchable and filterable by type." />
<meta name="keywords" content="astrophysics portfolio, exoplanet research, interactive physics labs, TESS, JWST, Biswajit Jana" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="__SITE_URL__/atlas.html" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="Biswajit Jana" />
<meta property="og:title" content="Constellation | Biswajit Jana" />
<meta property="og:description" content="{{TOTAL}} public repositories across exoplanet research, interactive astrophysics labs, and research platforms." />
<meta property="og:url" content="__SITE_URL__/atlas.html" />
<meta property="og:image" content="__SITE_URL__/images/github-social-preview.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Constellation | Biswajit Jana" />
<meta name="twitter:description" content="{{TOTAL}} public repositories across exoplanet research, interactive astrophysics labs, and research platforms." />

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="atlas.css?v={{ASSET_V}}" />

<script type="application/ld+json">
{{JSONLD}}
</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<canvas id="atlas-space" aria-hidden="true"></canvas>

<header class="nav" id="nav">
  <div class="container nav-inner">
    <a class="brand" href="index.html">Biswajit Jana</a>
    <nav aria-label="Primary">
      <ul class="nav-links">
        <li><a href="index.html#about">About</a></li>
        <li><a href="index.html#skills">Skills</a></li>
        <li><a href="index.html#research">Research</a></li>
        <li><a href="atlas.html" aria-current="page">Constellation</a></li>
        <li><a href="index.html#tools">Tools</a></li>
        <li><a href="cv.html">CV</a></li>
        <li><a href="index.html#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="nav-right">
      <button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle dark mode" aria-pressed="false">
        <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
      </button>
      <button class="nav-toggle" id="navToggle" type="button" aria-label="Open menu" aria-expanded="false">&#9776;</button>
    </div>
  </div>
</header>

<main id="main">

<section class="atlas-hero">
  <div class="container">
    <div class="atlas-hero-grid">
      <div>
        <p class="section-head eyebrow" style="margin-bottom:14px">Constellation</p>
        <h1>Every <span class="sub">public repository</span>, in one place.</h1>
        <p class="intro">This is my GitHub compiled into something browsable: {{EXO_TOTAL}} exoplanet target reports, a set of detection-method implementations built from scratch, interactive astrophysics labs, larger research platforms, and the academic and side work alongside them. Each repository tells its own story; this page is the map between them.</p>
        <div class="atlas-hero-actions">
          <a class="btn btn-primary" href="#atlas-explorer">Browse the repositories</a>
          <a class="btn btn-ghost" href="https://github.com/Biswajit1999?tab=repositories" target="_blank" rel="noopener">View GitHub</a>
          <a class="btn btn-ghost" href="#atlas-methodology">How this is organized</a>
        </div>
      </div>
      {{STATS}}
    </div>
  </div>
</section>

<section class="atlas-carousel-section section-band" aria-label="Featured repositories carousel">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Highlights</p>
      <h2 class="section-title">Step through my works</h2>
    </div>
    <div class="atlas-carousel" id="atlas-carousel" data-motion="full">
      <div class="atlas-carousel-track" id="atlas-carousel-track"></div>
    </div>
    <div class="atlas-carousel-controls">
      <button type="button" id="atlas-carousel-prev" aria-label="Previous repository">&#8249;</button>
      <div class="atlas-carousel-dots" id="atlas-carousel-dots" role="tablist" aria-label="Choose a repository"></div>
      <button type="button" id="atlas-carousel-next" aria-label="Next repository">&#8250;</button>
    </div>
    <p id="atlas-carousel-live" class="mono" style="text-align:center;font-size:.72rem;color:var(--muted);margin-top:10px" aria-live="polite"></p>
  </div>
</section>

<section class="section" id="atlas-explorer">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Full catalog</p>
      <h2 class="section-title">Every repository, searchable</h2>
      <p class="section-lead">Filter by type, instrument, or evidence status. All {{TOTAL}} repositories stay reachable here, independent of the carousel above.</p>
    </div>

    <div class="atlas-explorer-toolbar">
      <div class="atlas-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        <label for="atlas-search-input" class="sr-only" style="position:absolute;left:-9999px">Search repositories</label>
        <input type="search" id="atlas-search-input" placeholder="Search title, target, tech, method..." />
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        <span class="atlas-result-count" id="atlas-result-count">{{RESULT_COUNT}}</span>
        <div class="atlas-sort">
          <label for="atlas-sort-select" class="sr-only" style="position:absolute;left:-9999px">Sort by</label>
          <select id="atlas-sort-select">
            <option value="featured">Sort: Featured</option>
            <option value="target">Sort: Title</option>
            <option value="category">Sort: Type</option>
          </select>
        </div>
      </div>
    </div>

    {{FILTER_CHIPS}}

    <div class="atlas-grid" id="atlas-grid">
      {{CARDS}}
    </div>
    <div class="atlas-empty" id="atlas-empty" hidden>
      <h3>No repositories match those filters</h3>
      <p>Try clearing a filter or searching a different term.</p>
    </div>
    <nav class="atlas-pagination" id="atlas-pagination" aria-label="Repository pages" hidden></nav>
  </div>
</section>

<section class="section section-band">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">Portfolio-wide view</p>
      <h2 class="section-title">One body of work, several threads</h2>
      <p class="section-lead">Computed directly from the {{TOTAL}}-repository manifest at build time.</p>
    </div>
    <div class="atlas-donut-section reveal">
      {{TYPE_CHART}}
    </div>
    <div class="atlas-pill-grid">
      <div class="atlas-pill-block reveal">
        <h4>Exoplanet reports, by analysis</h4>
        {{CATEGORY_CHART}}
      </div>
      <div class="atlas-pill-block reveal">
        <h4>Exoplanet reports, by evidence</h4>
        {{EVIDENCE_CHART}}
      </div>
    </div>
  </div>
</section>

<section class="section" id="atlas-methodology">
  <div class="container">
    <div class="section-head">
      <p class="eyebrow">How this is organized</p>
      <h2 class="section-title">Seven kinds of repository</h2>
      <p class="section-lead">Same rules across all {{TOTAL}}.</p>
    </div>
    {{METHOD_CARDS}}
  </div>
</section>

{{GRAPH_SECTION}}
{{GRAPH_NOSCRIPT}}

<div class="atlas-modal-overlay" id="atlas-modal-overlay" data-open="false" hidden role="dialog" aria-modal="true" aria-labelledby="atlas-modal-title">
  <div class="atlas-modal" id="atlas-modal-body"></div>
</div>

<footer>
  <div class="container">
    <div class="foot-inner">
      <span>&copy; Biswajit Jana</span>
      <div class="foot-links">
        <a href="index.html">Home</a>
        <a href="cv.html">CV</a>
        <a href="publications.html">Publications</a>
        <a href="https://github.com/Biswajit1999" target="_blank" rel="noopener">GitHub</a>
        <a href="https://www.linkedin.com/in/biswajit-jana-27011a151/" target="_blank" rel="noopener">LinkedIn</a>
      </div>
    </div>
    <p class="foot-note">All {{TOTAL}} repositories on this page link back to their own GitHub repository for full inspection, code, and data provenance.</p>
  </div>
</footer>

<script src="atlas.js?v={{ASSET_V}}"></script>
<script src="https://unpkg.com/3d-force-graph@1.73.3/dist/3d-force-graph.min.js" integrity="sha384-SIcVySj+Cd1g+cwoLNCdr/osXU15HLXCxfaSzFNkZICYeKS7I2YxhyggCijT8JHA" crossorigin="anonymous"></script>
<script src="atlas-graph.js?v={{ASSET_V}}" defer></script>
</body>
</html>
""".replace("__SITE_URL__", SITE_URL)


if __name__ == "__main__":
    build()
