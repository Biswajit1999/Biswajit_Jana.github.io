import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const canvas = document.querySelector('#universe-canvas');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0c0805, .026);
const camera = new THREE.PerspectiveCamera(48, innerWidth/innerHeight, .1, 220);
camera.position.set(0,2.6,19);

const root = new THREE.Group(); scene.add(root);
const orbitalRoot = new THREE.Group(); root.add(orbitalRoot);
const nodeRoot = new THREE.Group(); root.add(nodeRoot);
const instrumentRoot = new THREE.Group(); root.add(instrumentRoot);

const C = {amber:0xe3a35a,rust:0xc66743,cyan:0x7fcad2,green:0x85bd8b,ivory:0xf2e6d2,bg:0x0c0805};

function makeGlowTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,244,220,1)');g.addColorStop(.15,'rgba(255,204,130,.95)');g.addColorStop(.45,'rgba(220,130,65,.28)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
const glowTex=makeGlowTexture();

const starCount = innerWidth < 700 ? 1100 : 2600;
const starPos = new Float32Array(starCount*3); const starCol=new Float32Array(starCount*3);
const col = new THREE.Color();
for(let i=0;i<starCount;i++){
  const r=18+Math.random()*72, t=Math.random()*Math.PI*2, u=Math.acos(2*Math.random()-1);
  starPos[i*3]=Math.sin(u)*Math.cos(t)*r;starPos[i*3+1]=Math.cos(u)*r*.62;starPos[i*3+2]=Math.sin(u)*Math.sin(t)*r;
  col.setHex(Math.random()>.82?C.amber:C.ivory); const s=.35+Math.random()*.65;starCol[i*3]=col.r*s;starCol[i*3+1]=col.g*s;starCol[i*3+2]=col.b*s;
}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(starPos,3));sg.setAttribute('color',new THREE.BufferAttribute(starCol,3));
const stars=new THREE.Points(sg,new THREE.PointsMaterial({size:.055,vertexColors:true,transparent:true,opacity:.82,sizeAttenuation:true}));scene.add(stars);

const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,4),new THREE.MeshBasicMaterial({color:C.amber,wireframe:true,transparent:true,opacity:.34}));root.add(core);
const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:C.amber,transparent:true,opacity:.7,depthWrite:false}));coreGlow.scale.set(6.8,6.8,1);root.add(coreGlow);

function orbit(radius, tiltX, tiltZ, color=C.amber, opacity=.16){
  const curve=new THREE.EllipseCurve(0,0,radius,radius,0,Math.PI*2);const pts=curve.getPoints(220).map(p=>new THREE.Vector3(p.x,0,p.y));
  const g=new THREE.BufferGeometry().setFromPoints(pts), m=new THREE.LineBasicMaterial({color,transparent:true,opacity});const l=new THREE.LineLoop(g,m);l.rotation.x=tiltX;l.rotation.z=tiltZ;orbitalRoot.add(l);return l;
}
[2.1,3.05,4.25,5.6,7.2].forEach((r,i)=>orbit(r,Math.PI/2 + (i-2)*.055,(i-2)*.11,i===3?C.cyan:C.amber,.07+i*.018));
orbit(5.0,.9,.38,C.rust,.12); orbit(6.4,1.08,-.6,C.cyan,.095);

const NODE_DATA=[
  {id:'exohspec',title:'EXOhSPEC',kicker:'Instrumentation',text:'Closed-loop thermal and adaptive-optics stabilisation for a high-resolution precision-RV spectrograph.',kind:'instrument',p:[-5.4,2.3,-.5],c:C.amber},
  {id:'control',title:'Feedback Control',kicker:'Control systems',text:'State-machine control, TEC response, AO correction and environmental stability.',kind:'instrument',p:[-3.1,-1.7,1.4],c:C.amber},
  {id:'wasp121',title:'WASP-121 b',kicker:'Exoplanet atmosphere',text:'Ultra-hot Jupiter phase-curve research with a pronounced day-night thermal contrast.',kind:'planet',p:[4.8,2.45,-1],c:C.cyan},
  {id:'wasp107',title:'WASP-107 b',kicker:'Exoplanet atmosphere',text:'Warm-Neptune atmospheric analysis using JWST-era archival data.',kind:'planet',p:[6.0,-.3,1.2],c:C.cyan},
  {id:'hd189',title:'HD 189733 b',kicker:'Transmission spectrum',text:'Cobalt-blue hot Jupiter research focused on transmission spectroscopy and atmospheric haze.',kind:'planet',p:[3.55,-2.65,.1],c:C.cyan},
  {id:'k218',title:'K2-18 b',kicker:'Temperate sub-Neptune',text:'Atmospheric evidence and interpretation for a temperate sub-Neptune.',kind:'planet',p:[1.7,3.8,1.6],c:C.cyan},
  {id:'detection',title:'Detection Methods',kicker:'Algorithms',text:'Transit photometry, radial velocity, microlensing and direct-imaging explainers backed by quantitative code.',kind:'software',p:[-1.0,4.8,-1.7],c:C.rust},
  {id:'aether',title:'AETHER',kicker:'Computational visual laboratory',text:'Interactive Three.js particle, shader, mathematical and astrophysical visual experiments.',kind:'software',p:[1.2,-4.5,-1.2],c:C.rust},
  {id:'github',title:'Research Software',kicker:'Open source',text:'Analysis scripts, reproducible reports, scientific web tools and control-system code.',kind:'software',p:[-5.1,-3.2,-1.4],c:C.rust},
  {id:'papers',title:'Publications & Research',kicker:'Research output',text:'Technical writing, papers, preprints, posters and long-form research documentation.',kind:'paper',p:[5.4,-3.8,-2.5],c:C.green}
];
const nodes=[]; const raycaster=new THREE.Raycaster(); const pointer=new THREE.Vector2(10,10);
for(const d of NODE_DATA){
  const g=new THREE.Group();g.position.set(...d.p);g.userData=d;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:d.c,transparent:true,opacity:.88,depthWrite:false}));s.scale.set(.82,.82,1);g.add(s);
  const m=new THREE.Mesh(new THREE.SphereGeometry(.115,16,12),new THREE.MeshBasicMaterial({color:d.c}));m.userData=d;g.add(m);g.userData.pick=m;
  nodeRoot.add(g);nodes.push(g);
}
function lineBetween(a,b,color=C.amber,opacity=.12){const g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]);nodeRoot.add(new THREE.Line(g,new THREE.LineBasicMaterial({color,transparent:true,opacity})));}
for(let i=0;i<NODE_DATA.length;i++){lineBetween([0,0,0],NODE_DATA[i].p,NODE_DATA[i].c,.08);if(i>0&&i%2===0)lineBetween(NODE_DATA[i-1].p,NODE_DATA[i].p,NODE_DATA[i].c,.05)}

