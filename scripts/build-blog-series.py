"""Render the approved eight-topic series into static pages.

Source prose is edited in blog/series-2026/*.md. This script does not publish,
commit or push. Requires markdown, numpy, matplotlib and Pillow.
"""
from pathlib import Path
from html import escape
import csv
import hashlib
import json
import math
import re
import os
import argparse
import xml.etree.ElementTree as ET
import markdown
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SERIES = ROOT / 'blog/series-2026'
SOURCES = SERIES / 'sources'
FIGURES = SERIES / 'figures'
COVERS = SERIES / 'covers'
DATE = '2026-10-21'
PUBLIC = 'https://biswajit1999.github.io/Biswajit_Jana.github.io/'
MANIFEST = json.loads((SERIES / 'manifest.json').read_text(encoding='utf-8'))
LEDGER = json.loads((SERIES / 'provenance.json').read_text(encoding='utf-8'))
FIGURE_RECORDS = []
RELEASE_PATH = ROOT / 'data/website-release.json'
RELEASE = json.loads(RELEASE_PATH.read_text(encoding='utf-8')) if RELEASE_PATH.exists() else None
STATUS = 'published' if RELEASE else 'local-review'

def read_json(path):
    return json.loads((SOURCES / path).read_text(encoding='utf-8'))

def figure(name, title, kind, inputs, draw):
    fig, ax = plt.subplots(figsize=(10, 5.85), layout='constrained')
    draw(fig, ax)
    fig.set_layout_engine('constrained', rect=(0, .065, 1, .935))
    fig.suptitle(title, fontsize=15, fontweight='bold', x=.06, ha='left')
    fig.text(.06, .012, kind, fontsize=8, color='#536575')
    fig.savefig(FIGURES / name, dpi=140, facecolor='#f5f7f8')
    plt.close(fig)
    FIGURE_RECORDS.append({'file': name, 'kind': kind, 'inputs': inputs,
                           'script': 'scripts/build-blog-series.py',
                           'sha256': hashlib.sha256((FIGURES/name).read_bytes()).hexdigest()})

