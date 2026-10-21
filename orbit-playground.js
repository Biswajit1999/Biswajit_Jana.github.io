/* A small projected 3D scene. Illustrative orbits, not an ephemeris. */
(() => {
 const host=document.querySelector('.orbit-lab'),canvas=host?.querySelector('canvas');
 if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const toggle=host.querySelector('[data-orbit-toggle]'),reset=host.querySelector('[data-orbit-reset]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduced.matches||document.documentElement.dataset.motion==='off',visible=false,frame=0,last=0,time=0,width=320,height=300;
 let tilt=.92,yaw=-.2,drag=null;
 const planets=[
  {name:'Mercury',radius:.42,size:5.5,period:7,phase:1.5,inclination:.12,color:'#aebbd0'},
  {name:'Earth',radius:.72,size:10,period:29,phase:4.2,inclination:0,color:'#51bdb5'},
  {name:'Mars',radius:1,size:7.5,period:55,phase:.6,inclination:.05,color:'#c48a76'}
 ];
 function project(x,y,z=0){
  const xx=x*Math.cos(yaw)-y*Math.sin(yaw),yy=x*Math.sin(yaw)+y*Math.cos(yaw);
  const sy=yy*Math.cos(tilt)-z*Math.sin(tilt),depth=yy*Math.sin(tilt)+z*Math.cos(tilt);
  const scale=520/(520+depth);
  return {x:width/2+xx*scale,y:height*.48+sy*scale,z:depth,scale};
 }
 function point(angle,radius,inclination=0){
  const r=Math.min(width,height)*.39*radius;
  return project(r*Math.cos(angle),r*Math.sin(angle)*Math.cos(inclination),r*Math.sin(angle)*Math.sin(inclination));
 }
 function sphere(p,size,color,isSun=false){
  const r=size*p.scale,g=ctx.createRadialGradient(p.x-r*.35,p.y-r*.4,r*.03,p.x,p.y,r);
  g.addColorStop(0,isSun?'#fff4d0':'#edf9fc');g.addColorStop(.25,color);g.addColorStop(1,isSun?'#bd7927':'#132739');
  ctx.save();ctx.shadowColor=isSun?'#e6b65c80':color+'50';ctx.shadowBlur=isSun?28:10;
  ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 function draw(){
  const dark=document.documentElement.dataset.theme==='dark';
  ctx.clearRect(0,0,width,height);
  const line=dark?'rgba(130,177,203,.28)':'rgba(48,94,114,.25)';
  for(let i=0;i<planets.length;i++){
   const planet=planets[i];ctx.strokeStyle=line;ctx.lineWidth=1;ctx.beginPath();
   for(let j=0;j<=120;j++){const p=point(j/120*Math.PI*2,planet.radius,planet.inclination);j?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)}ctx.stroke();
  }
  const bodies=planets.map(p=>({...p,pos:point(p.phase+time/p.period*Math.PI*2,p.radius,p.inclination)}));
  const sun={name:'Sun',size:17,color:'#e7b764',pos:project(0,0),isSun:true};
  [...bodies,sun].sort((a,b)=>b.pos.z-a.pos.z).forEach(p=>{
   sphere(p.pos,p.size,p.color,p.isSun);
   if(!p.isSun){ctx.fillStyle=dark?'#afc3d2':'#435d6a';ctx.font='10px "DM Mono",monospace';ctx.textAlign='center';ctx.fillText(p.name,p.pos.x,p.pos.y+p.size*p.pos.scale+17)}
  });
  canvas.dataset.rendered='true';
 }
 function animate(now){
  frame=0;if(paused||!visible||document.hidden){last=0;return}
  if(last)time+=Math.min((now-last)/1000,.06);last=now;draw();schedule();
 }
 function schedule(){if(!frame&&!paused&&visible&&!document.hidden)frame=requestAnimationFrame(animate)}
 function sync(){toggle.textContent=paused?'Play orbits':'Pause orbits';toggle.setAttribute('aria-pressed',String(paused));draw();schedule()}
 toggle.addEventListener('click',()=>{paused=!paused;last=0;sync()});
 reset.addEventListener('click',()=>{tilt=.92;yaw=-.2;draw()});
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,yaw};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw+(e.clientX-drag.x)*.008;draw()});
 for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>{drag=null});
 host.querySelector('[data-orbit-view]').addEventListener('click',()=>{tilt=tilt>.6?.35:1.1;draw()});
 reduced.addEventListener('change',()=>{if(reduced.matches)paused=true;sync()});
 document.addEventListener('visibilitychange',()=>{last=0;schedule()});
 new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 new ResizeObserver(()=>{
  width=canvas.clientWidth;height=canvas.clientHeight;
  const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);draw()
 }).observe(canvas);
 new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;schedule()},{threshold:.1}).observe(host);
 sync();
})();
