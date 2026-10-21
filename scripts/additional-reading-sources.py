"""Pinned primary manuscripts for five additional literature notes; no synthetic plots."""
from pathlib import Path
import runpy
import sys

ROOT=Path(__file__).resolve().parents[1]
PAPERS={
 'schmidt2024':('schmidt2024-espresso-line-spread-function','2404.05283v1',[2,3,4,6,8,14,15]),
 'robertson':('robertson-2019-neid-environment-control','1902.07729v1',[6,7,8,9,10,11]),
 'pinfield':('pinfield-2014-wise-halo-t-dwarfs','1308.0495v1',[1,3,7,8,10,11]),
 'molliere':('molliere-2019-petitradtrans','1904.11504v2',[2,3,4,5,6]),
 'kreidberg':('kreidberg-2015-batman-transit-models','1507.08285v3',[1,2,3]),
}
if __name__=='__main__':
    review=runpy.run_path(str(ROOT/'scripts/review-paper-sources.py'))
    figures=runpy.run_path(str(ROOT/'scripts/fetch-reading-figures.py'))
    figures['one'].__globals__['SELECT']={k:v[2] for k,v in PAPERS.items()}
    for key,(slug,version,numbers) in PAPERS.items():
        (ROOT/'paper-journal/papers'/slug).mkdir(exist_ok=True)
        # Cached files are pinned: reject rather than silently relabel an earlier version.
        cached=review['CACHE']/(key+'-figures.json')
        if cached.exists():
            import json
            if json.loads(cached.read_text())['version']!=version:raise ValueError('Source cache version mismatch: '+key)
        print(review['get_paper']((key,version)),flush=True)
        print(figures['one'](key),flush=True)
