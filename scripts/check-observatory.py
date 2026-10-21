"""Validate the palette-only preview and all standalone journal notes."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.links, self.assets, self.scripts = [], [], [], []
        self.redirect = False
        self.headings = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "a" and "href" in a:
            self.links.append(a["href"])
        if tag in ("script", "img") and "src" in a:
            self.assets.append(a["src"])
        if tag == "script" and "src" in a:
            self.scripts.append(a["src"])
        if tag == "link" and a.get("rel") in ("stylesheet", "icon", "preload"):
            self.assets.append(a.get("href", ""))
        if tag == "meta" and a.get("http-equiv", "").lower() == "refresh":
            self.redirect = True
        if tag == "h1":
            self.headings += 1

failures, legacy_issues, pages = [], [], []
GIT = r"C:\Program Files\Git\cmd\git.exe"
for path in ROOT.rglob("*.html"):
    if any(x in path.parts for x in (".git", ".agents", "design-concepts")):
        continue
    source = path.read_text(encoding="utf-8")
    if "observatory-appearance.js" not in source and path != ROOT / "index.html":
        continue
    parsed = Page()
    parsed.feed(source)
    baseline = Page()
    original = subprocess.run(
        [GIT, "show", "HEAD:" + path.relative_to(ROOT).as_posix()],
        capture_output=True, encoding="utf-8", errors="replace"
    )
    if original.returncode == 0:
        baseline.feed(original.stdout)
    pages.append(str(path.relative_to(ROOT)))
    if sum(s.endswith("observatory-theme.js") for s in parsed.scripts) != 1:
        failures.append(f"{path}: expected one theme bootstrap")
    if len(parsed.ids) != len(set(parsed.ids)):
        target = legacy_issues if len(baseline.ids) != len(set(baseline.ids)) else failures
        target.append(f"{path.relative_to(ROOT)}: duplicate IDs")
    for ref in parsed.assets + parsed.links:
        url = urlsplit(ref)
        if url.scheme or url.netloc:
            continue
        if not url.path:
            if url.fragment and unquote(url.fragment) not in parsed.ids:
                failures.append(f"{path.relative_to(ROOT)}: missing #{url.fragment}")
            continue
        target = (path.parent / unquote(url.path)).resolve()
        if not target.exists():
            issues = legacy_issues if ref in baseline.assets + baseline.links else failures
            issues.append(f"{path.relative_to(ROOT)}: missing {ref}")
    if path == ROOT / "index.html":
        for required in ("top", "main", "snapshot", "about", "skills", "research", "outputs", "tools", "writing", "contact", "playground"):
            if required not in parsed.ids:
                failures.append(f"Homepage lost section: {required}")
        if "photo-frame" not in source or "profile%20image.png" not in source:
            failures.append("Homepage lost the original portrait")
        if "opticalBench" in source or "dopplerLab" in source:
            failures.append("Rejected redesign still mounted on homepage")

notes = []
for path in sorted((ROOT / "paper-journal/papers").glob("*/index.html")):
    source = path.read_text(encoding="utf-8")
    parsed = Page()
    parsed.feed(source)
    if parsed.redirect or parsed.headings != 1:
        failures.append(f"{path.parent.name}: not a standalone article")
    if "arxiv.org/" not in source:
        failures.append(f"{path.parent.name}: missing primary source")
    if "pepe-2021" not in path.parent.name and re.search(r"Figure file pending|files can be uploaded|class=\"placeholder\"", source):
        failures.append(f"{path.parent.name}: unfinished figure placeholder")
    notes.append(path.parent.name)
journal = (ROOT / "paper-journal/index.html").read_text(encoding="utf-8")
if "defaultArticle" in journal or "p?article(p):home()" in journal:
    failures.append("Legacy query routes still render generic summaries")
print(json.dumps({"pages_checked": len(pages), "standalone_notes": len(notes), "new_failures": failures, "preexisting_blog_issues": legacy_issues}, indent=2))
raise SystemExit(bool(failures))
