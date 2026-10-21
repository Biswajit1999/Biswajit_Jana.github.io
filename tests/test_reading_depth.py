"""Regression checks for substantive, source-grounded standalone paper readings."""
import hashlib
import json
from pathlib import Path
import re
import unittest
ROOT=Path(__file__).resolve().parents[1]
class ReadingDepthTests(unittest.TestCase):
    def test_all_thirteen_notes_have_extended_analysis(self):
        audit=json.loads((ROOT/"paper-journal/reading-audit.json").read_text(encoding="utf-8"))
        self.assertEqual(len(audit),13)
        for note in audit:
            source=(ROOT/"paper-journal/papers"/note["slug"]/"index.html").read_text(encoding="utf-8")
            self.assertGreaterEqual(note["words"],1800)
            self.assertEqual(source.count('id="deep-reading"'),1)
            self.assertIn("paper-reader.js",source)
            self.assertNotIn('http-equiv="refresh"',source)
            self.assertNotIn("Figure file pending",re.sub(r"<script[\s\S]*?</script>","",source))
    def test_source_panels_have_provenance_and_local_assets(self):
        figures=panels=0
        for path in (ROOT/"paper-journal/papers").glob("*/plots/figure-provenance.json"):
            data=json.loads(path.read_text(encoding="utf-8"))
            self.assertIn("license",data)
            self.assertRegex(data["version"],r"\d{4}\.\d{4,5}")
            for figure in data["figures"]:
                figures+=1
                self.assertTrue(figure["anchor"])
                for panel in figure["panels"]:
                    panels+=1
                    self.assertTrue(panel["url"].startswith("https://arxiv.org/"))
                    if (ROOT/"data/website-release.json").exists() and 'CC BY' not in data['license']:
                        # Restricted copies remain local, not part of the public checkout.
                        page=path.parent.parent/'index.html'
                        self.assertNotIn('src="plots/source/',page.read_text(encoding='utf-8'))
                        continue
                    self.assertEqual(hashlib.sha256((ROOT/panel["path"]).read_bytes()).hexdigest(),panel["sha256"])
                    self.assertTrue((ROOT/panel["preview"]).is_file())
                    self.assertLessEqual(panel["width"],1800)
        self.assertEqual(figures,78)
        self.assertEqual(panels,85)
    def test_limited_panels_and_rights_are_not_misrepresented(self):
        chen=next((ROOT/"paper-journal/papers").glob("chen-*"))/"index.html"
        source=chen.read_text(encoding="utf-8")
        self.assertIn("Selected BD01 panels only",source)
        schmidt=next((ROOT/"paper-journal/papers").glob("schmidt-*"))/"index.html"
        self.assertIn("no additional copy is distributed here",schmidt.read_text(encoding="utf-8"))
    def test_home_count_and_orbit_are_progressive_enhancements(self):
        source=(ROOT/"index.html").read_text(encoding="utf-8")
        self.assertNotIn("85 repositories",source)
        self.assertIn('id="repositorySummary"',source)
        self.assertIn("orbit-playground.js",source)
        js=(ROOT/"orbit-playground.js").read_text(encoding="utf-8")
        self.assertIn("prefers-reduced-motion",js)
        self.assertIn("IntersectionObserver",js)
        self.assertIn("visibilitychange",js)
if __name__=="__main__":unittest.main()
