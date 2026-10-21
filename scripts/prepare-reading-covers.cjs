/* Optimise the five generated originals; keep the generated PNGs unmodified. */
const fs=require('node:fs');
const path=require('node:path');
const sharp=require(process.argv[2]||'sharp');
const root=path.resolve(__dirname,'..');
const defs={schmidt2024:'schmidt2024-espresso-line-spread-function',robertson:'robertson-2019-neid-environment-control',pinfield:'pinfield-2014-wise-halo-t-dwarfs',molliere:'molliere-2019-petitradtrans',kreidberg:'kreidberg-2015-batman-transit-models'};
(async()=>{
  for(const [key,slug] of Object.entries(defs)){
    const source=path.join(root,'paper-journal/assets/images/reading-covers-20261021',key+'.png');
    const dest=path.join(root,'paper-journal/papers',slug);
    await sharp(source).resize({width:1400,withoutEnlargement:true}).webp({quality:85}).toFile(path.join(dest,'hero.webp'));
    await sharp(source).resize({width:760,withoutEnlargement:true}).webp({quality:82}).toFile(path.join(dest,'card.webp'));
    console.log(slug);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
