from __future__ import annotations

import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class AtlasLiveTests(unittest.TestCase):
    def test_generated_atlas_matches_builder(self) -> None:
        from build_atlas import build

        before = (ROOT / "atlas.html").read_text(encoding="utf-8")
        build()
        after = (ROOT / "atlas.html").read_text(encoding="utf-8")
        normalize = lambda text: re.sub(r"\?v=\d+", "?v=ASSET_VERSION", text)
        self.assertEqual(normalize(before), normalize(after))

    def test_live_repository_feed_is_paginated_and_cached(self) -> None:
        live = (ROOT / "atlas-live.js").read_text(encoding="utf-8")
        self.assertIn("per_page=100&page=", live)
        self.assertIn("batch.length === 100", live)
        self.assertIn("AtlasReposReady", live)
        self.assertIn("localStorage.setItem(CACHE_KEY", live)
        self.assertIn('new CustomEvent("atlas:repositories-ready"', live)

    def test_graph_accepts_every_live_repository(self) -> None:
        graph = (ROOT / "atlas-graph.js").read_text(encoding="utf-8")
        self.assertIn("architectureGraph(results[0], results[1])", graph)
        self.assertIn('type: "Domain"', graph)
        self.assertIn('type: "Technology"', graph)
        self.assertIn('relation === "CONTAINS_REPOSITORY"', graph)
        self.assertNotIn("focusedOverview", graph)

        manifest = json.loads((ROOT / "data" / "full-portfolio.json").read_text(encoding="utf-8"))
        self.assertGreaterEqual(len(manifest), 85)

    def test_public_count_is_not_presented_as_curated_total(self) -> None:
        html = (ROOT / "atlas.html").read_text(encoding="utf-8")
        self.assertIn('id="atlas-stat-total">…</div><div class="k">Public repositories · live GitHub', html)
        self.assertIn('id="atlas-stat-curated">85</div><div class="k">Scientifically annotated records', html)
        self.assertIn('id="atlas-architecture-repos">Connecting…</strong>', html)


if __name__ == "__main__":
    unittest.main()
