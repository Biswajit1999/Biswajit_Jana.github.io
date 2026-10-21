/* Lossless, bounded-width reading previews. Originals remain untouched for zoom. */
const fs=require('node:fs/promises'),path=require('node:path');
const sharp=require(process.argv[2] || 'sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
 let count=0;
 for(const slug of await fs.readdir(path.join(root,'paper-journal/papers'))){
  const file=path.join(root,'paper-journal/papers',slug,'plots/figure-provenance.json');
  let data;try{data=JSON.parse(await fs.readFile(file,'utf8'))}catch{continue}
  for(const figure of data.figures)for(const panel of figure.panels){
   const original=path.join(root,panel.path),preview=original.replace(/\.[^.]+$/,'.preview.webp');
   console.log(panel.path);
   const result=await sharp(original,{density:72,limitInputPixels:300000000}).flatten({background:'#ffffff'}).resize({width:1800,withoutEnlargement:true}).webp({lossless:true}).toFile(preview);
   panel.preview=path.relative(root,preview).replaceAll('\\','/');panel.width=result.width;panel.height=result.height;count++;
  }
  await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
 }
 console.log(JSON.stringify({previews:count}));
})().catch(e=>{console.error(e);process.exitCode=1});
