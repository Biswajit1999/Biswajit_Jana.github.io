/* Native scrolling remains usable without JavaScript; never auto-advance. */
(() => {
  'use strict';
  const track = document.getElementById('researchTrack');
  if (!track) return;
  const cards = [...track.querySelectorAll('.research-card')];
  const previous = document.getElementById('researchPrevious');
  const next = document.getElementById('researchNext');
  const position = document.getElementById('researchPosition');
  let active = 0, scheduled = false;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
  function update() {
    const edge = track.getBoundingClientRect().left + 4;
    active = cards.reduce((best, card, i) => Math.abs(card.getBoundingClientRect().left-edge) < Math.abs(cards[best].getBoundingClientRect().left-edge) ? i : best, 0);
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 3;
    const visible = cards.map((card,i) => ({i,r:card.getBoundingClientRect()})).filter(({r})=>r.right > edge+20 && r.left < edge+track.clientWidth-20);
    if (visible.length) position.textContent = `${visible.length===1?'Experience':'Experiences'} ${visible[0].i+1}${visible.length===1?'':'–'+(visible.at(-1).i+1)} of ${cards.length} · swipe to explore`;
    scheduled = false;
  }
  function move(delta) {
    const target = cards[Math.max(0,Math.min(cards.length-1,active+delta))];
    track.scrollTo({left:track.scrollLeft + target.getBoundingClientRect().left-track.getBoundingClientRect().left-4,behavior:reduced()?'instant':'smooth'});
  }
  previous.addEventListener('click',()=>move(-1));
  next.addEventListener('click',()=>move(1));
  track.addEventListener('keydown',event=>{
    if(event.target!==track)return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}
    if(event.key==='Home'||event.key==='End'){event.preventDefault();track.scrollTo({left:event.key==='Home'?0:track.scrollWidth,behavior:reduced()?'instant':'smooth'});}
  });
  track.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;requestAnimationFrame(update);}},{passive:true});
  new ResizeObserver(update).observe(track);
  document.querySelectorAll('.capability-flow a').forEach(link=>link.addEventListener('click',()=>{const panel=document.querySelector(link.hash);if(panel)panel.open=true;}));
  update();
})();
