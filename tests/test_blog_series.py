"""Offline checks for the eight articles and scientific inputs."""
from html.parser import HTMLParser
from pathlib import Path
import csv
import hashlib
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[1]
SERIES=ROOT/'blog/series-2026'

class Document(HTMLParser):
    def __init__(self,source):
        super().__init__(); self.ids=[]; self.images=[]; self.links=[]; self.h1=0
        self.feed(source)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.append(a['id'])
        if tag=='h1': self.h1+=1
        if tag=='img': self.images.append(a)
        if tag=='a': self.links.append(a.get('href',''))

class BlogSeriesTests(unittest.TestCase):
    def setUp(self):
        self.manifest=json.loads((SERIES/'manifest.json').read_text(encoding='utf-8'))

    def test_eight_full_length_review_drafts(self):
        audit=json.loads((SERIES/'editorial-audit.json').read_text())
        self.assertEqual(len(audit),8)
        for entry in audit:
            self.assertGreaterEqual(entry['words'],1900,entry['slug'])
            self.assertGreaterEqual(entry['reference_count'],3)
            self.assertGreaterEqual(entry['figure_count'],2)
            self.assertEqual(entry['status'],'published')

    def test_new_pages_have_assets_anchors_and_citations(self):
        for p in self.manifest:
            page=ROOT/'blog/posts'/f"{p['slug']}.html"
            source=page.read_text(encoding='utf-8'); dom=Document(source)
            self.assertEqual(dom.h1,1)
            self.assertEqual(len(dom.ids),len(set(dom.ids)),p['slug'])
            self.assertIn('index, follow',source)
            self.assertNotIn('noindex',source)
            self.assertIn('datePublished',source)
            self.assertIn('"creativeWorkStatus": "Published"',source)
            self.assertIn('dateCreated',source)
            self.assertIn('observatory-page observatory-article',source)
            for structure in ['hero-grid','hero-card','journal-grid','left-rail','right-rail','glossary-item','class="chapter"']:
                self.assertIn(structure,source)
            for internal in ['source-ledger','review-status','Local review draft','Input URLs, queries and checksums','Article source','cover-prompts.json','figure-provenance.json','provenance.json']:
                self.assertNotIn(internal,source)
            self.assertGreaterEqual(source.count('class="citation"'),2,p['slug'])
            for im in dom.images:
                self.assertTrue(im.get('alt'))
                self.assertTrue((page.parent/im['src']).exists(),im['src'])
            for href in dom.links:
                if href.startswith('#'):
                    self.assertIn(href[1:],dom.ids,href)
                elif not re.match(r'\w+:',href):
                    self.assertTrue((page.parent/href.split('#')[0]).exists(),href)

    def test_metadata_preserves_existing_archive(self):
        data=json.loads((ROOT/'blog/blog-data.json').read_text(encoding='utf-8'))
        published=[p for p in data if p.get('status')=='published']
        self.assertEqual(len(data),26); self.assertEqual(len(published),8)
        self.assertEqual(len(set(p['url'] for p in data)),26)
        for p in published:
            self.assertEqual(p['date'],'2026-10-21')
            self.assertNotIn('editorialSlot',p)

    def test_inputs_are_revision_pinned_and_unchanged(self):
        ledger=json.loads((SERIES/'provenance.json').read_text())
        self.assertEqual(len(ledger['repositories']),8)
        for repo in ledger['repositories'].values():
            self.assertRegex(repo['commit'],r'^[0-9a-f]{40}$')
        for item in ledger['files']:
            if 'sha256' in item:
                self.assertEqual(hashlib.sha256((ROOT/item['file']).read_bytes()).hexdigest(),item['sha256'])

    def test_scientific_inputs_and_boundaries(self):
        with (SERIES/'sources/gaia-dr3.csv').open(encoding='utf-8') as f:
            stars=list(csv.DictReader(f))
        self.assertEqual(len(stars),6000)
        self.assertTrue(all(float(s['parallax'])>2 and float(s['parallax_over_error'])>20 for s in stars))
        neid=json.loads((SERIES/'sources/rv-activity-disentangler/research/neid-variability-summary.json').read_text())
        cuts=neid['analyses']['quality_selection_sensitivity']
        self.assertEqual([c['count'] for c in cuts],[635,556,513,314])
        earth=json.loads((SERIES/'sources/finding-earth-2/results/analysis_summary.json').read_text())
        self.assertEqual(earth['scale']['total_source_records'],164346)
        self.assertEqual(earth['population']['n_confirmed_planets'],6366)
        story=(SERIES/'earth-shortlist.md').read_text(encoding='utf-8')
        self.assertIn('164,346',story); self.assertIn('analysis snapshot',story)
        roman=json.loads((SERIES/'sources/coronagraph-dark-hole-lab/public/data/roman-hlc-os11.json').read_text())
        self.assertIn('simulated',roman['warning'])

    def test_prompts_and_build_notes_not_in_website(self):
        self.assertFalse((SERIES/'cover-prompts.json').exists())
        self.assertFalse((SERIES/'README.md').exists())
        archive=(ROOT/'blog/index.html').read_text(encoding='utf-8')
        for text in ['draftNotice','Local draft /','New project note / local draft']:
            self.assertNotIn(text,archive)

    def test_recomputed_neid_scatter(self):
        raw=json.loads((SERIES/'sources/rv-activity-disentangler/public/data/neid-solar-2459700-2459713.json').read_text())
        values=[r['rvRelativeMetersPerSecond'] for r in raw['records'] if r['analysisPass']]
        mean=sum(values)/len(values)
        centred=(sum((v-mean)**2 for v in values)/len(values))**.5
        uncentred=(sum(v*v for v in values)/len(values))**.5
        self.assertAlmostEqual(centred,6.962546748576591,places=8)
        self.assertAlmostEqual(uncentred,8.116836540985094,places=8)

if __name__=='__main__': unittest.main()
