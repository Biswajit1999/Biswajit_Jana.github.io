/* Progressive enhancement: source links remain usable without JavaScript. */
(() => {
 const dialog=document.createElement('dialog');dialog.className='figure-zoom';
 dialog.setAttribute('aria-labelledby','figureZoomTitle');
 dialog.innerHTML='<div class="figure-zoom-bar"><strong id="figureZoomTitle">Paper figure</strong><button type="button" data-fit>Fit</button><button type="button" data-pixels>100% pixels</button><button type="button" data-close>Close ✕</button></div><p class="figure-zoom-help">Scroll to inspect a large plot. Escape closes this view. Source attribution remains in the reading note.</p><div class="figure-zoom-body"><img alt=""></div>';
 document.body.append(dialog);
 const image=dialog.querySelector('img'),title=dialog.querySelector('strong'),body=dialog.querySelector('.figure-zoom-body');
 let trigger;
 document.addEventListener('click',event=>{
  const link=event.target.closest('a.paper-panel');
  if(!link||event.ctrlKey||event.metaKey||event.shiftKey||!dialog.showModal)return;
  event.preventDefault();trigger=link;
  title.textContent=link.querySelector('img').alt;
  image.alt=title.textContent;image.src=link.href;image.style.width='100%';
  body.scrollTop=body.scrollLeft=0;dialog.showModal();
 });
 dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.querySelector('[data-fit]').addEventListener('click',()=>{image.style.width='100%';body.scrollLeft=0});
 dialog.querySelector('[data-pixels]').addEventListener('click',()=>{image.style.width=Math.max(image.naturalWidth,1200)+'px'});
 dialog.addEventListener('close',()=>{trigger?.focus();image.removeAttribute('src')});
})();
