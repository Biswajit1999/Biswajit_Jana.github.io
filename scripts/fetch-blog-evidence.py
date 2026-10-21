"""Fetch only public, revision-pinned inputs for the October blog series.

This never changes upstream repositories or retrieves private thesis records.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode, quote
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'blog' / 'series-2026' / 'sources'
REPOS = ['Master-Thesis-2024', 'interactive-hr-diagram-lab',
         'NASADIYA-LIGHTCONE', 'finding-earth-2', 'rv-activity-disentangler',
         'lattice-radiation-twin', 'coronagraph-dark-hole-lab', 'TransitScatter']
FILES = {
    'rv-activity-disentangler': ['public/data/neid-solar-2459700-2459713.json',
                                'research/neid-variability-summary.json'],
    'lattice-radiation-twin': ['results/hst_replication/hst_replication_longitudinal.png',
                             'paper/figures/identifiability_audit.png'],
    'coronagraph-dark-hole-lab': ['public/data/roman-hlc-os11.json'],
    'TransitScatter': ['results/benchmark_results.csv',
                      'results/flare_robustness_results.csv'],
    'finding-earth-2': ['results/analysis_summary.json',
                       'results/atmosphere/earth_analogue_spectrum_screen.json'],
}

def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'Biswajit-portfolio-blog-review'}), timeout=60) as response:
        return response.read()

def main():
    DEST.mkdir(parents=True, exist_ok=True)
    ledger = {'retrieved': '2026-10-21', 'repositories': {}, 'files': []}
    for repo in REPOS:
        info = json.loads(fetch(f'https://api.github.com/repos/Biswajit1999/{repo}/commits?per_page=1'))[0]
        sha = info['sha']
        ledger['repositories'][repo] = {'commit': sha, 'url': f'https://github.com/Biswajit1999/{repo}/tree/{sha}'}
        for remote in ['README.md'] + FILES.get(repo, []):
            url = f'https://raw.githubusercontent.com/Biswajit1999/{repo}/{sha}/{remote}'
            data = fetch(url)
            target = DEST / repo / remote
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            ledger['files'].append({'file': str(target.relative_to(ROOT)).replace('\\', '/'),
                                    'source': url, 'sha256': hashlib.sha256(data).hexdigest()})
        print(repo, sha[:12], flush=True)
    query = ('SELECT TOP 6000 source_id,ra,dec,parallax,parallax_over_error,bp_rp,phot_g_mean_mag '
             'FROM gaiadr3.gaia_source WHERE parallax > 2 AND parallax_over_error > 20 '
             'AND bp_rp IS NOT NULL AND phot_g_mean_mag IS NOT NULL ORDER BY random_index')
    url = 'https://gea.esac.esa.int/tap-server/tap/sync?' + urlencode(
        {'REQUEST': 'doQuery', 'LANG': 'ADQL', 'FORMAT': 'csv', 'QUERY': query})
    data = fetch(url)
    if not data.startswith(b'source_id'):
        raise RuntimeError('Gaia response is not the requested catalogue CSV')
    (DEST / 'gaia-dr3.csv').write_bytes(data)
    ledger['files'].append({'file': 'blog/series-2026/sources/gaia-dr3.csv', 'source': url,
                            'query': query, 'sha256': hashlib.sha256(data).hexdigest(),
                            'selection': 'First 6000 rows by Gaia random_index after declared quality cuts; not a completeness-corrected census.'})
    # The existing local survey derivative retains per-object source provenance.
    survey = ROOT.parent / 'NASADIYA-LIGHTCONE/data/processed/2mrs/2mrs_lightcone.json'
    original = survey.read_bytes()
    rows = json.loads(original)
    reduced = {'meta': rows['meta'], 'objects': [
        {key: row[key] for key in ['object_id', 'ra_deg', 'dec_deg', 'redshift', 'cz_km_s']}
        for row in rows['objects']]}
    (DEST / '2mrs-positions.json').write_text(json.dumps(reduced, separators=(',', ':')), encoding='utf-8')
    ledger['files'].append({'file': 'blog/series-2026/sources/2mrs-positions.json',
                            'source': 'https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/ApJS/199/26/table3',
                            'input_file_sha256': hashlib.sha256(original).hexdigest(),
                            'transformation': 'Retain object identifier, sky position and recession/redshift columns from existing local project derivative. No distance reconstruction.'})
    (DEST.parent / 'provenance.json').write_text(json.dumps(ledger, indent=2), encoding='utf-8')

if __name__ == '__main__':
    main()
