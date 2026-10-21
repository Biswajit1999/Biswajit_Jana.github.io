from pathlib import Path
import sys
import tempfile
sys.path.insert(0, str(Path(tempfile.gettempdir()) / "portfolio-reading-tools-20261021"))
from bs4 import BeautifulSoup
p=(Path(tempfile.gettempdir()) / "portfolio-paper-sources-20261021")
for key in ("zhao","sercel","schmidt","kreider","khandelwal","luhman","chen","pepe"):
 s=BeautifulSoup((p/(key+".html")).read_bytes(),"html.parser")
 sections=[]
 for sec in s.select("section.ltx_section"):
  heading=sec.find(["h2","h3"])
  if not heading: continue
  body=sec.get_text(" ",strip=True)
  if "References" in heading.get_text():continue
  # First substantive paragraphs and last substantive paragraphs retain methods and caveats.
  paragraphs=[x.get_text(" ",strip=True) for x in sec.select("p.ltx_p") if len(x.get_text())>160]
  take=paragraphs[:2]+paragraphs[-2:] if len(paragraphs)>4 else paragraphs
  sections.append({"heading":heading.get_text(" ",strip=True),"text":take})
 import json
 (p/(key+"-reading.json")).write_text(json.dumps(sections,ensure_ascii=False,indent=2),encoding="utf-8")
 if key=="zhao": print(str(s.find("figure",id="S5.F10"))[:700])
 print(key,[(x["heading"],sum(map(len,x["text"]))) for x in sections])
