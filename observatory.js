/* Observatory Ink: progressive enhancements, no runtime dependencies. */
(() => {
  'use strict';
  const root = document.documentElement;
  const script = document.currentScript;
  const base = new URL('.', script.src);
  const relative = path => new URL(path, base).href;
  if (!document.querySelector('link[rel="icon"]')) {
    const icon=document.createElement('link'); icon.rel='icon'; icon.href=relative('assets/favicon.svg'); document.head.append(icon);
  }
  const $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motionOn = () => !reduced.matches && root.dataset.motion !== 'off';
  const store = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const dispatch = name => document.dispatchEvent(new CustomEvent(name));
  const colors = () => {
    const s = getComputedStyle(root);
    return Object.fromEntries(['bg','surface','ink','muted','line','line-2','accent','accent-soft','chart-secondary'].map(k => [k,s.getPropertyValue('--'+k).trim()]));
  };

  if (document.body.classList.contains('observatory-page')) {
    const navigation = document.querySelector('nav .nav-inner') || document.querySelector('nav .nav') || document.querySelector('.nav-inner') || document.querySelector('nav');
    if (navigation) {
      const controls = document.createElement('span'); controls.className='global-appearance';
      controls.innerHTML='<button class="search-launch" type="button" data-search-open aria-label="Search the site">Search <kbd>Ctrl K</kbd></button>';
      if (!document.querySelector('#themeToggle,#themeBtn,#themeSwitch')) controls.insertAdjacentHTML('beforeend','<button type="button" data-observatory-theme>Night</button>');
      const existing = document.querySelector('#themeToggle,#themeBtn');
      if (existing && navigation.contains(existing)) {
        existing.before(controls); controls.append(existing);
      } else navigation.append(controls);
    }
  }
  function applyTheme(theme) {
    root.dataset.theme = theme;
    document.body.classList.toggle('light', theme === 'light');
    // Older CV code writes colors directly to the root. The shared design now owns them.
    if (document.body.classList.contains('observatory-cv')) root.removeAttribute('style');
    document.querySelectorAll('#themeToggle,#themeBtn,[data-observatory-theme]').forEach(b => {
      b.textContent = theme === 'dark' ? 'Day' : 'Night';
      b.setAttribute('aria-label', theme === 'dark' ? 'Switch to day appearance' : 'Switch to night appearance');
      b.title = b.getAttribute('aria-label');
      b.setAttribute('aria-pressed', String(theme === 'dark'));
    });
    const check = $('themeSwitch');
    if (check) { check.checked = theme === 'light'; check.setAttribute('aria-label','Day appearance'); }
    dispatch('observatory:theme');
  }
  applyTheme(root.dataset.theme || 'light');
  // Capture before existing per-page handlers to avoid double toggles.
  document.addEventListener('click', e => {
    const toggle = e.target.closest('#themeToggle,#themeBtn,[data-observatory-theme]');
    if (!toggle) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    store('theme', next); applyTheme(next);
  }, true);
  document.addEventListener('change', e => {
    if (e.target.id !== 'themeSwitch') return;
    e.stopImmediatePropagation();
    const next = e.target.checked ? 'light' : 'dark';
    store('theme', next); applyTheme(next);
  }, true);
  const motionButton = $('motionToggle');
  function syncMotion() {
    if (motionButton) {
      motionButton.textContent = motionOn() ? 'Reduce motion' : 'Motion reduced';
      motionButton.setAttribute('aria-pressed', String(!motionOn()));
    }
    dispatch('observatory:motion');
  }
  motionButton?.addEventListener('click', () => {
    root.dataset.motion = root.dataset.motion === 'off' ? 'on' : 'off';
    store('observatory-motion', root.dataset.motion); syncMotion();
  });
  reduced.addEventListener('change', syncMotion);
  syncMotion();

  const nav = $('nav'), navToggle = $('navToggle');
  if (document.body.classList.contains('observatory-home') && nav && navToggle) {
    function closeNav() { nav.classList.remove('open'); navToggle.setAttribute('aria-expanded','false'); }
    navToggle.addEventListener('click', () => { const open=nav.classList.toggle('open'); navToggle.setAttribute('aria-expanded',String(open)); });
    nav.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click',closeNav));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav();});
    document.addEventListener('click',e=>{if(!nav.contains(e.target))closeNav();});
    const active = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) {
        nav.querySelectorAll('a[aria-current]').forEach(a=>a.removeAttribute('aria-current'));
        nav.querySelector(`a[href="#${e.target.id}"]`)?.setAttribute('aria-current','location');
      }
    },{rootMargin:'-20% 0px -55% 0px'});
    document.querySelectorAll('main section[id]').forEach(s=>active.observe(s));
  }
  if ('IntersectionObserver' in window && motionOn()) {
    document.body.classList.add('motion-ready');
    const reveal = new IntersectionObserver(entries => entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('in');reveal.unobserve(e.target);}
    }),{threshold:.06});
    document.querySelectorAll('.reveal').forEach(el=>reveal.observe(el));
  }
  [['toolTrack','toolPrev','toolNext'],['galTrack','galPrev','galNext']].forEach(([trackId,prev,next])=>{
    const track=$(trackId); if(!track)return;
    const move=direction=>track.scrollBy({left:direction*Math.min(340,track.clientWidth*.85),behavior:motionOn()?'smooth':'instant'});
    $(prev)?.addEventListener('click',()=>move(-1)); $(next)?.addEventListener('click',()=>move(1));
  });
  document.querySelectorAll('[data-research-filter]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-research-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    let count=0;
    document.querySelectorAll('[data-research-category]').forEach(a=>{
      a.hidden=b.dataset.researchFilter!=='all'&&a.dataset.researchCategory!==b.dataset.researchFilter;
      if(!a.hidden)count++;
    });
    $('researchCount').textContent=count+' projects';
  }));

  // The local catalogue is the same source used by the repository atlas.
  let catalogue = [];
  let libraryFilter='exoplanet-report';
  let libraryLimit=6;
  function safeURL(value) {
    try { const u=new URL(value,base); return ['http:','https:'].includes(u.protocol)?u.href:null; } catch(_){return null;}
  }
  const evidenceNames={
    'public-data-reanalysis':'Public-data reanalysis',
    'reproduced-from-bundled-data':'Reanalysis of bundled data',
    'literature-summary':'Literature summary',
    'educational-simulation':'Educational simulation',
    'algorithm-validated-on-synthetic-signal':'Synthetic-signal validation',
    'null-or-mixed-result':'Null or mixed result'
  };
  function evidenceLabel(item){return evidenceNames[item.evidence_status] || (item.evidence_status || item.type || 'Repository').replaceAll('-',' ');}
  function renderLibrary(){
    const grid=$('reportGrid');if(!grid)return;
    const q=($('reportSearch')?.value||'').trim().toLowerCase();
    const matches=catalogue.filter(p=>(libraryFilter==='all'||p.type===libraryFilter)&&[p.title,p.summary,...(p.tech_or_instruments||[]),...(p.tags||[])].join(' ').toLowerCase().includes(q));
    grid.replaceChildren();grid.setAttribute('aria-busy','false');
    matches.slice(0,libraryLimit).forEach(p=>{
      const a=document.createElement('a');a.className='report-item';a.href=safeURL(p.live_report_url)||safeURL(p.github_url)||relative('atlas.html');
      const body=document.createElement('div');
      const ev=document.createElement('span');ev.className='evidence';ev.textContent=evidenceLabel(p);
      const h=document.createElement('h3');h.textContent=p.title;
      const details=document.createElement('p');details.textContent=[p.category,...(p.tech_or_instruments||[]).slice(0,2)].filter(Boolean).join(' / ') || p.type.replaceAll('-',' ');
      const arrow=document.createElement('span');arrow.className='report-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
      body.append(ev,h,details);a.append(body,arrow);grid.append(a);
    });
    if(!matches.length){const p=document.createElement('p');p.className='library-message';p.textContent='No matching reports. Try a planet name, instrument or a broader search.';grid.append(p);}
    $('libraryCount').textContent=matches.length?`Showing ${Math.min(libraryLimit,matches.length)} of ${matches.length} matching repositories`:'No matching repositories';
    if($('moreReports')) $('moreReports').hidden=matches.length<=libraryLimit;
  }
  $('reportSearch')?.addEventListener('input',()=>{libraryLimit=6;renderLibrary();});
  $('moreReports')?.addEventListener('click',()=>{libraryLimit+=6;renderLibrary();});
  document.querySelectorAll('[data-library-filter]').forEach(b=>b.addEventListener('click',()=>{
    libraryFilter=b.dataset.libraryFilter;
    libraryLimit=6;
    document.querySelectorAll('[data-library-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    renderLibrary();
  }));
  fetch(relative('data/full-portfolio.json')).then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{
    if(!Array.isArray(data))throw Error('Invalid catalogue');
    catalogue=data;renderLibrary();
    if($('atlasRepoCount'))$('atlasRepoCount').textContent=data.length;
    renderSearch();
  }).catch(()=>{
    if($('reportGrid')){
      $('reportGrid').setAttribute('aria-busy','false');$('reportGrid').replaceChildren();
      const p=document.createElement('p');p.className='library-message';p.textContent='The research catalogue could not load. Explore the repository map or reload this page.';$('reportGrid').append(p);
      $('libraryCount').textContent='Catalogue unavailable';
    }
  });

  const pages=[
    ['Research','Supervised instrumentation and observations','index.html#research'],
    ['About Biswajit','Academic background and research interests','index.html#about'],
    ['Technical skills','Instrumentation, programming and data analysis','index.html#skills'],
    ['CV','Academic experience and downloadable CV','cv.html'],
    ['Publications','Peer-reviewed publications and conference outputs','publications.html'],
    ['Repository map','Searchable research and software atlas','atlas.html'],
    ['Research blog','Articles, explainers and interactive science','blog/index.html'],
    ['Reading journal','Structured research paper notes','paper-journal/'],
    ['Gallery','Conceptual science illustrations','gallery.html'],
    ['Scientific tools','Browser-based interactive labs','index.html#tools'],
    ['Doppler spectrum lab','Explore spectral shifts with radial velocity','index.html#playground'],
    ['Contact','PhD and research opportunities','index.html#contact']
  ];
  const dialog=document.createElement('dialog');dialog.className='site-search';dialog.setAttribute('aria-label','Search the portfolio');
  dialog.innerHTML='<div class="search-top"><label><span>Search research, tools &amp; pages</span><input id="siteSearchInput" type="search" placeholder="Planet, instrument, method…" autocomplete="off"></label><button class="search-close" type="button">Close</button></div><div class="search-results" id="siteSearchResults"></div><div class="search-footer" id="searchSummary" role="status">Type to search. Escape to close.</div>';
  document.body.append(dialog);
  let opener=null;
  function renderSearch(){
    const input=$('siteSearchInput'),list=$('siteSearchResults');if(!input||!list)return;
    const q=input.value.trim().toLowerCase();
    let records=pages.map(([title,description,url])=>({title,description,url:relative(url)}));
    if(q)records=records.concat(catalogue.map(p=>({title:p.title,description:[evidenceLabel(p),...(p.tech_or_instruments||[])].join(' / '),url:safeURL(p.live_report_url)||safeURL(p.github_url),keywords:[p.summary,...(p.tags||[])].join(' ')})));
    const hits=records.filter(p=>p.url&&(!q||[p.title,p.description,p.keywords].join(' ').toLowerCase().includes(q)));
    list.replaceChildren();
    hits.slice(0,12).forEach(p=>{
      const a=document.createElement('a');a.className='search-result';a.href=p.url;
      const title=document.createElement('strong');title.textContent=p.title;
      const desc=document.createElement('small');desc.textContent=p.description;a.append(title,desc);a.addEventListener('click',()=>dialog.close());list.append(a);
    });
    if(!hits.length){const p=document.createElement('p');p.className='library-message';p.textContent='No matches. Try a planet, instrument, or method.';list.append(p);}
    $('searchSummary').textContent=q?`${hits.length} matches. Tab to navigate; Escape to close.`:'Pages and sections. Type to include repository results.';
  }
  const openSearch=e=>{opener=e?.currentTarget||document.activeElement;dialog.showModal();renderSearch();$('siteSearchInput').focus();};
  document.querySelectorAll('[data-search-open]').forEach(b=>b.addEventListener('click',openSearch));
  dialog.querySelector('.search-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>opener?.focus());
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}},true);
  $('siteSearchInput').addEventListener('input',renderSearch);
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(!dialog.open)openSearch();else dialog.close();}
  });
  renderSearch();
  $('copyEmail')?.addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText('biswajitj998@gmail.com');$('copyStatus').textContent='Email address copied.';}
    catch(_){$('copyStatus').textContent='biswajitj998@gmail.com';}
  });
  if($('ageYears')){
    const days=(Date.now()-new Date(1999,7,11).getTime())/86400000;
    [['ageYears',days/365.25],['daysAlive',Math.floor(days)],['marsSols',days*86400/88775],['mercYears',days/87.969],['venusYears',days/224.701],['marsYears',days/686.980]].forEach(([id,n])=>{if($(id))$(id).textContent=n.toLocaleString(undefined,{maximumFractionDigits:id==='daysAlive'?0:1});});
    if($('clock'))$('clock').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }

  // Canvas sizing stays sharp without allocating unbounded GPU-sized surfaces.
  function setupCanvas(canvas, draw){
    if(!canvas)return null;
    const ctx=canvas.getContext('2d');if(!ctx)return null;
    let width=0,height=0;
    function resize(){
      const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
      if(!width||!height)return;
      const dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
      draw(ctx,width,height);
    }
    new ResizeObserver(resize).observe(canvas);
    document.addEventListener('observatory:theme',resize);
    return {ctx,draw:()=>{if(width&&height)draw(ctx,width,height);}};
  }

  // A real synthetic spectrum. c = 299792.458 km/s; wavelengths are in nm.
  const spectrum=$('spectrumCanvas'),velocity=$('radialVelocity');
  if(spectrum&&velocity){
    function plotSpectrum(ctx,w,h){
      const c=colors(),left=47,right=w-15,top=22,bottom=h-38;
      ctx.clearRect(0,0,w,h);ctx.font='10px ui-monospace,monospace';ctx.lineWidth=1;
      const xmin=588.5,xmax=590.2,ymin=.3,ymax=1.05;
      const sx=x=>left+(x-xmin)/(xmax-xmin)*(right-left),sy=y=>bottom-(y-ymin)/(ymax-ymin)*(bottom-top);
      ctx.textAlign='right';
      [.4,.6,.8,1].forEach(v=>{ctx.strokeStyle=c.line;ctx.beginPath();ctx.moveTo(left,sy(v));ctx.lineTo(right,sy(v));ctx.stroke();ctx.fillStyle=c.muted;ctx.fillText(v.toFixed(1),left-8,sy(v)+3);});
      ctx.textAlign='center';[588.6,589,589.4,589.8,590.2].forEach(v=>{ctx.fillStyle=c.muted;ctx.fillText(v.toFixed(1),sx(v),bottom+18);});
      ctx.fillText('Wavelength (nm)',(left+right)/2,h-3);ctx.save();ctx.translate(12,(top+bottom)/2);ctx.rotate(-Math.PI/2);ctx.fillText('Normalised flux',0,0);ctx.restore();
      const rv=Number(velocity.value);
      function trace(shift,color,dashed){ctx.strokeStyle=color;ctx.lineWidth=1.65;ctx.setLineDash(dashed?[4,4]:[]);ctx.beginPath();for(let i=0;i<=700;i++){
        const x=xmin+(xmax-xmin)*i/700;let y=1;
        [[588.995,.61,.022],[589.592,.43,.027],[589.83,.13,.016]].forEach(([center,depth,sigma])=>{const shifted=center*(1+shift/299792.458);y-=depth*Math.exp(-.5*((x-shifted)/sigma)**2);});
        if(i===0)ctx.moveTo(sx(x),sy(y));else ctx.lineTo(sx(x),sy(y));
      }ctx.stroke();ctx.setLineDash([]);}
      trace(0,c['chart-secondary'],true);trace(rv,c.accent,false);
      const text=rv===0?'Rest frame':rv>0?'Receding: redshift':'Approaching: blueshift';ctx.fillStyle=c.accent;ctx.textAlign='right';ctx.fillText(text,right,12);
      spectrum.setAttribute('aria-label',`Synthetic absorption spectrum at ${rv} kilometres per second. ${text}.`);
    }
    const plot=setupCanvas(spectrum,plotSpectrum);
    velocity.addEventListener('input',()=>{$('velocityValue').textContent=(Number(velocity.value)>0?'+':'')+velocity.value+' km/s';plot?.draw();});
  }

  // Perspective-projected 3D bench. Every lens, mount and ray has xyz coordinates.
  const canvas=$('opticalBench');
  if(canvas){
    canvas.setAttribute('tabindex','0');
    let yaw=-.38,pitch=.65,time=0,rotation=true,visible=true,raf=0,last=0,drag=null;
    let drawBench;
    const parts=[
      {label:'Slit',x:-3.6,z:.25,kind:'slit'},
      {label:'Collimator',x:-2.05,z:.25,kind:'lens'},
      {label:'Grating',x:0,z:.25,kind:'grating'},
      {label:'Camera',x:1.8,z:1.3,kind:'lens'},
      {label:'Detector',x:3.55,z:2.3,kind:'detector'}
    ];
    function scene(ctx,w,h){
      const c=colors();ctx.clearRect(0,0,w,h);
      const scale=Math.min(w/10.6,h/5.5),cy=h*.55;
      function project(v){
        const x=v[0]*Math.cos(yaw)-v[2]*Math.sin(yaw),z=v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw);
        const y=v[1]*Math.cos(pitch)-z*Math.sin(pitch),depth=v[1]*Math.sin(pitch)+z*Math.cos(pitch);
        const f=12/(12+depth);return [w/2+x*scale*f,cy-y*scale*f,depth];
      }
      function line(points,color,width=1,dash=[]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>{const v=project(p);if(!i)ctx.moveTo(v[0],v[1]);else ctx.lineTo(v[0],v[1]);});ctx.stroke();ctx.setLineDash([]);}
      function face(points,fill,stroke=c['line-2']){ctx.beginPath();points.forEach((p,i)=>{const v=project(p);if(!i)ctx.moveTo(v[0],v[1]);else ctx.lineTo(v[0],v[1]);});ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.lineWidth=1;ctx.strokeStyle=stroke;ctx.stroke();}
      // Rigid table volume; mount holes describe the actual tabletop plane.
      face([[-4.5,-.7,-1.5],[4.5,-.7,-1.5],[4.5,-.7,3.3],[-4.5,-.7,3.3]],c.surface);
      face([[-4.5,-.7,3.3],[4.5,-.7,3.3],[4.5,-.95,3.3],[-4.5,-.95,3.3]],c.bg);
      for(let x=-4;x<=4;x+=.55)for(let z=-1;z<3.1;z+=.55){const p=project([x,-.69,z]);ctx.beginPath();ctx.arc(p[0],p[1],.8,0,Math.PI*2);ctx.fillStyle=c.line;ctx.fill();}
      const sorted=parts.slice().sort((a,b)=>project([b.x,0,b.z])[2]-project([a.x,0,a.z])[2]);
      for(const part of sorted){
        const {x,z}=part;
        face([[x-.29,-.65,z-.27],[x+.29,-.65,z-.27],[x+.29,-.65,z+.27],[x-.29,-.65,z+.27]],c.bg);
        line([[x,-.65,z],[x,.15,z]],c['line-2'],3);
        if(part.kind==='lens'){
          const ring=[];for(let i=0;i<=64;i++){const t=i/64*Math.PI*2;ring.push([x,.64+Math.sin(t)*.55,z+Math.cos(t)*.55]);}
          face(ring,c['accent-soft'],c.accent);
          const inner=[];for(let i=0;i<=64;i++){const t=i/64*Math.PI*2;inner.push([x+.07,.64+Math.sin(t)*.47,z+Math.cos(t)*.47]);}line(inner,c['line-2'],1);
        } else {
          const ww=part.kind==='grating'?.48:.32;
          face([[x-ww,.1,z],[x+ww,.1,z],[x+ww,1.2,z],[x-ww,1.2,z]],part.kind==='detector'?c['accent-soft']:c.bg);
          if(part.kind==='grating')for(let i=-5;i<6;i++)line([[x+i*.075,.15,z+.01],[x+i*.075,1.15,z+.01]],c['line-2'],.7);
          if(part.kind==='slit')line([[x,.4,z+.01],[x,.9,z+.01]],c.accent,2);
          if(part.kind==='detector')for(let i=0;i<8;i++)line([[x-.23+i*.065,.3,z+.01],[x-.23+i*.065,1,z+.01]],i%2?c.accent:c['chart-secondary'],1.2);
        }
      }
      // The grating separates wavelengths. All colored rays terminate at the detector.
      const common=[[-4.5,.65,.25],[-3.6,.65,.25],[-2.05,.65,.25],[0,.65,.25]];
      line(common,c.accent,1.8);
      for(let k=-2;k<=2;k++){
        const delta=k*.09;
        const path=[[0,.65,.25],[1.8,.65,1.3+delta],[3.55,.65,2.3+delta*2]];
        line(path,k===0?c.accent:c['chart-secondary'],k===0?1.7:1);
        if(motionOn()){
          const t=(time*.00014+k*.18+2)%1;
          const seg=t<.5?0:1,f=t<.5?t*2:(t-.5)*2;
          const a=path[seg],b=path[seg+1],p=project(a.map((v,i)=>v+(b[i]-v)*f));
          ctx.beginPath();ctx.arc(p[0],p[1],1.8,0,Math.PI*2);ctx.fillStyle=c.accent;ctx.fill();
        }
      }
      ctx.font=`${w<390?9:10}px ui-monospace,monospace`;ctx.textAlign='center';
      for(const p of parts){const anchor=project([p.x,1.35,p.z]);ctx.fillStyle=c.muted;ctx.fillText(p.label,anchor[0],anchor[1]-8);}
    }
    drawBench=setupCanvas(canvas,scene);
    function syncRotation(){const b=$('rotateBench');if(!b)return;b.textContent=rotation&&motionOn()?'Pause':'Rotate';b.setAttribute('aria-pressed',String(rotation&&motionOn()));}
    function frame(now){raf=0;if(!visible||document.hidden||!motionOn()||!rotation||drag)return;const dt=Math.min(now-last||16,50);last=now;time+=dt;yaw+=Math.sin(time*.0002)*.00013;drawBench?.draw();raf=requestAnimationFrame(frame);}
    function start(){if(!raf&&visible&&!document.hidden&&motionOn()&&rotation&&!drag){last=0;raf=requestAnimationFrame(frame);}}
    function stop(){if(raf)cancelAnimationFrame(raf);raf=0;}
    $('rotateBench')?.addEventListener('click',()=>{rotation=!rotation;syncRotation();if(rotation)start();else stop();});
    $('resetBench')?.addEventListener('click',()=>{yaw=-.38;pitch=.65;time=0;drawBench?.draw();});
    canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;drag={x:e.clientX,y:e.clientY,yaw,pitch};stop();if(e.pointerType==='mouse')canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw+(e.clientX-drag.x)*.006;pitch=Math.max(.25,Math.min(1.05,drag.pitch+(e.clientY-drag.y)*.004));drawBench?.draw();});
    const end=()=>{drag=null;start();};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('pointerleave',e=>{if(!canvas.hasPointerCapture(e.pointerId))end();});
    canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();if(e.key==='ArrowLeft')yaw-=.08;if(e.key==='ArrowRight')yaw+=.08;if(e.key==='ArrowUp')pitch=Math.min(1.05,pitch+.05);if(e.key==='ArrowDown')pitch=Math.max(.25,pitch-.05);drawBench?.draw();});
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)start();else stop();},{threshold:.03}).observe(canvas);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else start();});
    document.addEventListener('observatory:motion',()=>{syncRotation();if(motionOn())start();else{stop();drawBench?.draw();}});
    syncRotation();start();
  }
})();