def plots():
    FIGURES.mkdir(exist_ok=True)
    plt.rcParams.update({'axes.spines.top': False, 'axes.spines.right': False,
                         'axes.facecolor': '#f5f7f8', 'axes.labelcolor': '#182533',
                         'xtick.color': '#536575', 'ytick.color': '#536575',
                         'font.size': 11, 'savefig.bbox': 'tight', 'axes.titlepad': 15})
    def control(fig, ax):
        t = np.linspace(0, 12, 600)
        series = {'Slow': np.exp(-t/4), 'Damped': (1+t)*np.exp(-t),
                  'Oscillatory': np.exp(-t/3)*np.cos(2*t)}
        with (FIGURES/'control-response.csv').open('w', newline='', encoding='utf-8') as stream:
            writer=csv.writer(stream); writer.writerow(['normalised_time', *series])
            writer.writerows(zip(t, *series.values()))
        for (name, y), color in zip(series.items(), ['#426895','#086f70','#a05c40']):
            ax.plot(t, y, label=name, color=color, lw=2)
        ax.axhline(0, color='#9eafb7', lw=.8)
        ax.set(xlabel='Normalised time (dimensionless)', ylabel='Normalised residual (dimensionless)')
        ax.legend(frameon=False)
    figure('control-response.png', 'Different responses to the same initial disturbance',
           'ILLUSTRATIVE SIMULATION | Not measured EXOhSPEC data', [], control)

    with (SOURCES/'gaia-dr3.csv').open(encoding='utf-8') as stream:
        stars=list(csv.DictReader(stream))
    assert len(stars)==6000
    colour=np.array([float(s['bp_rp']) for s in stars])
    absolute=np.array([float(s['phot_g_mean_mag'])+5*np.log10(float(s['parallax']))-10 for s in stars])
    def gaia(fig, ax):
        scatter=ax.scatter(colour, absolute, c=colour, cmap='coolwarm', s=4, alpha=.65, linewidths=0)
        ax.set(xlabel='Gaia BP - RP colour (mag)', ylabel='Absolute Gaia G magnitude (mag)')
        ax.invert_yaxis()
        fig.colorbar(scatter, ax=ax, label='BP - RP (mag)')
    figure('gaia-cmd.png', '6,000 real Gaia DR3 stars: colour and absolute magnitude',
           'OBSERVED CATALOGUE | Declared nearby-star selection; no extinction correction', ['gaia-dr3.csv'], gaia)

    summary=read_json('rv-activity-disentangler/research/neid-variability-summary.json')
    sensitivity=summary['analyses']['quality_selection_sensitivity']
    def neid(fig, ax):
        ax.remove(); axes=fig.subplots(1,2)
        x=[s['snr_minimum'] for s in sensitivity]
        axes[0].plot(x,[s['rv_rms_mps'] for s in sensitivity], 'o-', color='#086f70')
        axes[1].plot(x,[s['count'] for s in sensitivity], 's-', color='#426895')
        for axis,label in zip(axes,['Relative RV RMS (m/s)','Retained exposures (count)']):
            axis.set(xlabel='Minimum extracted S/N', ylabel=label, xticks=x)
    figure('neid-selection.png','Lower scatter, different retained sample',
           'OBSERVED ARCHIVE SUMMARY | Overlapping quality selections, not independent experiments',
           ['rv-activity-disentangler/research/neid-variability-summary.json'],neid)
    def nights(fig, ax):
        rows=summary['analyses']['nightly_weighted_variability']
        ax.plot(range(4),[s['observed_rms_mps'] for s in rows],'o-',color='#086f70')
        ax.set(xticks=range(4),xticklabels=[str(s['bjd_day']) for s in rows],xlabel='BJD day',ylabel='Nightly observed RV RMS (m/s)')
        for i,s in enumerate(rows):
            ax.annotate(f"n = {s['count']}",(i,s['observed_rms_mps']),xytext=(0,12),textcoords='offset points',ha='center')
        ax.margins(y=.22,x=.1)
    figure('neid-nights.png','The fourth observed night dominates the loose-cut scatter',
           'OBSERVED ARCHIVE SUMMARY | Four nights, not continuous 13-day coverage',
           ['rv-activity-disentangler/research/neid-variability-summary.json'],nights)

    survey=read_json('2mrs-positions.json')['objects']
    def cosmic(fig, ax):
        ax.remove(); axes=fig.subplots(1,2)
        ra=np.array([s['ra_deg'] for s in survey]); dec=np.array([s['dec_deg'] for s in survey])
        z=np.array([s['redshift'] for s in survey])
        p=axes[0].scatter(ra,dec,c=z,s=.4,cmap='viridis',vmin=0,vmax=.08,rasterized=True)
        axes[0].set(xlabel='Right ascension (deg)',ylabel='Declination (deg)',xlim=(0,360),ylim=(-90,90))
        fig.colorbar(p,ax=axes[0],label='Redshift z',shrink=.7)
        axes[1].hist(z,bins=50,color='#086f70')
        axes[1].set(xlabel='Measured redshift z',ylabel='Catalogue records per bin')
    figure('2mrs-survey.png','2MRS: the footprint and the redshift selection',
           'OBSERVED CATALOGUE | 43,533 records; no completeness correction; sky projection not equal-area',
           ['2mrs-positions.json'],cosmic)

    earth_summary=read_json('finding-earth-2/results/analysis_summary.json')
    def earth(fig, ax):
        labels=['Source records','Confirmed planets','Conservative HZ','Small + temperate','Independent mass in shortlist']
        hz=earth_summary['habitable_zone']
        counts=[earth_summary['scale']['total_source_records'],
                earth_summary['population']['n_confirmed_planets'],
                hz['n_in_conservative_hz_nominal'],
                hz['n_conservative_hz_and_below_1p6_re'],
                hz['n_conservative_hz_and_below_1p6_re_with_measured_mass']]
        ax.scatter(counts,range(5),s=85,color='#086f70',zorder=3)
        for i,n in enumerate(counts):
            ax.plot([1,n],[i,i],color='#bacbd1',lw=1)
            ax.annotate(f'{n:,}',(n,i),xytext=(10,0),textcoords='offset points',va='center')
        ax.set(xscale='log',xlim=(.75,1300000),yticks=range(5),yticklabels=labels,xlabel='Reported count (logarithmic axis)')
        ax.invert_yaxis()
    figure('earth-evidence.png','A selection funnel, not a probability of life',
           'PROJECT SNAPSHOT | Source-record and unique-planet counts have different denominators',
           ['finding-earth-2/results/analysis_summary.json'],earth)

    roman=read_json('coronagraph-dark-hole-lab/public/data/roman-hlc-os11.json')
    def coronagraph(fig, ax):
        p=ax.imshow(roman['grid'],origin='lower',cmap='viridis',extent=(-1,1,-1,1),vmin=0,vmax=1,interpolation='nearest')
        ax.set(xlabel='Normalised horizontal grid coordinate',ylabel='Normalised vertical grid coordinate')
        fig.colorbar(p,ax=ax,label='Relative off-axis PSF peak transmission')
    figure('roman-throughput.png','Roman CGI OS11 v3: sky transmission, not contrast',
           'INSTRUMENT-TEAM SIMULATION | Roman CGI team / JPL / IPAC; not on-sky data',
           ['coronagraph-dark-hole-lab/public/data/roman-hlc-os11.json'],coronagraph)

    def wilson(rate,n):
        z=1.95996398454; denominator=1+z*z/n
        centre=(rate+z*z/(2*n))/denominator
        radius=z*np.sqrt(rate*(1-rate)/n+z*z/(4*n*n))/denominator
        return np.array([rate-(centre-radius),(centre+radius)-rate])
    for file,out,title,xkey,methods,xlabel in [
        ('benchmark_results.csv','transit-recovery.png','The baseline wins in this synthetic benchmark','mean_snr',
         [('bls_recovery_rate','BLS'),('scattering_recovery_rate','Scattering proxy')],'Recorded mean injected S/N'),
        ('flare_robustness_results.csv','transit-flares.png','Flare cleaning does not reliably rescue recovery','flare_rate_per_day',
         [('bls_recovery_rate','BLS'),('flare_robust_recovery_rate','Wavelet-clean + BLS')],'Injected flare rate (events/day)')]:
        with (SOURCES/'TransitScatter/results'/file).open(encoding='utf-8') as stream:
            rows=list(csv.DictReader(stream))
        def transit(fig,ax,rows=rows,xkey=xkey,methods=methods,xlabel=xlabel):
            x=[float(r[xkey]) for r in rows]
            for (key,label),color,marker in zip(methods,['#086f70','#a05c40'],['o','s']):
                rates=np.array([float(r[key]) for r in rows]); ns=[int(r['n_trials']) for r in rows]
                errors=np.column_stack([wilson(p,n) for p,n in zip(rates,ns)])
                ax.errorbar(x,rates,yerr=errors,fmt=marker+'-',color=color,label=label,capsize=4,lw=1.5)
            ax.set(xlabel=xlabel,ylabel='Injected-period recovery fraction',ylim=(-.04,1.09))
            ax.legend(frameon=False)
        figure(out,title,'SYNTHETIC BENCHMARK | 95% Wilson intervals; simulation-conditional recovery',
               ['TransitScatter/results/'+file],transit)
    def thermal(fig,ax):
        temperature=np.linspace(0,.05,160)
        for alpha,label,color in [(23e-6,'23 micrometres / m / K','#a05c40'),(5e-6,'5 micrometres / m / K','#426895'),(1e-6,'1 micrometre / m / K','#086f70')]:
            ax.plot(temperature,alpha*.5*temperature*1e9,label=label,color=color,lw=2)
        ax.set(xlabel='Temperature change (K)',ylabel='Length change for L = 0.5 m (nm)')
        ax.legend(frameon=False,title='Illustrative expansion coefficient')
    figure('thermal-expansion.png','Small temperature changes, measurable dimensional changes',
           'CALCULATED ILLUSTRATION | Uniform expansion; no conversion to EXOhSPEC RV error',[],thermal)

    def gaia_selection(fig,ax):
        ax.remove(); axes=fig.subplots(1,2,sharex=True,sharey=True)
        distance=np.array([1000/float(s['parallax']) for s in stars])
        for axis,mask,label in [(axes[0],np.ones(len(stars),dtype=bool),'All 6,000 selected stars'),
                                (axes[1],distance<100,'Subset inside 100 pc')]:
            axis.scatter(colour[mask],absolute[mask],s=3,color='#086f70',alpha=.6,linewidths=0)
            axis.set_title(f'{label}\nn = {int(mask.sum()):,}',fontsize=11)
            axis.set(xlabel='BP - RP (mag)')
        axes[0].set(ylabel='Absolute Gaia G magnitude (mag)'); axes[0].invert_yaxis()
    figure('gaia-distance-selection.png','A distance cut changes the population you see',
           'OBSERVED SAMPLE SUBSETS | Neither panel is a completeness-corrected volume census',['gaia-dr3.csv'],gaia_selection)

    def lag(fig,ax):
        rows=summary['analyses']['irregular_cadence_structure_function']
        x=np.array([np.sqrt(r['lag_low_days']*r['lag_high_days']) for r in rows])
        mid=[r['median_abs_difference_over_sqrt2_mps'] for r in rows]
        ax.fill_between(x,[r['p16_mps'] for r in rows],[r['p84_mps'] for r in rows],color='#086f70',alpha=.13,label='Within-bin 16th-84th percentile')
        ax.plot(x,mid,'o-',color='#086f70',label='Median pair difference / sqrt(2)')
        ax.set(xscale='log',xlabel='Pair separation (days)',ylabel='Absolute pair difference / sqrt(2) (m/s)')
        ax.legend(frameon=False)
    figure('neid-lag.png','Differences grow with lag, but do not identify a unique period',
           'OBSERVED ARCHIVE SUMMARY | Shared pairs; shading is not a confidence interval',
           ['rv-activity-disentangler/research/neid-variability-summary.json'],lag)

    def distances(fig,ax):
        z=np.linspace(0,2,1601); expansion=np.sqrt(.3*(1+z)**3+.7)
        integrand=1/expansion
        integral=np.r_[0,np.cumsum((integrand[1:]+integrand[:-1])*np.diff(z)/2)]
        dc=299792.458/70*integral
        for y,label,color,style in [(dc,'Comoving','#086f70','-'),(dc*(1+z),'Luminosity','#426895','-'),
                                     (dc/(1+z),'Angular diameter','#a05c40','-'),(299792.458/70*z,'Linear cz/H0','#536575','--')]:
            ax.plot(z,y,label=label,color=color,ls=style,lw=2)
        ax.set(xlabel='Redshift z',ylabel='Distance (Mpc)'); ax.legend(frameon=False)
    figure('cosmic-distances.png','Different distance definitions answer different questions',
           'CALCULATED ILLUSTRATION | Flat Omega_m=0.3, Omega_L=0.7, H0=70 km/s/Mpc',[],distances)

    def radius(fig,ax):
        radius=np.linspace(1.1,1.95,600); mean=1.5; sd=mean*np.sqrt(.05**2+.05**2)
        pdf=np.exp(-.5*((radius-mean)/sd)**2)/(sd*np.sqrt(2*np.pi))
        ax.plot(radius,pdf,color='#086f70',lw=2,label='Hypothetical radius distribution')
        ax.fill_between(radius,pdf,where=radius>1.6,color='#a05c40',alpha=.25,label='Above example size cut')
        ax.axvline(1.6,color='#a05c40',ls='--'); ax.set(xlabel='Planet radius (Earth radii)',ylabel='Probability density (per Earth radius)')
        ax.legend(frameon=False)
    figure('radius-boundary.png','A nominal pass can overlap the selection boundary',
           'WORKED EXAMPLE | Hypothetical Gaussian errors; not a posterior for a catalogued planet',[],radius)

    def transmission_cut(fig,ax):
        grid=np.asarray(roman['grid']); index=grid.shape[0]//2
        coordinate=np.linspace(-1,1,grid.shape[0])
        ax.plot(coordinate,grid[index,:],color='#086f70',lw=2,label='Central horizontal row')
        ax.plot(coordinate,grid[:,index],color='#426895',lw=1.5,ls='--',label='Central vertical column')
        ax.set(xlabel='Normalised grid coordinate',ylabel='Relative off-axis PSF peak transmission',ylim=(-.04,1.08))
        ax.legend(frameon=False)
    figure('roman-throughput-cut.png','Read the transmission map along two central cuts',
           'INSTRUMENT-TEAM SIMULATION | Relative peak response, not absolute photon throughput',
           ['coronagraph-dark-hole-lab/public/data/roman-hlc-os11.json'],transmission_cut)

    def template(fig,ax):
        ax.remove(); axes=fig.subplots(2,1,sharex=True)
        time=np.linspace(-3,3,1200); depth=150; flat=.7; half=1.
        model=np.where(np.abs(time)<flat,-depth,np.where(np.abs(time)<half,-depth*(half-np.abs(time))/(half-flat),0))
        box=np.where(np.abs(time)<.85,-depth,0)
        axes[0].plot(time,model,color='#086f70',label='Specified trapezoid')
        axes[0].plot(time,box,color='#426895',ls='--',label='Box comparison')
        derivative=np.abs(np.gradient(model,time)); derivative/=derivative.max()
        axes[1].plot(time,derivative,color='#a05c40',label='Absolute derivative, normalised')
        axes[0].set(ylabel='Relative flux (ppm)'); axes[1].set(xlabel='Time from transit centre (hours)',ylabel='Edge response (normalised)')
        for axis in axes: axis.legend(frameon=False,fontsize=9)
    figure('transit-template.png','A flat dimming and an edge response carry different information',
           'TEACHING ILLUSTRATION | Derivative sketch is not the actual wavelet-scattering output',[],template)
    (SERIES/'figure-provenance.json').write_text(json.dumps(FIGURE_RECORDS,indent=2),encoding='utf-8')

