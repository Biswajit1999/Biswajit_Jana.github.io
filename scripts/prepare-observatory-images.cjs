/* Development-only conversion. Original artwork is never modified.
 * Usage: node scripts/prepare-observatory-images.cjs [path-to-sharp]
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const root = path.resolve(__dirname, '..');
const files = [
  'profile image.png', '02_exohspec_spectrograph.png',
  '03_brown_dwarf_research.png', '05_satellite_laser_ranging.png',
  '06_visible_light_communication.png', 'blog13_01_blackhole_hero.png',
  'blog13_01_gravitational_waves_hero.png', 'blog15_01_transit_method_hero.png',
  'blog14_01_pulsar_hero.png', '08_paper_notes_research.png'
];
(async () => {
  const destination = path.join(root, 'assets', 'portfolio');
  await fs.mkdir(destination, {recursive:true});
  let before=0, after=0;
  for (const file of files) {
    const src=path.join(root,'images',file);
    const target=path.join(destination,file.replace(/\.png$/,'.webp').replaceAll(' ','-'));
    before+=(await fs.stat(src)).size;
    await sharp(src).resize({width:file.startsWith('profile')?180:1000,withoutEnlargement:true}).webp({quality:82}).toFile(target);
    after+=(await fs.stat(target)).size;
  }
  console.log(JSON.stringify({images:files.length,originalBytes:before,webpBytes:after}));
})().catch(error => { console.error(error);process.exitCode=1; });
