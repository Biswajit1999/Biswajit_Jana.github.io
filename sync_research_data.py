#!/usr/bin/env python3
"""
Keeps data/full-portfolio.json in sync with what's actually on GitHub.

    python sync_research_data.py

What it does:
  1. Lists every non-fork repo under github.com/Biswajit1999 (via `gh api`,
     so it needs the GitHub CLI installed and logged in — same tool this
     manifest was originally built with).
  2. Any repo not already in the manifest gets added as a STUB entry using
     only real GitHub metadata (description, topics, homepage) — nothing
     invented. Stubs are marked "needs_review": true and get a generic
     "astro-lab" type guess that you (or a future Claude session) should
     correct once the README has actually been read.
  3. Any manifest entry whose repo no longer exists on GitHub is flagged in
     the printed report (never silently deleted — you decide).
  4. Refreshes `pushed_at` / `github_description` on every existing entry
     so you can see which repos have been updated since the manifest was
     last written, without touching any of the researched narrative fields
     (title, summary, headline, evidence_status, etc.) — those only change
     if a human (or an assisted session) actually reads the new README.

After running this, regenerate the page and graph:

    python build_atlas.py
    python build_research_graph.py

This does NOT call an LLM and does NOT write any narrative content for new
repos beyond what GitHub's own API returns — stub entries are intentionally
bare so nobody mistakes a stub for a researched entry.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent
DATA_PATH = ROOT / "data" / "full-portfolio.json"
OWNER = "Biswajit1999"
EXCLUDE_SLUGS = {"Biswajit1999", "Biswajit_Jana.github.io"}


def gh_json(args):
    result = subprocess.run(["gh"] + args, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def list_repos():
    result = subprocess.run(
        ["gh", "api", f"users/{OWNER}/repos", "--paginate", "--jq",
         ".[] | select(.fork==false) | {name, description, homepage, has_pages, topics, pushed_at, default_branch}"],
        capture_output=True, text=True, check=True,
    )
    repos = []
    for line in result.stdout.strip().splitlines():
        if line.strip():
            repos.append(json.loads(line))
    return {r["name"]: r for r in repos if r["name"] not in EXCLUDE_SLUGS}


def make_stub(slug, meta):
    live_url = meta.get("homepage") or (f"https://biswajit1999.github.io/{slug}/" if meta.get("has_pages") else None)
    return {
        "slug": slug,
        "type": "astro-lab",  # best-guess default; correct once the README is actually read
        "status": "active",
        "title": slug.replace("-", " ").replace("_", " ").title(),
        "summary": meta.get("description") or "",
        "headline": None,
        "evidence_status": None,
        "evidence_status_note": None,
        "category": None,
        "planet_class": None,
        "tech_or_instruments": [],
        "datasets": [],
        "methods": [],
        "molecules": [],
        "headline_stat": None,
        "tags": meta.get("topics", []),
        "github_url": f"https://github.com/{OWNER}/{slug}",
        "live_report_url": live_url,
        "thumbnail_url": None,
        "thumbnail_attribution": None,
        "thumbnail_type": "none-found",
        "needs_review": True,
        "github_description": meta.get("description"),
        "github_pushed_at": meta.get("pushed_at"),
        "detail": {"slug": slug, "note": "stub entry added by sync_research_data.py, not yet researched"},
    }


def main():
    if not DATA_PATH.exists():
        print(f"ERROR: {DATA_PATH} does not exist yet.", file=sys.stderr)
        sys.exit(1)

    with open(DATA_PATH, encoding="utf-8") as f:
        manifest = json.load(f)
    by_slug = {e["slug"]: e for e in manifest}

    print("Fetching current repo list from GitHub...")
    live_repos = list_repos()

    new_slugs = sorted(set(live_repos) - set(by_slug))
    missing_slugs = sorted(set(by_slug) - set(live_repos))
    existing_slugs = sorted(set(by_slug) & set(live_repos))

    for slug in new_slugs:
        stub = make_stub(slug, live_repos[slug])
        manifest.append(stub)
        print(f"  + added stub for new repo: {slug}")

    for slug in existing_slugs:
        entry = by_slug[slug]
        meta = live_repos[slug]
        entry["github_description"] = meta.get("description")
        entry["github_pushed_at"] = meta.get("pushed_at")

    if missing_slugs:
        print("\nWARNING: these manifest entries no longer exist on GitHub (not removed automatically):")
        for slug in missing_slugs:
            print(f"  - {slug}")

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\nManifest now has {len(manifest)} entries ({len(new_slugs)} new stub(s), {len(existing_slugs)} refreshed).")
    if new_slugs:
        print("New repos are stubs — ask a Claude session to research them properly (read the README,")
        print("fill in title/summary/headline/type/instruments) before they look finished on the page.")
    print("\nNext: python build_atlas.py && python build_research_graph.py")


if __name__ == "__main__":
    main()
