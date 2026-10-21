#!/usr/bin/env python3
"""Build a static, crawlable index of every public repository.

Unlike the interactive atlas, this page deliberately renders every repository link in
HTML so crawlers and no-JavaScript readers can discover the complete portfolio. The
GitHub API is the source of truth; a committed JSON snapshot keeps builds reproducible.
"""

from __future__ import annotations

import html
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "public-repositories.json"
OUT_PATH = ROOT / "research-index.html"
OWNER = "Biswajit1999"
SITE = "https://biswajit1999.github.io/Biswajit_Jana.github.io"


def fetch_repositories() -> list[dict]:
    repos: list[dict] = []
    page = 1
    while True:
        url = f"https://api.github.com/users/{OWNER}/repos?type=owner&sort=updated&direction=desc&per_page=100&page={page}"
        request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": "Biswajit-research-index"})
        with urllib.request.urlopen(request, timeout=30) as response:
            batch = json.load(response)
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return [repo for repo in repos if not repo.get("fork") and not repo.get("archived")]


def snapshot(repos: list[dict]) -> list[dict]:
    fields = ("name", "description", "html_url", "homepage", "language", "topics", "updated_at", "created_at")
    return [{field: repo.get(field) for field in fields} for repo in repos]


def category(repo: dict) -> str:
    text = " ".join([repo["name"], repo.get("description") or "", *(repo.get("topics") or [])]).lower()
    rules = [
        (r"exoplanet|transit|radial.velocity|habitable|biosignature", "Exoplanets"),
        (r"dark.matter|lensing|cosmology|supernova|galaxy|cmb|universe", "Cosmology & galaxies"),
        (r"spectrograph|instrument|adaptive.optics|interferometr|pid|detector", "Instrumentation"),
        (r"stellar|star|asteroseism|pulsar|betelgeuse", "Stars & compact objects"),
        (r"frb|radio|21cm|gamma.ray|x.ray|gravitational.wave", "Multi-messenger astronomy"),
        (r"machine.learning|\bml\b|data.analysis|notebook|python", "Scientific computing"),
    ]
    for pattern, label in rules:
        if re.search(pattern, text):
            return label
    return "Other research software"


