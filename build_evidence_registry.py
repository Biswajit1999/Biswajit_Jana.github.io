#!/usr/bin/env python3
"""Validate research evidence and build the reviewer-facing registry page."""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data" / "research-evidence.json"
OUTPUT_PATH = ROOT / "research-evidence.html"
REQUIRED_REPOSITORY_FIELDS = {
    "rank",
    "slug",
    "title",
    "version",
    "source_ref",
    "research_question",
    "principal_result",
    "evidence",
    "before_score",
    "after_score",
    "claim_boundary",
    "repository_url",
    "release_url",
    "live_url",
}


def load_evidence(path: Path = DATA_PATH) -> dict[str, object]:
    return json.loads(path.read_text(encoding="utf-8"))


def validate_evidence(document: dict[str, object]) -> None:
    if document.get("schema_version") != 1:
        raise ValueError("schema_version must be 1")
    programme = document.get("programme")
    repositories = document.get("repositories")
    if not isinstance(programme, dict) or not isinstance(repositories, list):
        raise ValueError("programme must be an object and repositories must be a list")
    if programme.get("completed") != len(repositories):
        raise ValueError("programme.completed must equal the repository record count")
    if int(programme.get("ranked_queue", 0)) < len(repositories):
        raise ValueError("ranked_queue cannot be smaller than completed records")

    slugs: set[str] = set()
    ranks: set[int] = set()
    for index, repository in enumerate(repositories):
        if not isinstance(repository, dict):
            raise ValueError(f"repository {index} must be an object")
        missing = REQUIRED_REPOSITORY_FIELDS - repository.keys()
        if missing:
            raise ValueError(f"repository {index} is missing {sorted(missing)}")
        slug = str(repository["slug"])
        rank = int(repository["rank"])
        if slug in slugs or rank in ranks:
            raise ValueError("repository slugs and ranks must be unique")
        slugs.add(slug)
        ranks.add(rank)
        before = int(repository["before_score"])
        after = int(repository["after_score"])
        if not (0 <= before < after <= 100):
            raise ValueError(f"invalid maturity scores for {slug}")
        evidence = repository["evidence"]
        if not isinstance(evidence, list) or len(evidence) < 3:
            raise ValueError(f"{slug} needs at least three evidence markers")
        for field in ("repository_url", "release_url", "live_url"):
            if not str(repository[field]).startswith("https://"):
                raise ValueError(f"{slug}.{field} must be an HTTPS URL")


def _esc(value: object) -> str:
    return html.escape(str(value), quote=True)


def _repository_card(repository: dict[str, object]) -> str:
    evidence = "".join(f"<li>{_esc(item)}</li>" for item in repository["evidence"])
    before = int(repository["before_score"])
    after = int(repository["after_score"])
    return f"""
      <article class="evidence-card" aria-labelledby="repo-{_esc(repository['rank'])}">
        <header class="card-head">
          <div><span class="rank">Queue #{_esc(repository['rank'])}</span><h2 id="repo-{_esc(repository['rank'])}">{_esc(repository['title'])}</h2></div>
          <span class="release">{_esc(repository['version'])} · verified</span>
        </header>
        <p class="question"><strong>Research question</strong>{_esc(repository['research_question'])}</p>
        <div class="result"><span>Generated result</span><p>{_esc(repository['principal_result'])}</p></div>
        <div class="card-grid">
          <section aria-label="Evidence markers"><h3>Evidence</h3><ul class="evidence-list">{evidence}</ul></section>
          <section aria-label="Research maturity comparison">
            <h3>Evidence maturity</h3>
            <div class="score-row"><span>Before</span><progress value="{before}" max="100">{before}%</progress><b>{before}</b></div>
            <div class="score-row after"><span>After</span><progress value="{after}" max="100">{after}%</progress><b>{after}</b></div>
            <p class="delta">+{after - before} rubric points</p>
          </section>
        </div>
        <aside class="boundary"><strong>Boundary of inference</strong><span>{_esc(repository['claim_boundary'])}</span></aside>
        <footer class="card-links">
          <a href="{_esc(repository['repository_url'])}">Repository</a>
          <a href="{_esc(repository['release_url'])}">Release evidence</a>
          <a href="{_esc(repository['live_url'])}">Live research surface</a>
          <code>{_esc(repository['source_ref'])}</code>
        </footer>
      </article>"""


