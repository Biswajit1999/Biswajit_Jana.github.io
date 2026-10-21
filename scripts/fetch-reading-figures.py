"""Download selected original paper figure panels and record their provenance."""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import sys
import tempfile
import urllib.parse
import urllib.request
sys.path.insert(0, str(Path(tempfile.gettempdir()) / "portfolio-reading-tools-20261021"))
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
CACHE=(Path(tempfile.gettempdir()) / "portfolio-paper-sources-20261021")
SELECT={
"pepe":[7,10,12,16,19,25,26,27,28],
"zhao":[1,4,5,7,8,10,11],
"schmidt":[1,7,10,12,15,16],
"sercel":[2,4,6,7,8],
"kreider":[1,2,3,4],
"khandelwal":[1,2,3,4,5,17],
"luhman":[3,4,6,7,10,11,12],
"chen":[1,2,3,4,5,6,8],
}
def fetch(url):
 with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Portfolio scholarly reading review"}),timeout=90) as r:return r.read()
def one(key):
 metadata=json.loads((CACHE/(key+"-figures.json")).read_text())
 soup=BeautifulSoup((CACHE/(key+".html")).read_bytes(),"html.parser")
 target=next((ROOT/"paper-journal/papers").glob(key+"-*"))/"plots"/"source"
 target.mkdir(parents=True,exist_ok=True)
 out=[]
 for number in SELECT[key]:
  figure=soup.select("figure.ltx_figure")[number-1]
  graphics=figure.select("img.ltx_graphics,object.ltx_graphics")
  if key=="chen" and number==6:graphics=[graphics[i] for i in [0,4]]
  panels=[]
  for i,g in enumerate(graphics,1):
   url=urllib.parse.urljoin("https://arxiv.org/html/",g.get("src") or g.get("data"))
   ext=Path(urllib.parse.urlsplit(url).path).suffix
   dest=target/("figure-%02d-panel-%02d"%(number,i)+ext)
   if not dest.exists():dest.write_bytes(fetch(url))
   panels.append({"path":str(dest.relative_to(ROOT)).replace("\\","/"),"url":url,"sha256":hashlib.sha256(dest.read_bytes()).hexdigest()})
  if not panels:raise RuntimeError(f"No graphics in {key} figure {number}")
  out.append({"number":number,"anchor":figure.get("id"),"panels":panels,"partial":key=="chen" and number==6})
 manifest={"key":key,"version":metadata["version"],"license":metadata["license"][0],"review_date":"2026-10-21","figures":out}
 (target.parent/"figure-provenance.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
 return {"key":key,"figures":len(out),"panels":sum(len(f["panels"]) for f in out)}
if __name__=="__main__":
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  for result in pool.map(one,SELECT): print(json.dumps(result),flush=True)
