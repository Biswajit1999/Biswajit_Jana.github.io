from __future__ import annotations

import json
import unittest
from pathlib import Path

from build_evidence_registry import DATA_PATH, OUTPUT_PATH, load_evidence, render, validate_evidence

ROOT = Path(__file__).resolve().parents[1]


class EvidenceRegistryTests(unittest.TestCase):
    def test_committed_evidence_is_valid(self) -> None:
        document = load_evidence()
        validate_evidence(document)
        self.assertEqual(document["programme"]["completed"], 17)
        self.assertEqual(len(document["repositories"]), 17)

    def test_registry_build_is_current_and_accessible(self) -> None:
        generated = render(load_evidence())
        self.assertEqual(OUTPUT_PATH.read_text(encoding="utf-8"), generated)
        self.assertIn('href="#main">Skip to evidence</a>', generated)
        self.assertIn('aria-label="Programme status"', generated)
        self.assertIn('prefers-reduced-motion:reduce', generated)
        for repository in load_evidence()["repositories"]:
            self.assertIn(repository["slug"], generated)

    def test_sitemap_local_html_targets_exist(self) -> None:
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        prefix = "https://biswajit1999.github.io/Biswajit_Jana.github.io/"
        targets = []
        for line in sitemap.splitlines():
            if "<loc>" not in line:
                continue
            url = line.strip().removeprefix("<loc>").removesuffix("</loc>")
            if url.startswith(prefix):
                relative = url[len(prefix) :] or "index.html"
                targets.append(relative)
        missing = [target for target in targets if not (ROOT / target).is_file()]
        self.assertEqual(missing, [])

    def test_json_is_round_trip_stable(self) -> None:
        document = json.loads(DATA_PATH.read_text(encoding="utf-8"))
        self.assertEqual(document, load_evidence())


if __name__ == "__main__":
    unittest.main()