def covers():
    COVERS.mkdir(exist_ok=True)
    prompt_file = os.environ.get('BLOG_COVER_MANIFEST')
    if not prompt_file:
        assert all((COVERS/(p['slug']+'.webp')).exists() for p in MANIFEST)
        return
    for cover in json.loads(Path(prompt_file).read_text(encoding='utf-8')):
        with Image.open(cover['source']) as original:
            im=original.convert('RGB'); im.thumbnail((1440,900))
            im.save(COVERS/(cover['slug']+'.webp'),quality=87)
            im.thumbnail((720,450)); im.save(COVERS/(cover['slug']+'-card.webp'),quality=82)

def render():
    template=(ROOT/'blog/posts/exoplanet-spectroscopy.html').read_text(encoding='utf-8')
    established_css=re.search(r'<style>([\s\S]*?)</style>',template).group(1)
    adaptations='''
    /* Established article template, with only scientific-content additions. */
    .story figure{margin:28px 0}.story figure img{display:block;width:100%;height:auto;border-radius:18px;border:1px solid var(--line);background:#f5f7f8}
    .story figcaption{font:400 .78rem/1.75 var(--sans);color:var(--muted);margin-top:12px}
    .story .citation{color:var(--accent);text-decoration:underline;text-underline-offset:3px}
    .references p{font-size:.95rem;line-height:1.85;color:var(--muted);margin-bottom:20px;overflow-wrap:anywhere}
    .equation .formula{font:500 1.18rem/1.85 var(--serif);color:var(--text);overflow-wrap:anywhere}
    .story table{border-collapse:collapse;font:400 .83rem/1.65 var(--sans);width:100%;margin:24px 0}
    .story th,.story td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:top}
    .story th{color:var(--accent)}.story td{color:var(--muted)}.story .table-wrap{overflow-x:auto}
    .hook,.callout{background:var(--obs-soft)!important;color:var(--obs-text)!important;border-color:var(--obs-line2)!important}
    .lab-launch-card{background:var(--obs-panel)!important;border-color:var(--obs-line)!important}
    .lab-launch-card p{color:var(--obs-muted)}.lab-launch-card h2{color:var(--obs-text)}
    .launch-button{background:var(--obs-accent)!important;color:var(--obs-on-accent)!important}
    .footer{background:var(--obs-bg)!important}.skip-link{position:absolute;left:20px;top:-80px;z-index:60;background:var(--obs-panel);padding:10px}.skip-link:focus{top:12px}
    .chapter,.story-header,.references{scroll-margin-top:100px}.hero-card img{aspect-ratio:1.35}
    @media(min-width:901px){.left-rail{max-height:calc(100dvh - 110px);overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;overscroll-behavior:contain}}
    @media(max-width:900px){.section-nav{grid-template-columns:repeat(2,minmax(0,1fr))}.hero-card img{aspect-ratio:16/9}.story table{font-size:.78rem}}
    @media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
    '''
    css='\n'.join(line.rstrip() for line in (established_css+adaptations).splitlines()).strip()+'\n'
    (SERIES/'article.css').write_text(css,encoding='utf-8')
    reader_details=json.loads((SERIES/'reader-details.json').read_text(encoding='utf-8'))
    metadata=[]; audit=[]
    for i,post in enumerate(MANIFEST):
        slug=post['slug']; raw=(SERIES/(slug+'.md')).read_text(encoding='utf-8')
        if any(dash in raw for dash in ['\u2014','\u2013']):
            raise ValueError('Unexpected separator dash in '+slug)
        # Link author-date citations to their corresponding Harvard references.
        mapping={'Bouchy, Pepe and Queloz (2001)':'bouchy','Robertson et al. (2019)':'robertson',
                 'Jana, 2024':'jana','Jana, 2026':'jana','Bailer-Jones (2015)':'bailer',
                 'Gaia Collaboration, 2018':'gaia2018','Gaia Collaboration, 2023':'gaia2023',
                 'NExScI, n.d.':'nexsci','Pont, Zucker and Queloz, 2006':'pont',
                 'Pont, Zucker and Queloz (2006)':'pont','Anderson and Bedin (2010)':'anderson',
                 'Massey et al. (2014)':'massey','Huchra et al. (2012)':'huchra',
                 'DESI Collaboration, 2025':'desi','Kopparapu et al. (2013)':'kopparapu',
                 'Chen and Kipping (2017)':'chen','Roman CGI instrument team, n.d.':'roman',
                 "Give'on et al. (2007)":'giveon','Groff et al. (2016)':'groff',
                 'Kovács, Zucker and Mazeh, 2002':'kovacs','Hippke and Heller (2019)':'hippke',
                 'Landy and Szalay, 1993':'landy','Give\'on et al., 2007':'giveon',
                 'Groff et al., 2016':'groff','Anderson and Bedin, 2010':'anderson',
                 'Massey et al., 2014':'massey'}
        body=markdown.markdown(raw,extensions=['toc','tables'],output_format='html')
        # Only replace text outside reference section and tags.
        story,refs=body.split('<h2 id="references">',1)
        for citation,key in mapping.items():
            story=re.sub(r'(?<=>)([^<]+)(?=<)',lambda m: m.group(1).replace(citation,f'<a class="citation" href="#ref-{key}">{citation}</a>'),story)
        body=story+'<h2 id="references">'+refs
        body=re.sub(r'<table>([\s\S]*?)</table>',r'<div class="table-wrap"><table>\1</table></div>',body)
        words=len(re.findall(r"\b[\w'-]+\b",re.sub('<[^>]+>',' ',story)))
        reading=max(1,math.ceil(words/210))
        title=escape(post['title']); subtitle=escape(post['subtitle'])
        headings=re.findall(r'<h2 id="([^"]+)">([^<]+)</h2>',body)
        toc=''.join(f'<li><a href="#{anchor}">{label}</a></li>' for anchor,label in headings)
        pieces=re.split(r'<h2 id="([^"]+)">([^<]+)</h2>',body)
        chapter_html=[]
        for chapter in range(1,len(pieces),3):
            anchor,label,content=pieces[chapter:chapter+3]
            css_class='story-header' if chapter==1 else ('references chapter' if anchor=='references' else 'chapter')
            chapter_html.append(f'<section class="{css_class}" id="{anchor}"><h2>{label}</h2>{content}</section>')
        article=''.join(chapter_html)
        details=reader_details[slug]
        facts=''.join(f'<div><span>{escape(k)}</span><strong>{escape(v)}</strong></div>' for k,v in details['facts'])
        glossary=''.join(f'<div class="glossary-item"><strong>{escape(k)}</strong><span>{escape(v)}</span></div>' for k,v in details['glossary'])
        pinned=LEDGER['repositories'][post['repo']]
        schema={'@context':'https://schema.org','@type':'BlogPosting','headline':post['title'],
                'description':post['subtitle'],'author':{'@type':'Person','name':'Biswajit Jana'},
                'dateCreated':DATE,'creativeWorkStatus':'Draft','wordCount':words,
                'image':PUBLIC+'blog/series-2026/covers/'+slug+'.webp'}
        if RELEASE:
            schema['creativeWorkStatus']='Published'
            schema['datePublished']=RELEASE['published']
            schema['url']=PUBLIC+'blog/posts/'+slug+'.html'
        robots='index, follow' if RELEASE else 'noindex, nofollow'
        date_label='Published 21 October 2026' if RELEASE else 'Written 21 October 2026'
        related=MANIFEST[(i+1)%len(MANIFEST)]
        page=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} | Biswajit Jana</title><meta name="description" content="{subtitle}">
