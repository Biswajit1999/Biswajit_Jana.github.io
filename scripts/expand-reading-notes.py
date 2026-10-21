"""Render extended analysis and attributed source-figure readings into static notes."""
from pathlib import Path
from html import escape
import json
import re
import sys
import tempfile
sys.path.insert(0, str(Path(tempfile.gettempdir()) / "portfolio-reading-tools-20261021"))
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/"paper-journal/deep-readings.json").read_text(encoding="utf-8"))
RELEASE=(ROOT/"data/website-release.json").exists()
report=[]
for key,content in DATA.items():
    folder=next((ROOT/"paper-journal/papers").glob(key+"-*"))
    page=folder/"index.html"
    source=page.read_text(encoding="utf-8")
    source=re.sub(r'<section class="article-card" id="deep-reading"[^>]*>.*?</section>', '', source, flags=re.S)
    source=re.sub(r'<!-- reading-source-panels:start -->.*?<!-- reading-source-panels:end -->', '', source, flags=re.S)
    manifest=json.loads((folder/"plots/figure-provenance.json").read_text(encoding="utf-8"))
    src="https://arxiv.org/html/"+manifest["version"]
    deep='<section class="article-card" id="deep-reading"><span class="analysis-label">Extended reading · methods, assumptions and interpretation</span><h2>Following the full technical argument</h2>'
    for title,paras in content["sections"]:
        deep+='<h3>'+escape(title)+'</h3>'+''.join('<p>'+escape(p)+'</p>' for p in paras)
    deep+='<p class="source-note">Reading based on the full manuscript, including methods and discussion—not only its abstract. These explanations are original commentary; they are not a reproduced analysis or new experiment. <a href="'+src+'">Original manuscript</a> · expanded 21 October 2026.</p></section>'
    show_panels=not RELEASE or 'CC BY' in manifest['license']
    figures='<p>Read the paper plots alongside the explanations below. Each discussion keeps its source figure number and links to the original caption and context. Openly licensed panels are shown here; other figures open at the original paper. The explanations distinguish the plotted evidence from what it cannot establish.</p>'
    for number,title,axes,reading,limits in content["figures"]:
        f=next(x for x in manifest["figures"] if x["number"]==number)
        figures+='<figure class="fig-card paper-figure" id="paper-figure-'+str(number)+'"><figcaption><span class="analysis-label">Source paper · Figure '+str(number)+('</span><h3>'+escape(title)+'</h3>')
        if f["partial"]:figures+='<p class="source-note">Selected BD01 panels only; the full multi-object figure is available at the source.</p>'
        figures+='</figcaption><div class="paper-panels">'
        for i,p in enumerate(f["panels"] if show_panels else [],1):
            preview=p["path"] if p["path"].endswith(".svg") else p.get("preview",p["path"])
            relative=Path(preview).relative_to(folder.relative_to(ROOT)).as_posix()
            figures+='<a class="paper-panel" href="'+relative+'" target="_blank" rel="noopener" aria-label="Enlarge source Figure '+str(number)+', panel '+str(i)+'"><img src="'+relative+'" alt="'+escape(title)+' — published Figure '+str(number)+', panel '+str(i)+'" loading="lazy" decoding="async"'+(' width="'+str(p["width"])+'" height="'+str(p["height"])+'"' if "width" in p else '')+'></a>'
        figures+='</div><dl class="figure-reading"><dt>How to read the axes and panels</dt><dd>'+escape(axes)+'</dd><dt>What the plot is telling me</dt><dd>'+escape(reading)+'</dd><dt>What it does not establish</dt><dd>'+escape(limits)+'</dd></dl>'
        credit='CC BY 4.0; author/source attribution retained. No data, axes or annotations have been redrawn.' if 'CC BY' in manifest["license"] else 'Original author/publisher rights retained. Open the figure at the source alongside this commentary; no additional copy is distributed here.'
        figures+='<p class="source-note"><a href="'+src+'#'+f["anchor"]+'" target="_blank" rel="noopener">Source Figure '+str(number)+' and original caption ↗</a> · '+escape(credit)+'</p></figure>'
    if key=="pepe":
        marker='<section class="article-card" id="figures">'
        start=source.index(marker)
        end=source.index('<section class="article-card" id="references">',start)
        original=source[start:end]
        replacement=original[:-len("</section>")]+'<!-- reading-source-panels:start --><h3>Further source figures: reduction, sensitivity and science cases</h3>'+figures+'<!-- reading-source-panels:end --></section>'
    else:
        start=source.index('<section class="article-card" id="figures">')
        end=source.index('<section class="article-card" id="references">',start)
        replacement='<section class="article-card" id="figures"><h2>Paper plots, explained in detail</h2>'+figures+'</section>'
    source=source[:start]+deep+replacement+source[end:]
    if '<a href="#deep-reading">' not in source:
        source=source.replace('<li><a href="#figures">','<li><a href="#deep-reading">Full technical argument</a></li><li><a href="#figures">')
    source=source.replace("Source-checked: 20 Oct 2026","Expanded: 21 Oct 2026").replace("Source review: 20 October 2026","Expanded source review: 21 October 2026")
    if "reading-note.css" not in source:source=source.replace("</head>",'<link rel="stylesheet" href="../../reading-note.css">\n</head>')
    if "paper-reader.js" not in source:source=source.replace("</head>",'<script src="../../paper-reader.js" defer></script>\n</head>')
    # A generated block carries a stable marker so future runs do not duplicate it.
    source=source.replace('id="deep-reading"','id="deep-reading" data-reading-expansion="2026-10-21"')
    if RELEASE:
        source=source.replace('Reading draft · 21 Oct 2026','Reading note · 21 Oct 2026')
        source=source.replace('Full-text technical reading · author review pending','Full-text technical reading')
        source=source.replace('This reading draft should be checked by the portfolio author before publication.','Published as a critical reading note on 21 October 2026.')
        source=source.replace('Source-paper excerpts are retained for this local critical-reading preview; public redistribution requires a separate rights review.','Figures without confirmed redistribution permission are linked at the original paper rather than copied here.')
    page.write_text(source,encoding="utf-8")
    soup=BeautifulSoup(source,"html.parser")
    for script in soup(["script","style"]):script.decompose()
    words=len(soup.select_one("main").get_text(" ",strip=True).split())
    count=len(manifest["figures"])+(11 if key=="pepe" else 0)
    report.append({"slug":folder.name,"words":words,"figures":count,"estimated_minutes":round(words/180+count*.75)})
(ROOT/"paper-journal/reading-audit.json").write_text(json.dumps(report,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,indent=2))
