"""Cache primary manuscripts and figure metadata for a reproducible local review."""
from pathlib import Path
import concurrent.futures
import json
import sys
import tempfile
import urllib.request
sys.path.insert(0, str(Path(tempfile.gettempdir()) / "portfolio-reading-tools-20261021"))
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
CACHE = (Path(tempfile.gettempdir()) / "portfolio-paper-sources-20261021")
CACHE.mkdir(parents=True, exist_ok=True)
PAPERS = {
 "pepe": "2010.00316",
 "zhao": "2601.02296v1",
 "schmidt": "2603.17908v1",
 "sercel": "2403.10019v2",
 "kreider": "2210.10988v2",
 "khandelwal": "2409.16449v2",
 "luhman": "2506.08969v1",
 "chen": "2503.18510v2",
}
def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent":"Research reading-note source review"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()
def get_paper(item):
    key, version = item
    target = CACHE / (key + ".html")
    if not target.exists():
        target.write_bytes(fetch("https://arxiv.org/html/" + version))
    soup = BeautifulSoup(target.read_bytes(), "html.parser")
    article = soup.find("article") or soup
    (CACHE / (key + ".txt")).write_text(article.get_text(" ", strip=True), encoding="utf-8")
    figures = []
    for figure in article.select("figure.ltx_figure"):
        caption = figure.find("figcaption")
        images = [x.get("src") for x in figure.select("img") if x.get("src")]
        figures.append({"id":figure.get("id"), "caption":caption.get_text(" ",strip=True) if caption else "", "images":images})
    result = {"key":key,"version":version,"license":[a.get_text(" ",strip=True) for a in soup.select("a") if "License:" in a.get_text()],"figures":figures}
    (CACHE / (key + "-figures.json")).write_text(json.dumps(result,indent=2),encoding="utf-8")
    return {"key":key,"figures":len(figures),"characters":len(article.get_text()),"license":result["license"]}
if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(get_paper, PAPERS.items()):
            print(json.dumps(result), flush=True)