def render(document: dict[str, object]) -> str:
    validate_evidence(document)
    programme = document["programme"]
    repositories = document["repositories"]
    complete = int(programme["completed"])
    remaining = int(programme["ranked_queue"]) - complete
    cards = "\n".join(_repository_card(repository) for repository in repositories)
    structured = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": programme["title"],
        "numberOfItems": complete,
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": index,
                "name": repository["title"],
                "url": repository["live_url"],
            }
            for index, repository in enumerate(repositories, start=1)
        ],
    }
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Auditable research evidence registry for Biswajit Jana's Top-50 repository upgrade programme: questions, generated results, releases, validation, maturity, and limitations.">
  <link rel="canonical" href="https://biswajit1999.github.io/Biswajit_Jana.github.io/research-evidence.html">
  <title>Research Evidence Registry · Biswajit Jana</title>
  <script type="application/ld+json">{json.dumps(structured, ensure_ascii=False, separators=(',', ':'))}</script>
  <style>
    :root{{--bg:#f8fafc;--surface:#fff;--surface-2:#e9eef5;--ink:#0f172a;--soft:#475569;--line:#cbd5e1;--navy:#1e3a5f;--teal:#0f766e;--gold:#a16207;--ring:#2563eb;--max:1160px}}
    *{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}
    a{{color:var(--navy);text-underline-offset:3px}}a:hover{{text-decoration-thickness:2px}}a:focus-visible{{outline:3px solid var(--ring);outline-offset:4px;border-radius:4px}}
    .skip{{position:absolute;left:16px;top:-80px;background:var(--ink);color:var(--bg);padding:10px 14px;z-index:10}}.skip:focus{{top:16px}}
    .site-head{{border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--surface) 94%,transparent)}}.head-inner{{max-width:var(--max);margin:auto;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}}
    .brand{{font-weight:750;text-decoration:none;color:var(--ink)}}nav{{display:flex;gap:20px;flex-wrap:wrap}}nav a{{font-weight:650;text-decoration:none}}
    main{{max-width:var(--max);margin:auto;padding:clamp(48px,8vw,92px) 24px 80px}}.eyebrow,.rank,.release,.result>span{{font-size:.78rem;letter-spacing:.12em;text-transform:uppercase;font-weight:750}}
    .eyebrow{{color:var(--teal)}}h1,h2,h3,p{{margin-top:0}}h1{{max-width:900px;font-family:Georgia,serif;font-size:clamp(2.3rem,6vw,5.3rem);line-height:1.02;letter-spacing:-.035em;margin-bottom:24px}}.lede{{max-width:780px;color:var(--soft);font-size:clamp(1.05rem,2vw,1.24rem)}}
    .summary{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:38px 0 24px}}.summary div{{background:var(--surface);border-top:3px solid var(--navy);padding:20px}}.summary strong{{display:block;font-size:clamp(1.5rem,3vw,2.3rem);font-variant-numeric:tabular-nums}}.summary span{{color:var(--soft)}}
    .policy{{max-width:900px;border-left:4px solid var(--gold);padding:8px 0 8px 20px;color:var(--soft);margin-bottom:52px}}.policy strong{{color:var(--ink)}}
    .registry{{display:grid;gap:28px;min-width:0}}.evidence-card{{min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:clamp(22px,4vw,38px);box-shadow:0 18px 44px -36px rgba(15,23,42,.55)}}
    .card-head{{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid var(--line);padding-bottom:20px;margin-bottom:24px}}.card-head>div,.card-grid>*{{min-width:0}}.card-head h2{{font-family:Georgia,serif;font-size:clamp(1.55rem,3vw,2.35rem);line-height:1.12;margin:5px 0 0;overflow-wrap:anywhere}}.rank{{color:var(--teal)}}.release{{background:var(--surface-2);padding:7px 10px;border-radius:999px;white-space:nowrap}}
    .question{{max-width:900px;font-size:1.08rem}}.question strong,.boundary strong{{display:block;color:var(--navy);font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}}.evidence-list li,.boundary span{{overflow-wrap:anywhere}}
    .result{{background:var(--navy);color:#fff;padding:20px 22px;margin:24px 0;border-radius:12px}}.result>span{{color:#bfdbfe}}.result p{{margin:5px 0 0;max-width:900px}}
    .card-grid{{display:grid;grid-template-columns:1fr 1fr;gap:clamp(24px,5vw,64px);margin:28px 0}}.card-grid h3{{font-size:1rem}}.evidence-list{{padding-left:20px;margin:0}}.evidence-list li+li{{margin-top:6px}}
    .score-row{{display:grid;grid-template-columns:54px 1fr 36px;align-items:center;gap:10px;font-variant-numeric:tabular-nums}}.score-row+ .score-row{{margin-top:12px}}progress{{width:100%;height:12px;accent-color:var(--gold)}}.score-row.after progress{{accent-color:var(--teal)}}.delta{{color:var(--teal);font-weight:750;margin:9px 0 0 64px}}
    .boundary{{display:flex;gap:20px;background:var(--surface-2);padding:16px 18px;border-radius:10px}}.boundary strong{{min-width:160px;margin:0}}.boundary span{{color:var(--soft)}}.card-links{{display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-top:22px}}.card-links a{{font-weight:700}}.card-links code{{margin-left:auto;color:var(--soft);overflow-wrap:anywhere}}
    .status-note{{margin-top:42px;padding:24px;border:1px solid var(--line);border-radius:14px}}.status-note h2{{font-family:Georgia,serif}}.status-note p{{color:var(--soft);max-width:800px;margin-bottom:0}}
    footer.site-foot{{border-top:1px solid var(--line);padding:28px 24px;color:var(--soft)}}.foot-inner{{max-width:var(--max);margin:auto;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}}
    @media(max-width:760px){{.head-inner,.card-head,.boundary{{align-items:flex-start;flex-direction:column}}nav{{gap:12px}}.summary{{grid-template-columns:1fr 1fr}}.card-grid{{grid-template-columns:1fr}}.card-links code{{width:100%;margin:0}}}}
    @media(max-width:420px){{.summary{{grid-template-columns:1fr}}main,.head-inner{{padding-left:18px;padding-right:18px}}}}
    @media(prefers-color-scheme:dark){{:root{{--bg:#0b1220;--surface:#111c2e;--surface-2:#17253a;--ink:#f1f5f9;--soft:#cbd5e1;--line:#31415a;--navy:#93c5fd;--teal:#5eead4;--gold:#fbbf24;--ring:#60a5fa}}.result{{background:#172d55}}}}
    @media(prefers-reduced-motion:reduce){{html{{scroll-behavior:auto}}}}
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to evidence</a>
  <header class="site-head"><div class="head-inner"><a class="brand" href="index.html">Biswajit Jana</a><nav aria-label="Evidence navigation"><a href="index.html">Portfolio</a><a href="atlas.html">GitHub atlas</a><a href="cv.html">CV</a></nav></div></header>
  <main id="main">
    <p class="eyebrow">Open research programme · verified {_esc(document['verified_date'])}</p>
    <h1>Research claims, with their evidence attached.</h1>
    <p class="lede">A reviewer-facing record of the Top-50 repository upgrade programme. Each completed entry connects a research question to generated results, validation, a versioned release, and an explicit boundary of inference.</p>
    <section class="summary" aria-label="Programme status">
      <div><strong>{_esc(programme['audited_repositories'])}</strong><span>repositories audited</span></div>
      <div><strong>{_esc(programme['eligible_first_party'])}</strong><span>eligible first-party</span></div>
      <div><strong>{complete} / {_esc(programme['ranked_queue'])}</strong><span>upgrades complete</span></div>
      <div><strong>{remaining}</strong><span>ranked upgrades remaining</span></div>
    </section>
    <p class="policy"><strong>Completion rule.</strong> {_esc(programme['policy'])}</p>
    <section class="registry" aria-label="Completed repository upgrades">{cards}
    </section>
    <section class="status-note"><h2>What this registry does not claim</h2><p>Maturity scores measure the presence of auditable research practices across ten documented dimensions. They are not peer-review scores, citation metrics, or literal multipliers of scientific quality. Repositories not shown here remain in the ranked queue and are not represented as upgraded.</p></section>
  </main>
  <footer class="site-foot"><div class="foot-inner"><span>Biswajit Jana · research evidence registry</span><span>Source: <a href="data/research-evidence.json">versioned JSON</a></span></div></footer>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if generated HTML is stale")
    args = parser.parse_args()
    generated = render(load_evidence())
    if args.check:
        if not OUTPUT_PATH.exists() or OUTPUT_PATH.read_text(encoding="utf-8") != generated:
            print(f"{OUTPUT_PATH.name} is stale; run {Path(__file__).name}", file=sys.stderr)
            raise SystemExit(1)
        print(f"{OUTPUT_PATH.name} is current")
        return
    OUTPUT_PATH.write_text(generated, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