<meta name="robots" content="{robots}"><meta property="og:title" content="{title}">
<link rel="canonical" href="{PUBLIC}blog/posts/{slug}.html">
<meta property="og:description" content="{subtitle}"><meta property="og:type" content="article">
<meta property="og:image" content="{PUBLIC}blog/series-2026/covers/{slug}.webp">
<link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,600..900,70,1&family=Space+Grotesk:wght@400;500;600;700&family=Source+Serif+4:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../series-2026/article.css"><link rel="stylesheet" href="../../observatory-shared.css">
<script src="../../observatory-theme.js"></script><script src="../../observatory-appearance.js" defer></script>
<script type="application/ld+json">{json.dumps(schema,ensure_ascii=False).replace('</','<\\/')}</script></head>
<body class="observatory-page observatory-article"><a class="skip-link" href="#article">Skip to article</a>
<nav class="nav" aria-label="Main navigation"><div class="nav-inner wide"><a class="brand" href="../../index.html"><span class="brand-orb" aria-hidden="true"></span>Biswajit <span>Jana</span></a>
<ul class="nav-links"><li><a href="../../index.html">Home</a></li><li><a href="../index.html">Blog</a></li><li><a href="../../index.html#research">Research</a></li><li><a href="../../publications.html">Publications</a></li><li><a href="../../cv.html">CV</a></li><li><button class="theme-toggle" id="themeToggle" type="button" aria-label="Toggle light and dark mode">☾</button></li></ul></div></nav>
<header class="hero wide"><div class="hero-grid"><div><div class="eyebrow">{escape(post['category'])}</div><h1>{title}</h1><p class="hero-sub">{subtitle}</p>
<div class="hook">{escape(details['hook'])}</div><div class="meta-row"><span class="meta-pill">Biswajit Jana</span><span class="meta-pill">{date_label}</span><span class="meta-pill">{reading} min read</span></div></div>
<figure class="hero-card"><img src="../series-2026/covers/{slug}.webp" alt="{escape(details['caption'])}" width="1440" height="810" fetchpriority="high"><figcaption class="hero-caption">{escape(details['caption'])}</figcaption></figure></div></header>
<section class="lab-launch wide"><div class="lab-launch-card"><div><div class="lab-kicker">Research project</div><h2>Explore the work behind this article.</h2><p>Read the methods, inspect the project and follow the underlying evidence.</p></div><a class="launch-button" href="https://github.com/Biswajit1999/{post['repo']}">Open Project</a></div></section>
<section class="journal wide"><div class="journal-grid"><aside class="left-rail"><div class="rail-card"><h3>Navigation Map</h3><ul class="section-nav">{toc}</ul></div><div class="rail-card"><h3>At a glance</h3><div class="telemetry">{facts}</div></div></aside>
<main class="story" id="article"><article class="article-body">{article}</article></main>
<aside class="right-rail"><div class="rail-card"><h3>Glossary, but less boring</h3><div class="glossary">{glossary}</div></div><div class="rail-card"><h3>Related Reading</h3><div class="post-list"><a class="post-card" href="{post['related']}"><div class="post-card-kicker">Background</div><h4>Read the original explainer</h4><p>The foundations behind this project.</p></a><a class="post-card" href="{related['slug']}.html"><div class="post-card-kicker">Continue reading</div><h4>{escape(related['title'])}</h4><p>{escape(related['subtitle'])}</p></a></div></div></aside></div></section>
<footer class="footer"><div class="footer-inner wide"><div>Copyright 2026 Biswajit Jana. All Rights Reserved. // Astrophysics, Instrumentation and Scientific Computing.</div><div><a href="../../index.html">Home Page</a> - <a href="../../publications.html">Visual Archive / Posters and Seminars</a> - <a href="../index.html">All Blog Posts</a></div></div></footer>
<script src="../series-2026/reader.js" defer></script></body></html>'''
        (ROOT/'blog/posts'/f'{slug}.html').write_text(page,encoding='utf-8')
        metadata.append({key:post[key] for key in ['title','subtitle','category','tags']} | {
            'date':DATE,'readTime':f'{reading} min read','image':f'series-2026/covers/{slug}-card.webp',
            'url':f'posts/{slug}.html','status':STATUS})
        audit.append({'slug':slug,'words':words,'read_minutes':reading,'reference_count':len(re.findall('id="ref-',refs)),
                      'figure_count':body.count('<figure>'),'status':STATUS})
    data_file=ROOT/'blog/blog-data.json'
    existing=json.loads(data_file.read_text(encoding='utf-8'))
    slugs={p['url'] for p in metadata}
    existing=[p for p in existing if p['url'] not in slugs]
    data_file.write_text(json.dumps(metadata+existing,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (SERIES/'editorial-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    print(json.dumps(audit,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--render-only',action='store_true')
    args=parser.parse_args()
    if not args.render_only:
        covers(); plots()
    render()