def live_url(repo: dict) -> str | None:
    homepage = (repo.get("homepage") or "").strip()
    if homepage.startswith("http"):
        return homepage
    return None


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def render(repos: list[dict]) -> str:
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    counts: dict[str, int] = {}
    for repo in repos:
        counts[category(repo)] = counts.get(category(repo), 0) + 1
    filters = ['<button class="filter is-active" data-filter="all" type="button">All <span>' + str(len(repos)) + '</span></button>']
    filters += [f'<button class="filter" data-filter="{esc(label)}" type="button">{esc(label)} <span>{count}</span></button>' for label, count in sorted(counts.items())]
    cards = []
    items = []
    for position, repo in enumerate(repos, 1):
        label = category(repo)
        description = repo.get("description") or f"Open-source research project and scientific software by Biswajit Jana: {repo['name']}."
        topics = list(repo.get("topics") or [])[:6]
        topic_html = "".join(f"<li>{esc(topic.replace('-', ' '))}</li>" for topic in topics)
        live = live_url(repo)
        live_link = f'<a href="{esc(live)}">Open project <span aria-hidden="true">↗</span></a>' if live else ""
        searchable = " ".join([repo["name"], description, label, *topics]).lower()
        anchor = re.sub(r"[^a-z0-9]+", "-", repo["name"].lower()).strip("-")
        cards.append(f'''<article class="project" id="repo-{esc(anchor)}" data-category="{esc(label)}" data-search="{esc(searchable)}">
  <div class="project-meta"><span>{esc(label)}</span><time datetime="{esc(repo.get('updated_at'))}">Updated {esc((repo.get('updated_at') or '')[:10])}</time></div>
  <h2><a href="{esc(live or repo['html_url'])}">{esc(repo['name'].replace('-', ' ').replace('_', ' '))}</a></h2>
  <p>{esc(description)}</p>
  <ul class="topics">{topic_html}</ul>
  <div class="links">{live_link}<a href="{esc(repo['html_url'])}">Source code <span aria-hidden="true">↗</span></a></div>
</article>''')
        items.append({"@type": "ListItem", "position": position, "url": live or repo["html_url"], "name": repo["name"], "description": description})
    structured = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Biswajit Jana research software index", "url": f"{SITE}/research-index.html", "description": f"A crawlable index of {len(repos)} public astronomy, astrophysics, instrumentation and scientific-computing repositories by Biswajit Jana.", "dateModified": now, "mainEntity": {"@type": "ItemList", "numberOfItems": len(repos), "itemListElement": items}}
    return f'''<!doctype html>
<html lang="en" data-theme="light"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Research Software Index | Biswajit Jana</title>
<meta name="description" content="Browse {len(repos)} public astronomy, astrophysics, instrumentation and scientific-computing repositories by Biswajit Jana, with direct project and source links.">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<link rel="canonical" href="{SITE}/research-index.html">
<meta property="og:type" content="website"><meta property="og:title" content="Research Software Index | Biswajit Jana"><meta property="og:description" content="A complete, searchable and crawlable catalog of {len(repos)} public research repositories."><meta property="og:url" content="{SITE}/research-index.html"><meta property="og:image" content="{SITE}/images/github-social-preview.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Research Software Index | Biswajit Jana"><meta name="twitter:description" content="Browse {len(repos)} public astronomy and scientific-computing repositories."><meta name="twitter:image" content="{SITE}/images/github-social-preview.png">
<script type="application/ld+json">{json.dumps(structured, ensure_ascii=False).replace('<', '\\u003c')}</script>
<style>
:root{{--bg:#f4ecdd;--panel:#fffdf8;--ink:#20190f;--muted:#675b4b;--line:#d9cbb7;--accent:#a94f12;--chip:#efe4d2}}[data-theme=dark]{{--bg:#0d1515;--panel:#142020;--ink:#eef5ef;--muted:#a8b9b2;--line:#304542;--accent:#ff9b62;--chip:#1c2c2a}}*{{box-sizing:border-box}}html{{scroll-behavior:smooth}}body{{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,sans-serif}}a{{color:inherit}}header,main,footer{{width:min(1180px,calc(100% - 32px));margin:auto}}header{{padding:28px 0 48px}}nav{{display:flex;align-items:center;justify-content:space-between;gap:20px}}nav a{{font-weight:800;text-decoration:none}}button{{font:inherit}}.theme{{border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:8px 12px;border-radius:999px}}.eyebrow{{margin-top:72px;color:var(--accent);font:700 12px/1.2 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.18em}}h1{{max-width:850px;margin:.25em 0;font:800 clamp(42px,7vw,86px)/.96 Georgia,serif;letter-spacing:-.045em}}.lede{{max-width:760px;color:var(--muted);font-size:19px}}.summary{{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0}}.summary span,.filter{{border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:8px 13px;border-radius:999px}}.controls{{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(12px);padding:15px 0;border-block:1px solid var(--line)}}input{{width:100%;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);font:inherit}}.filters{{display:flex;gap:8px;overflow:auto;padding-top:10px}}.filter{{white-space:nowrap;cursor:pointer}}.filter.is-active{{background:var(--ink);color:var(--bg)}}.grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:32px 0 80px}}.project{{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:24px;box-shadow:0 8px 30px rgb(50 31 12 / .05)}}.project[hidden]{{display:none}}.project-meta{{display:flex;justify-content:space-between;gap:14px;color:var(--muted);font:700 11px/1.3 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}}h2{{margin:14px 0 8px;font:700 27px/1.05 Georgia,serif}}h2 a{{text-decoration-thickness:1px;text-underline-offset:4px}}.project p{{color:var(--muted)}}.topics{{display:flex;flex-wrap:wrap;gap:6px;list-style:none;padding:0}}.topics li{{background:var(--chip);padding:4px 9px;border-radius:999px;font-size:12px}}.links{{display:flex;gap:18px;margin-top:18px;font-weight:750;color:var(--accent)}}footer{{border-top:1px solid var(--line);padding:26px 0 50px;color:var(--muted)}}@media(max-width:720px){{.grid{{grid-template-columns:1fr}}.project-meta{{display:block}}}}
</style>
<link rel="stylesheet" href="observatory-shared.css">
<script src="observatory-theme.js"></script>
<script src="observatory-appearance.js" defer></script>
</head><body class="observatory-page observatory-index">
<header><nav><a href="index.html">Biswajit Jana</a><div><a href="atlas.html">Research atlas</a> · <button class="theme" type="button" aria-label="Switch colour theme">Day / night</button></div></nav><p class="eyebrow">Complete public portfolio · generated from GitHub</p><h1>Research software, indexed by subject.</h1><p class="lede">Every public repository is linked in server-rendered HTML for people and search crawlers. Descriptions come from the repository record; interactive visualizations and code remain one click away.</p><div class="summary"><span><strong>{len(repos)}</strong> public repositories</span><span><strong>{sum(1 for r in repos if live_url(r))}</strong> linked project sites</span><span>Snapshot <strong>{now[:10]}</strong></span></div></header>
<main><section class="controls" aria-label="Catalog controls"><input id="search" type="search" placeholder="Search exoplanets, dark matter, spectroscopy, Gaia…" aria-label="Search repositories"><div class="filters">{''.join(filters)}</div></section><p id="result-count" aria-live="polite">Showing all {len(repos)} repositories</p><section class="grid">{''.join(cards)}</section></main>
<footer>Biswajit Jana · Astronomy, instrumentation and scientific computing · <a href="https://github.com/{OWNER}">GitHub profile</a></footer>
<script>(function(){{const root=document.documentElement,q=document.querySelector('#search'),cards=[...document.querySelectorAll('.project')],buttons=[...document.querySelectorAll('.filter')],count=document.querySelector('#result-count');let active='all';function run(){{const s=q.value.trim().toLowerCase();let n=0;cards.forEach(c=>{{const show=(active==='all'||c.dataset.category===active)&&(!s||c.dataset.search.includes(s));c.hidden=!show;if(show)n++}});count.textContent='Showing '+n+' of {len(repos)} repositories'}}q.addEventListener('input',run);buttons.forEach(b=>b.addEventListener('click',()=>{{active=b.dataset.filter;buttons.forEach(x=>x.classList.toggle('is-active',x===b));run()}}));document.querySelector('.theme').addEventListener('click',()=>{{root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';localStorage.setItem('portfolio-theme',root.dataset.theme)}});root.dataset.theme=localStorage.getItem('portfolio-theme')||'light'}})();</script></body></html>'''


def main() -> None:
    try:
        repos = fetch_repositories()
        DATA_PATH.write_text(json.dumps(snapshot(repos), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except Exception:
        if not DATA_PATH.exists():
            raise
        repos = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    OUT_PATH.write_text(render(repos), encoding="utf-8", newline="\n")
    print(f"Wrote {OUT_PATH.name} with {len(repos)} repositories")


if __name__ == "__main__":
    main()
