"""Render authored note data using the established standalone journal template."""
from pathlib import Path
from html import escape as e
import csv
import io
import json
import re
import sys
import tempfile
sys.path.insert(0,str(Path(tempfile.gettempdir())/'portfolio-reading-tools-20261021'))
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'paper-journal/additional-readings.json').read_text(encoding='utf-8'))
for extra in ['molliere','kreidberg']:
    DATA.update(json.loads((ROOT/('paper-journal/'+extra+'-additional-reading.json')).read_text(encoding='utf-8')))
TEMPLATE=ROOT/'paper-journal/papers/sercel-2024-thermal-control-delay-lines/index.html'
template=BeautifulSoup(TEMPLATE.read_text(encoding='utf-8'),'html.parser')
deep=json.loads((ROOT/'paper-journal/deep-readings.json').read_text(encoding='utf-8'))
records=[]
def paras(items):return ''.join('<p>'+e(p)+'</p>' for p in items)
def section(anchor,title,text,label='Interpretation and technical reasoning'):
    return '<section class="article-card" id="'+anchor+'"><span class="analysis-label">'+e(label)+'</span><h2>'+e(title)+'</h2>'+paras(text)+'</section>'
for key,n in DATA.items():
    folder=ROOT/'paper-journal/papers'/n['slug']
    folder.mkdir(exist_ok=True)
    head=BeautifulSoup(str(template.head),'html.parser')
    head.title.string=n['title']+' | Biswajit Jana'
    head.find('meta',attrs={'name':'description'})['content']=n['subtitle']
    head.find('link',rel='canonical')['href']='https://biswajit1999.github.io/Biswajit_Jana.github.io/paper-journal/papers/'+n['slug']+'/'
    source='https://arxiv.org/html/'+n['version']
    nav=str(template.nav)
    toc=[('overview','Overview'),('results','What the authors report'),('evidence','Evidence and boundaries'),('argument','The measurement chain')]+[(s[0],s[1]) for s in n['sections']]+[('connection','Connection to my work'),('tests','Proposed follow-up'),('deep-reading','Full technical argument'),('figures','Paper plots, explained'),('references','Sources and scope')]
    side='<aside class="left-rail"><div class="rail-card"><h3>Navigate</h3><ul class="section-nav">'+''.join('<li><a href="#'+anchor+'">'+e(title)+'</a></li>' for anchor,title in toc)+'</ul></div><div class="rail-card"><h3>Quick links</h3><div class="mini-links"><a href="../../index.html">← All readings</a><a href="'+source+'">Version used ↗</a><a href="https://arxiv.org/pdf/'+n['version']+'">Paper PDF ↗</a></div></div></aside>'
    hero='<header class="hero wide"><div class="hero-grid"><div class="hero-copy"><div class="eyebrow">'+e(n['theme'])+'</div><h1>'+e(n['title'])+'</h1><p class="subtitle">'+e(n['subtitle'])+'</p><div class="meta-row"><span class="pill">'+e(n['authors'])+' ('+n['year']+')</span><span class="pill">'+e(n['venue'])+'</span><span class="pill">Reading draft · 21 Oct 2026</span></div></div><figure class="hero-card"><img src="hero.webp" width="1400" height="933" alt="Conceptual journal artwork: '+e(n['art_alt'])+'"><figcaption class="hero-caption">AI-generated conceptual artwork—not the authors’ apparatus, an observation, or a source-paper figure.</figcaption></figure></div></header>'
    main='<main class="story" id="main"><div class="story-head" id="overview"><div class="eyebrow">Full-text technical reading · author review pending</div><h2>What this note follows</h2>'+paras(n['overview'])+'</div><article aria-label="Technical reading note">'
    main+=section('results','What the authors report',n['findings'],'Source findings · see the pinned manuscript')
    main+='<section class="article-card" id="evidence"><span class="analysis-label">Interpretation</span><h2>Evidence and boundaries</h2><div class="table-scroll" role="region" tabindex="0" aria-label="Evidence comparison"><table class="data-table"><thead><tr><th scope="col">Evidence</th><th scope="col">What it addresses</th><th scope="col">Boundary</th></tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+e(x)+'</td>' for x in row)+'</tr>' for row in n['evidence'])+'</tbody></table></div></section>'
    main+='<section class="article-card" id="argument"><span class="analysis-label">Original reading aid · not measured data</span><h2>The measurement chain</h2><ol class="argument-flow">'+''.join('<li>'+e(x)+'</li>' for x in n['chain'])+'</ol></section>'
    for anchor,title,ps in n['sections']:main+=section(anchor,title,ps)
    main+=section('connection','Connection to my work',n['connection'],'Portfolio connection · not a claim of participation in this paper')
    main+=section('tests','Tests I would run next',n['tests'],'Proposed work · not performed')
    main+='<section class="article-card" id="figures"><h2>Paper plots, explained</h2></section>'
    main+='<section class="article-card" id="references"><h2>Sources and scope</h2><ol class="refs"><li id="ref1">'+e(n['authors'])+' ('+n['year']+'). <em>'+e(n['title'])+'</em>. '+e(n['venue'])+'. <a href="'+source+'">Full text used: arXiv:'+n['version']+'</a> · <a href="https://arxiv.org/abs/'+n['version'].split('v')[0]+'">Version history</a>.</li></ol><p>These are original explanations and critical reading notes, not a reproduction of the authors’ analysis. No new observation, dataset reanalysis, or experimental result is claimed. Paper figures retain their original numbering and source links. The cover is illustrative artwork. This reading draft should be checked by the portfolio author before publication.</p><p class="source-note">Figure rights: the arXiv perpetual hosting licence is not a blanket reuse licence. Source-paper excerpts are retained for this local critical-reading preview; public redistribution requires a separate rights review.</p></section></article></main>'
    right='<aside class="right-rail"><div class="rail-card"><h3>Reading map</h3><div class="fact-grid" style="grid-template-columns:1fr"><div class="fact"><strong>Why this paper</strong><span>'+e(n['why'])+'</span></div><div class="fact"><strong>Version pinned</strong><span>arXiv:'+n['version']+'</span></div><div class="fact"><strong>Evidence boundary</strong><span>Literature commentary. Proposed tests have not been performed.</span></div></div></div><div class="rail-card"><h3>Continue reading</h3><a class="post-card" href="../../index.html"><h4>Explore all thirteen readings →</h4></a><a class="post-card" href="../../../cv.html"><h4>My research and training context →</h4></a></div></aside>'
    page='<!DOCTYPE html>\n<html lang="en">'+str(head)+'<body class="observatory-page observatory-article"><a class="skip-link" href="#main">Skip to reading note</a>'+nav+hero+'<section class="journal wide"><div class="journal-grid">'+side+main+right+'</div></section><footer>© 2026 Biswajit Jana · Research Reading Journal · <a href="../../index.html">All readings</a></footer></body></html>'
    (folder/'index.html').write_text(page,encoding='utf-8')
    deep[key]={'sections':n['deep_sections'],'figures':n['figures']}
    records.append({'slug':n['slug'],'title':n['title'],'short':n['authors'],'year':n['year'],'theme':n['theme'],'venue':n['venue'],'read':str(len(n['figures']))+' source figures · full-text reading','subtitle':n['subtitle'],'summary':n['why'],'ext':'webp','source':'https://arxiv.org/abs/'+n['version'].split('v')[0]})
    if key=='schmidt2024':records[-1]['featuredTitle']='ESPRESSO: beyond a Gaussian line profile'