for(let i=0;i<7;i++){
  const frame=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.25,.72,.72)),new THREE.LineBasicMaterial({color:i%2?C.amber:C.rust,transparent:true,opacity:.28}));
  frame.position.set(-6+i*2.0, -6.5 + Math.sin(i*.8)*.35, -5 + i*.72); frame.rotation.y=i*.09; instrumentRoot.add(frame);
}

const sceneEls=[...document.querySelectorAll('[data-scene]')];
const CAM={
 hero:{p:[0,2.6,19],t:[0,0,0]},
 universe:{p:[8.8,5.5,16],t:[0,.4,0]},
 instrumentation:{p:[-8.8,-2.5,11],t:[-1.7,-2.2,-1.2]},
 exoplanets:{p:[10.5,2.0,9.5],t:[3.2,.2,0]},
 software:{p:[-10.5,4.1,13],t:[-1,-.3,0]},
 research:{p:[3.0,8.5,15.5],t:[0,0,0]},
 contact:{p:[0,.4,22],t:[0,0,0]}
};
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const camPos=new THREE.Vector3(...CAM.hero.p), camTarget=new THREE.Vector3(...CAM.hero.t), desiredPos=camPos.clone(), desiredTarget=camTarget.clone();
let activeScene='hero', mouseOrbitX=0,mouseOrbitY=0,focused=null;
function setScene(name){if(!CAM[name]||name===activeScene)return;activeScene=name;desiredPos.set(...CAM[name].p);desiredTarget.set(...CAM[name].t);document.body.dataset.scene=name;}
function updateScroll(){let best=sceneEls[0],bestD=1e9;const mid=innerHeight*.5;for(const el of sceneEls){const r=el.getBoundingClientRect();const d=Math.abs((r.top+r.height*.5)-mid);if(d<bestD){bestD=d;best=el}}setScene(best.dataset.scene);const h=document.documentElement.scrollHeight-innerHeight;document.querySelector('#progress-bar').style.width=(h?scrollY/h*100:0)+'%';document.querySelector('.topbar').classList.toggle('scrolled',scrollY>20);}
addEventListener('scroll',updateScroll,{passive:true});updateScroll();
function onPointerMove(e){pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1;mouseOrbitX=(e.clientX/innerWidth-.5);mouseOrbitY=(e.clientY/innerHeight-.5);}addEventListener('pointermove',onPointerMove,{passive:true});
function showPanel(d){focused=d.id;const p=document.querySelector('#node-panel');p.hidden=false;document.querySelector('#node-kicker').textContent=d.kicker;document.querySelector('#node-title').textContent=d.title;document.querySelector('#node-text').textContent=d.text;}
function pickNode(e){pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(nodes.map(n=>n.userData.pick));if(hits.length)showPanel(hits[0].object.userData);}
canvas.addEventListener('click',pickNode);document.querySelector('#node-close').addEventListener('click',()=>{document.querySelector('#node-panel').hidden=true;focused=null});document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>{const d=NODE_DATA.find(n=>n.id===b.dataset.focus);if(d)showPanel(d)}));
const motionBtn=document.querySelector('#motion-toggle');function applyMotion(){document.body.classList.toggle('reduced-motion',reduced);motionBtn.setAttribute('aria-pressed',String(reduced));motionBtn.textContent=reduced?'Enable motion':'Reduce motion';}motionBtn.addEventListener('click',()=>{reduced=!reduced;applyMotion()});applyMotion();
function resize(){renderer.setSize(innerWidth,innerHeight,false);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<700?1.35:1.7));camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize,{passive:true});
const clock=new THREE.Clock();
function animate(){const t=clock.getElapsedTime();const ease=reduced?.12:.035;camPos.lerp(desiredPos,ease);camTarget.lerp(desiredTarget,ease);camera.position.copy(camPos);if(!reduced){camera.position.x+=mouseOrbitX*.35;camera.position.y-=mouseOrbitY*.22}camera.lookAt(camTarget);if(!reduced){root.rotation.y=Math.sin(t*.11)*.05;orbitalRoot.rotation.y=t*.018;core.rotation.x=t*.08;core.rotation.y=t*.13;stars.rotation.y=t*.0025}nodes.forEach((n,i)=>{const base=focused===n.userData.id?1.9:1;n.scale.lerp(new THREE.Vector3(base,base,base),.08);if(!reduced)n.position.y=NODE_DATA[i].p[1]+Math.sin(t*.55+i)*.09});coreGlow.material.opacity=.55+Math.sin(t*1.4)*.08;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(nodes.map(n=>n.userData.pick));canvas.style.cursor=hits.length?'pointer':'grab';renderer.render(scene,camera);requestAnimationFrame(animate);}animate();