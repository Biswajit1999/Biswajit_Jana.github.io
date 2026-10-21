"""Homepage experience completeness and progressive-enhancement contracts."""
import hashlib
from html.parser import HTMLParser
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class Elements(HTMLParser):
    def __init__(self,html):
        super().__init__();self.elements=[];self.feed(html)
    def handle_starttag(self,tag,attrs):self.elements.append((tag,dict(attrs)))
class PortfolioPanelTests(unittest.TestCase):
    def test_partial_timeline_is_replaced_by_full_cv(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertNotIn('<ul class="timeline">',html)
        self.assertIn('Explore my full CV',html)
    def test_capabilities_and_all_experience_panels_are_static_html(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        elements=Elements(html).elements
        self.assertEqual(sum(t=='details' and a.get('class')=='capability' for t,a in elements),6)
        self.assertEqual(sum(t=='article' and 'research-card' in a.get('class','') for t,a in elements),11)
        for phrase in ['IIT Kharagpur','SSERD','Gauribidanur','Carl Sagan','Bayfordbury','Binapprox','PICASO','PSoC 5LP']:
            self.assertIn(phrase,html)
        self.assertIn('aria-controls="researchTrack"',html)
    def test_requested_materials_use_email_not_dead_github_folders(self):
        html=(ROOT/'index.html').read_text(encoding='utf-8')
        self.assertEqual(html.count('Available upon request'),2)
        self.assertNotIn('tree/main/Master%20Theses',html)
        self.assertNotIn('Poster%20Presentation%20and%20Seminar',html)
    def test_motion_can_be_disabled_and_strip_never_auto_advances(self):
        js=(ROOT/'portfolio-panels.js').read_text()
        css=(ROOT/'portfolio-panels.css').read_text()
        self.assertIn('prefers-reduced-motion',js)
        self.assertIn('data-motion="off"',css)
        self.assertNotIn('setInterval',js)
        self.assertIn("event.key==='Home'",js)
        self.assertIn('footer .foot-note',css)
    def test_five_covers_are_distinct_and_local(self):
        folders=['schmidt2024-espresso-line-spread-function','robertson-2019-neid-environment-control','pinfield-2014-wise-halo-t-dwarfs','molliere-2019-petitradtrans','kreidberg-2015-batman-transit-models']
        digests=set()
        for slug in folders:
            folder=ROOT/'paper-journal/papers'/slug
            self.assertTrue((folder/'hero.webp').is_file())
            digests.add(hashlib.sha256((folder/'card.webp').read_bytes()).hexdigest())
            self.assertIn('AI-generated conceptual artwork',(folder/'index.html').read_text(encoding='utf-8'))
        self.assertEqual(len(digests),5)
if __name__=='__main__':unittest.main()