(ROOT/'paper-journal/deep-readings.json').write_text(json.dumps(deep,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
index=ROOT/'paper-journal/index.html'
html=index.read_text(encoding='utf-8')
html=re.sub(r'// additional-readings:start[\s\S]*?// additional-readings:end\n','',html)
html=html.replace('function e(s)', '// additional-readings:start\nP.unshift(...'+json.dumps(records,ensure_ascii=False)+');\n// additional-readings:end\nfunction e(s)',1)
html=html.replace('8 expanded readings · 62 paper figures','13 expanded readings · 89 paper figures')
html=html.replace('${e(f.title)}</h2>','${e(f.featuredTitle||f.title)}</h2>')
html=html.replace('Extended readings on instruments, brown dwarfs, calibration systems and detectors','Extended readings on instruments, brown dwarfs, calibration, detectors, atmospheres and transit modelling')
index.write_text(html,encoding='utf-8')
# Preserve the existing eight tracker records and replace only these five drafts.
tracker=ROOT/'paper-journal/internal/research-reading-tracker.csv'
rows=list(csv.DictReader(io.StringIO(tracker.read_text(encoding='utf-8'))))
slugs={n['slug'] for n in DATA.values()}
rows=[r for r in rows if r['Slug'] not in slugs]
for n in DATA.values():
    rows.append({'Slug':n['slug'],'Title':n['title'],'Authors':n['authors'],'Year':n['year'],'Theme':n['theme'],'Status':'Full-text reading draft — 21 October 2026','Read Time':str(len(n['figures']))+' source figures','Next Action':'Author review and figure-permission check before publication'})
buffer=io.StringIO(newline='')
writer=csv.DictWriter(buffer,fieldnames=['Slug','Title','Authors','Year','Theme','Status','Read Time','Next Action'],lineterminator='\n')
writer.writeheader();writer.writerows(rows)
tracker.write_text(buffer.getvalue(),encoding='utf-8',newline='\n')
print('Rendered',len(records),'additional standalone readings')
