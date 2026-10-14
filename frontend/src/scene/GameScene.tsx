import { useRef, type MutableRefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, KeyboardControls, OrbitControls, Stars, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

export type Stall = { id:string; food:string; vendor:string; description:string; color:string; personality:string };
const STALL_X_START=-13,STALL_X_SPACING=5.2,STALL_Z_START=-9,STALL_Z_SPACING=9;
const WALK_STEP=0.35,WALK_RADIUS=0.38;
const WALK_MIN_X=-16.45,WALK_MIN_Z=-14,WALK_WIDTH=94,WALK_HEIGHT=81;
const stallPosition=(index:number):[number,number,number]=>[STALL_X_START+(index%6)*STALL_X_SPACING,0,STALL_Z_START+Math.floor(index/6)*STALL_Z_SPACING];
function walkable(x:number,z:number,stalls:Stall[]) {
  if(x<WALK_MIN_X+WALK_RADIUS||x>WALK_MIN_X+(WALK_WIDTH-1)*WALK_STEP-WALK_RADIUS||z<WALK_MIN_Z+WALK_RADIUS||z>WALK_MIN_Z+(WALK_HEIGHT-1)*WALK_STEP-WALK_RADIUS)return false;
  for(let i=0;i<stalls.length;i++){
    const [sx,,sz]=stallPosition(i);
    if(Math.abs(x-sx)<1.95+WALK_RADIUS&&Math.abs(z-sz)<1.43+WALK_RADIUS)return false;
  }
  return true;
}
type QueueNode={id:number;score:number};
function pushNode(heap:QueueNode[],node:QueueNode){let i=heap.push(node)-1;while(i>0){const p=(i-1)>>1;if(heap[p].score<=node.score)break;heap[i]=heap[p];i=p}heap[i]=node}
function popNode(heap:QueueNode[]):QueueNode|undefined {if(!heap.length)return;const root=heap[0],tail=heap.pop()!;if(heap.length){let i=0;while(true){const l=i*2+1,r=l+1;if(l>=heap.length)break;const c=r<heap.length&&heap[r].score<heap[l].score?r:l;if(heap[c].score>=tail.score)break;heap[i]=heap[c];i=c}heap[i]=tail}return root}
function findWalkPath(start:THREE.Vector3,target:THREE.Vector3,stalls:Stall[]) {
  const xOf=(id:number)=>WALK_MIN_X+(id%WALK_WIDTH)*WALK_STEP;
  const zOf=(id:number)=>WALK_MIN_Z+Math.floor(id/WALK_WIDTH)*WALK_STEP;
  const nearest=(x:number,z:number)=>Math.max(0,Math.min(WALK_HEIGHT-1,Math.round((z-WALK_MIN_Z)/WALK_STEP)))*WALK_WIDTH+Math.max(0,Math.min(WALK_WIDTH-1,Math.round((x-WALK_MIN_X)/WALK_STEP)));
  const startId=nearest(start.x,start.z),goalId=nearest(target.x,target.z),count=WALK_WIDTH*WALK_HEIGHT;
  const allowed=(id:number)=>walkable(xOf(id),zOf(id),stalls);
  const findNearby=(id:number)=>{if(allowed(id))return id;const ox=id%WALK_WIDTH,oz=Math.floor(id/WALK_WIDTH);for(let r=1;r<10;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){if(Math.max(Math.abs(dx),Math.abs(dz))!==r)continue;const x=ox+dx,z=oz+dz,n=z*WALK_WIDTH+x;if(x>=0&&x<WALK_WIDTH&&z>=0&&z<WALK_HEIGHT&&allowed(n))return n}return id};
  const source=findNearby(startId),goal=findNearby(goalId),cost=new Float32Array(count);cost.fill(Infinity);cost[source]=0;
  const parent=new Int32Array(count);parent.fill(-1);const closed=new Uint8Array(count),heap:QueueNode[]=[];
  const heuristic=(id:number)=>{const dx=Math.abs(id%WALK_WIDTH-goal%WALK_WIDTH),dz=Math.abs(Math.floor(id/WALK_WIDTH)-Math.floor(goal/WALK_WIDTH));return Math.max(dx,dz)+(Math.SQRT2-1)*Math.min(dx,dz)};
  pushNode(heap,{id:source,score:heuristic(source)});
  const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  while(heap.length){const current=popNode(heap)!;if(closed[current.id])continue;if(current.id===goal)break;closed[current.id]=1;const cx=current.id%WALK_WIDTH,cz=Math.floor(current.id/WALK_WIDTH);
    for(const [dx,dz] of directions){const nx=cx+dx,nz=cz+dz;if(nx<0||nx>=WALK_WIDTH||nz<0||nz>=WALK_HEIGHT)continue;const next=nz*WALK_WIDTH+nx;if(closed[next]||!allowed(next))continue;if(dx&&dz&&(!allowed(cz*WALK_WIDTH+nx)||!allowed(nz*WALK_WIDTH+cx)))continue;const newCost=cost[current.id]+(dx&&dz?Math.SQRT2:1);if(newCost>=cost[next])continue;cost[next]=newCost;parent[next]=current.id;pushNode(heap,{id:next,score:newCost+heuristic(next)})}
  }
  if(source!==goal&&parent[goal]===-1)return [] as THREE.Vector3[];
  const raw:THREE.Vector3[]=[];for(let id=goal;id!==-1;id=parent[id]){raw.push(new THREE.Vector3(xOf(id),0,zOf(id)));if(id===source)break}raw.reverse();if(!raw.length)return [];
  const clearLine=(a:THREE.Vector3,b:THREE.Vector3)=>{const distance=a.distanceTo(b),steps=Math.ceil(distance/0.15);for(let i=1;i<steps;i++){const t=i/steps;if(!walkable(THREE.MathUtils.lerp(a.x,b.x,t),THREE.MathUtils.lerp(a.z,b.z,t),stalls))return false}return true};
  const smooth=[new THREE.Vector3(start.x,0,start.z)];let anchor=0;
  while(anchor<raw.length-1){let next=raw.length-1;while(next>anchor+1&&!clearLine(raw[anchor],raw[next]))next--;smooth.push(raw[next]);anchor=next}
  const last=smooth[smooth.length-1];last.set(target.x,0,target.z);return smooth;
}

function StallBooth({ stall, position, onTalk, selected }: { stall:Stall; position:[number,number,number]; onTalk:(id:string)=>void; selected:boolean }) {
  const booth = useRef<THREE.Group>(null);
  const foodId=stall.id.toLowerCase();
  const foodColors:Record<string,string>={'pani-puri':'#d69a42','chaat':'#a94c36','masala-dosa':'#d29a42','idli-sambar':'#ede2cb','vada-pav':'#bc7439','pav-bhaji':'#c85635','jalebi':'#ec9d35','chai':'#87523b','momos':'#e8d8be','kathi-roll':'#c89454','kulfi':'#d7bf9d','biryani':'#bd9952','lassi':'#e4d099','dhokla':'#d7c562','poha':'#d6b55f','uttapam':'#c99e5c','paratha':'#cd9958','filter-coffee':'#815139'};
  return <group ref={booth} position={position} onClick={(event)=>{event.stopPropagation();onTalk(stall.id)}} onPointerOver={()=>{document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor='auto'}}>
    {selected&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,0.025,1.65]}><ringGeometry args={[1.15,1.42,32]}/><meshBasicMaterial color="#ffe0a2" transparent opacity={0.72}/></mesh>}
    <mesh position={[0,0.12,0]} receiveShadow><boxGeometry args={[3.85,0.24,2.75]}/><meshStandardMaterial color="#786047" roughness={0.9}/></mesh>
    <mesh position={[0,1.15,-1.23]} castShadow><boxGeometry args={[3.6,2.05,0.14]}/><meshStandardMaterial color="#654831" roughness={0.86}/></mesh>
    {[-1.72,1.72].flatMap(x=>[-1.22,1.18].map(z=><mesh key={`${x}-${z}`} position={[x,1.2,z]} castShadow><boxGeometry args={[0.14,2.3,0.14]}/><meshStandardMaterial color="#7b5235"/></mesh>))}
    <mesh position={[0,2.32,0.02]} castShadow><boxGeometry args={[3.9,0.18,2.85]}/><meshStandardMaterial color={stall.color} roughness={0.85}/></mesh>
    {Array.from({length:8},(_,i)=><mesh key={`canopy-${i}`} position={[-1.7+i*0.485,2.43,0.05]} castShadow><boxGeometry args={[0.49,0.12,2.8]}/><meshStandardMaterial color={i%2===0?stall.color:'#f0ddbd'} roughness={0.94}/></mesh>)}
    {Array.from({length:8},(_,i)=><mesh key={`valance-${i}`} position={[-1.7+i*0.485,2.2,1.2]} castShadow><boxGeometry args={[0.48,0.36,0.09]}/><meshStandardMaterial color={i%2===0?stall.color:'#f0ddbd'}/></mesh>)}
    <mesh position={[0,1.91,1.28]} castShadow><boxGeometry args={[2.6,0.45,0.12]}/><meshStandardMaterial color="#33251d"/></mesh>
    <Html position={[0,1.91,1.36]} center transform distanceFactor={7}>
      <div className="stall-sign"><b>{stall.food}</b><small>गरमा गरम · FRESH TODAY</small></div>
    </Html>
    <mesh position={[0,0.69,1.05]} castShadow><boxGeometry args={[3.15,0.74,0.48]}/><meshStandardMaterial color="#68462f" roughness={0.78}/></mesh>
    <mesh position={[0,1.08,1.05]} castShadow><boxGeometry args={[3.38,0.15,0.68]}/><meshStandardMaterial color="#b7895c" roughness={0.64}/></mesh>
    {[-1.15,0,1.15].map((x,i)=><group key={`dish-${i}`} position={[x,1.2,1.02]}>
      <mesh><cylinderGeometry args={[0.28,0.24,0.08,20]}/><meshStandardMaterial color="#c0c2bb" metalness={0.72} roughness={0.32}/></mesh>
      {!['pani-puri','masala-dosa','chai','filter-coffee','jalebi'].includes(foodId)&&Array.from({length:3},(_,j)=><mesh key={`bite-${j}`} position={[(j-1)*0.115,0.12,0]} castShadow><sphereGeometry args={[0.09,12,10]}/><meshStandardMaterial color={foodColors[foodId]||'#d7ad68'} roughness={0.84}/></mesh>)}
      {foodId==='pani-puri'&&Array.from({length:5},(_,j)=><mesh key={j} position={[(j-2)*0.075,0.13+(j%2)*0.025,0]} castShadow><sphereGeometry args={[0.075,10,10]}/><meshStandardMaterial color="#d59a47" roughness={0.9}/></mesh>)}
      {foodId.includes('dosa')&&i===1&&<mesh position={[0,0.06,0]}><cylinderGeometry args={[0.22,0.22,0.035,24]}/><meshStandardMaterial color="#d29a42" roughness={0.8}/></mesh>}
      {foodId==='idli-sambar'&&Array.from({length:3},(_,j)=><mesh key={`idli-${j}`} position={[(j-1)*0.13,0.1,0]}><cylinderGeometry args={[0.09,0.1,0.07,14]}/><meshStandardMaterial color="#f3ead8" roughness={0.95}/></mesh>)}
      {(foodId==='chai'||foodId==='filter-coffee')&&<mesh position={[0,0.1,0]}><cylinderGeometry args={[0.095,0.075,0.16,14]}/><meshStandardMaterial color="#e5d7c4" roughness={0.45}/></mesh>}
      {foodId==='jalebi'&&<><mesh position={[-0.09,0.08,0]}><torusGeometry args={[0.1,0.035,8,18]}/><meshStandardMaterial color="#ec9d35" roughness={0.55}/></mesh><mesh position={[0.1,0.08,0]}><torusGeometry args={[0.1,0.035,8,18]}/><meshStandardMaterial color="#ec9d35" roughness={0.55}/></mesh></>}
      {foodId==='kulfi'&&<mesh position={[0,0.16,0]} rotation={[0,0,0.1]}><capsuleGeometry args={[0.075,0.22,4,8]}/><meshStandardMaterial color="#efe0c0" roughness={0.7}/></mesh>}
      {foodId==='momos'&&Array.from({length:3},(_,j)=><mesh key={`momo-${j}`} position={[(j-1)*0.12,0.12,0]}><sphereGeometry args={[0.09,12,10]}/><meshStandardMaterial color="#f0e6d6" roughness={0.9}/></mesh>)}
      {foodId==='kathi-roll'&&<mesh position={[0,0.1,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[0.09,0.09,0.32,12]}/><meshStandardMaterial color="#d4a461" roughness={0.85}/></mesh>}
    </group>)}
    <mesh position={[0,2.08,0.68]}><sphereGeometry args={[0.09,12,12]}/><meshStandardMaterial color="#ffe3a3" emissive="#ffb653" emissiveIntensity={1.8}/></mesh>
    <group position={[0,0.53,0.12]}>
      <mesh position={[0,0.4,0]} castShadow><capsuleGeometry args={[0.27,0.55,4,10]}/><meshStandardMaterial color={stall.color}/></mesh>
      <mesh position={[0,0.56,0.18]} castShadow><boxGeometry args={[0.34,0.52,0.1]}/><meshStandardMaterial color="#eee0c3" roughness={0.95}/></mesh>
      <mesh position={[0,1.07,0]} castShadow><sphereGeometry args={[0.26,18,18]}/><meshStandardMaterial color="#bd805d"/></mesh>
      <mesh position={[0,1.35,0]}><cylinderGeometry args={[0.29,0.31,0.12,16]}/><meshStandardMaterial color="#49352b"/></mesh>
      {[-0.35,0.35].map(x=><mesh key={x} position={[x,0.42,0]} rotation={[0,0,x<0?0.12:-0.12]} castShadow><capsuleGeometry args={[0.095,0.38,4,8]}/><meshStandardMaterial color="#eee0c3"/></mesh>)}
    </group>
    <Html position={[0,2.85,0]} center distanceFactor={10}>
      <div className="vendor-label"><b>{stall.vendor}</b><span>· {stall.food}</span><small>TALK</small></div>
    </Html>
  </group>;
}

function Walker({ target, targetId, onArrive, playerRef, stalls }: {target:THREE.Vector3|null;targetId:string;onArrive:(id:string)=>void;playerRef:MutableRefObject<THREE.Group|null>;stalls:Stall[]}) {
  const arrivedTarget=useRef('');const plannedTarget=useRef<string|null>(null);const path=useRef<THREE.Vector3[]>([]);const pathIndex=useRef(0);
  const velocity=useRef(new THREE.Vector3());const manualActive=useRef(false);const leftArm=useRef<THREE.Group>(null);const rightArm=useRef<THREE.Group>(null);const leftForearm=useRef<THREE.Group>(null);const rightForearm=useRef<THREE.Group>(null);const leftLeg=useRef<THREE.Group>(null);const rightLeg=useRef<THREE.Group>(null);const leftShin=useRef<THREE.Group>(null);const rightShin=useRef<THREE.Group>(null);const torso=useRef<THREE.Group>(null);
  const [,get]=useKeyboardControls();
  useFrame((state,delta)=>{
    const ref=playerRef.current;if(!ref)return;const dt=Math.min(delta,0.05);const controls=get() as Record<string,boolean>;
    const manual=controls.forward||controls.backward||controls.left||controls.right;
    if(targetId!==plannedTarget.current){plannedTarget.current=targetId;arrivedTarget.current='';path.current=target?findWalkPath(ref.position,target,stalls):[];pathIndex.current=path.current.length>1?1:0}
    if(manual&&!manualActive.current)manualActive.current=true;
    if(!manual&&manualActive.current){manualActive.current=false;if(target){path.current=findWalkPath(ref.position,target,stalls);pathIndex.current=path.current.length>1?1:0}}
    const desired=new THREE.Vector3();
    if(manual){desired.set((controls.right?1:0)-(controls.left?1:0),0,(controls.backward?1:0)-(controls.forward?1:0));if(desired.lengthSq())desired.normalize().multiplyScalar(3.0)}
    else if(target&&path.current.length){
      while(pathIndex.current<path.current.length&&Math.hypot(path.current[pathIndex.current].x-ref.position.x,path.current[pathIndex.current].z-ref.position.z)<0.24)pathIndex.current++;
      if(pathIndex.current>=path.current.length){if(arrivedTarget.current!==targetId){arrivedTarget.current=targetId;onArrive(targetId)}}
      else{const waypoint=path.current[pathIndex.current];const dx=waypoint.x-ref.position.x,dz=waypoint.z-ref.position.z,distance=Math.hypot(dx,dz);const speed=Math.min(2.9,0.65+distance*1.25);desired.set(dx/Math.max(distance,0.001)*speed,0,dz/Math.max(distance,0.001)*speed)}
    }
    velocity.current.lerp(desired,1-Math.exp(-7.5*dt));
    let nextX=ref.position.x+velocity.current.x*dt,nextZ=ref.position.z+velocity.current.z*dt;
    if(!walkable(nextX,nextZ,stalls)){
      const canX=walkable(nextX,ref.position.z,stalls),canZ=walkable(ref.position.x,nextZ,stalls);
      if(canX&&!canZ){nextZ=ref.position.z;velocity.current.z=0}
      else if(canZ&&!canX){nextX=ref.position.x;velocity.current.x=0}
      else if(canX&&canZ){/* A corner contact: preserve the axis with more progress. */if(Math.abs(velocity.current.x)>Math.abs(velocity.current.z)){nextZ=ref.position.z;velocity.current.z=0}else{nextX=ref.position.x;velocity.current.x=0}}
      else{nextX=ref.position.x;nextZ=ref.position.z;velocity.current.set(0,0,0)}
    }
    ref.position.x=nextX;ref.position.z=nextZ;
    const moving=velocity.current.length()>0.12;
    if(moving){const facing=Math.atan2(velocity.current.x,velocity.current.z);const turn=Math.atan2(Math.sin(facing-ref.rotation.y),Math.cos(facing-ref.rotation.y));ref.rotation.y+=turn*(1-Math.exp(-10*dt))}
    ref.position.y=THREE.MathUtils.damp(ref.position.y,moving?Math.sin(state.clock.elapsedTime*10)*0.035:0,10,dt);
    const stride=moving?Math.sin(state.clock.elapsedTime*9)*0.54:0, counter=moving?Math.sin(state.clock.elapsedTime*9+Math.PI)*0.54:0;
    if(torso.current){torso.current.rotation.y=THREE.MathUtils.damp(torso.current.rotation.y,moving?stride*.07:0,8,dt);torso.current.rotation.z=THREE.MathUtils.damp(torso.current.rotation.z,moving?stride*.025:0,8,dt)}
    if(leftArm.current)leftArm.current.rotation.x=THREE.MathUtils.damp(leftArm.current.rotation.x,counter*.76,11,dt);
    if(rightArm.current)rightArm.current.rotation.x=THREE.MathUtils.damp(rightArm.current.rotation.x,stride*.76,11,dt);
    if(leftForearm.current)leftForearm.current.rotation.x=THREE.MathUtils.damp(leftForearm.current.rotation.x,-.24+Math.max(0,-counter)*.34,11,dt);
    if(rightForearm.current)rightForearm.current.rotation.x=THREE.MathUtils.damp(rightForearm.current.rotation.x,-.24+Math.max(0,-stride)*.34,11,dt);
    if(leftLeg.current)leftLeg.current.rotation.x=THREE.MathUtils.damp(leftLeg.current.rotation.x,stride,11,dt);
    if(rightLeg.current)rightLeg.current.rotation.x=THREE.MathUtils.damp(rightLeg.current.rotation.x,counter,11,dt);
    if(leftShin.current)leftShin.current.rotation.x=THREE.MathUtils.damp(leftShin.current.rotation.x,Math.max(0,-stride)*.78,11,dt);
    if(rightShin.current)rightShin.current.rotation.x=THREE.MathUtils.damp(rightShin.current.rotation.x,Math.max(0,-counter)*.78,11,dt);
  });
  return <group ref={playerRef} position={[0,0,12.8]}>
    <group ref={torso} position={[0,.95,0]}>
      <mesh position={[0,.45,0]} castShadow><capsuleGeometry args={[.31,.58,8,14]}/><meshStandardMaterial color="#2d5d88" roughness={.68}/></mesh>
      <mesh position={[0,.53,.275]} castShadow><boxGeometry args={[.43,.4,.035]}/><meshStandardMaterial color="#dce4e7" roughness={.9}/></mesh>
      <mesh position={[0,.16,0]} castShadow><cylinderGeometry args={[.27,.3,.18,18]}/><meshStandardMaterial color="#26394c" roughness={.8}/></mesh>
      <mesh position={[0,.92,0]} castShadow><cylinderGeometry args={[.1,.1,.13,14]}/><meshStandardMaterial color="#a96f50"/></mesh>
      <mesh position={[0,1.17,.015]} castShadow><sphereGeometry args={[.255,24,20]}/><meshStandardMaterial color="#b87958" roughness={.7}/></mesh>
      <mesh position={[0,1.34,-.035]} castShadow><sphereGeometry args={[.265,24,10,0,Math.PI*2,0,Math.PI*.58]}/><meshStandardMaterial color="#241c1a" roughness={.96}/></mesh>
      {[-.085,.085].map(x=><mesh key={x} position={[x,1.19,.23]}><sphereGeometry args={[.022,10,10]}/><meshStandardMaterial color="#271b16"/></mesh>)}
      <mesh position={[0,1.1,.245]}><boxGeometry args={[.065,.012,.012]}/><meshBasicMaterial color="#714335"/></mesh>
      {[-1,1].map(side=><group key={`arm-${side}`} ref={side<0?leftArm:rightArm} position={[side*.34,.68,0]} rotation={[0,0,side*.08]}><mesh position={[0,-.23,0]} castShadow><capsuleGeometry args={[.105,.3,5,10]}/><meshStandardMaterial color="#2d5d88" roughness={.7}/></mesh><group ref={side<0?leftForearm:rightForearm} position={[0,-.43,0]}><mesh position={[0,-.18,0]} castShadow><capsuleGeometry args={[.083,.26,5,10]}/><meshStandardMaterial color="#b87958" roughness={.75}/></mesh><mesh position={[0,-.4,.015]} castShadow><sphereGeometry args={[.1,14,12]}/><meshStandardMaterial color="#b87958"/></mesh></group></group>)}
    </group>
    {[-1,1].map(side=><group key={`leg-${side}`} ref={side<0?leftLeg:rightLeg} position={[side*.155,.93,0]}><mesh position={[0,-.26,0]} castShadow><capsuleGeometry args={[.135,.34,5,10]}/><meshStandardMaterial color="#26394c" roughness={.82}/></mesh><group ref={side<0?leftShin:rightShin} position={[0,-.52,0]}><mesh position={[0,-.23,0]} castShadow><capsuleGeometry args={[.12,.31,5,10]}/><meshStandardMaterial color="#26394c" roughness={.82}/></mesh><mesh position={[0,-.48,.09]} castShadow><boxGeometry args={[.2,.12,.36]}/><meshStandardMaterial color="#24272a" roughness={.82}/></mesh></group></group>)}
    <Html position={[0,2.55,0]} center distanceFactor={10}><div className="player-tag">YOU</div></Html>
  </group>;
}

function StreetLamp({position}:{position:[number,number,number]}){return <group position={position}><mesh position={[0,2.4,0]} castShadow><cylinderGeometry args={[.055,.075,4.8,10]}/><meshStandardMaterial color="#31353a" metalness={.5} roughness={.5}/></mesh><mesh position={[.32,4.65,0]} rotation={[0,0,-Math.PI/2.8]}><cylinderGeometry args={[.04,.04,.68,8]}/><meshStandardMaterial color="#31353a"/></mesh><mesh position={[.63,4.4,0]}><sphereGeometry args={[.15,14,12]}/><meshStandardMaterial color="#ffe0a0" emissive="#ffaf52" emissiveIntensity={2.5}/></mesh><pointLight position={[.63,4.25,0]} color="#ffb55c" intensity={5} distance={7}/></group>}
function ParkedScooter({position,rotation=0}:{position:[number,number,number];rotation?:number}){return <group position={position} rotation={[0,rotation,0]}><mesh position={[0,.43,0]} castShadow><boxGeometry args={[.42,.24,1.18]}/><meshStandardMaterial color="#b63f35" metalness={.22} roughness={.48}/></mesh><mesh position={[0,.68,-.18]} rotation={[0,0,.16]} castShadow><boxGeometry args={[.09,.7,.09]}/><meshStandardMaterial color="#24282c"/></mesh><mesh position={[0,.7,.22]} castShadow><boxGeometry args={[.34,.12,.42]}/><meshStandardMaterial color="#302b29" roughness={.75}/></mesh>{[-.43,.43].map(z=><mesh key={z} position={[0,.23,z]} rotation={[0,Math.PI/2,0]} castShadow><cylinderGeometry args={[.21,.21,.09,16]}/><meshStandardMaterial color="#16191b" roughness={.85}/></mesh>)}</group>}
function StreetDetails(){return <group>
  {[-14,-4,5,14].map(x=><group key={`road-mark-${x}`} position={[x,-.045,2.8]}><mesh rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2.6,.16]}/><meshBasicMaterial color="#e5c477" transparent opacity={.7}/></mesh></group>)}
  {[-15.5,15.5].map(x=><group key={`curb-${x}`} position={[x,.02,0]}>{Array.from({length:12},(_,i)=><mesh key={i} position={[0,0,-13.7+i*2.5]} castShadow><boxGeometry args={[.55,.18,2.25]}/><meshStandardMaterial color={i%2?'#e6d3ab':'#5f6060'} roughness={.95}/></mesh>)}</group>)}
  {[-15,-5,5,15].map((x,i)=><StreetLamp key={x} position={[x,0,13.8-i%2*1.2]}/>) }
  <ParkedScooter position={[-11.2,0,12.2]} rotation={-.7}/><ParkedScooter position={[11.9,0,11.1]} rotation={.65}/>
  {[[-12.2,-13.3],[12.7,-13.3],[-12.4,13.5],[12.8,13.5]].map(([x,z],i)=><group key={`table-${i}`} position={[x,0,z]}><mesh position={[0,.67,0]} castShadow><cylinderGeometry args={[.62,.62,.08,20]}/><meshStandardMaterial color="#5d4131" roughness={.85}/></mesh><mesh position={[0,.32,0]} castShadow><cylinderGeometry args={[.055,.055,.66,10]}/><meshStandardMaterial color="#3d3029"/></mesh>{[-.55,.55].map(dx=><mesh key={dx} position={[dx,.36,0]} castShadow><boxGeometry args={[.34,.45,.34]}/><meshStandardMaterial color="#a94d35" roughness={.86}/></mesh>)}</group>)}
  {[-1,1].map(side=><group key={`buildings-${side}`} position={[side*20,0,0]}>{[-10,0,10].map((z,i)=><group key={z} position={[0,0,z]}><mesh position={[0,3.2,0]} castShadow receiveShadow><boxGeometry args={[4.2,6.4,8.7]}/><meshStandardMaterial color={i%2?'#544d51':'#595046'} roughness={.96}/></mesh><mesh position={[-side*2.11,3.4,0]}><boxGeometry args={[.06,.72,1.05]}/><meshStandardMaterial color="#ffd071" emissive="#c57732" emissiveIntensity={.55}/></mesh></group>)}</group>)}
</group>}

function Plaza({ stalls, onTalk, activeId, onArrive }: { stalls:Stall[]; onTalk:(id:string)=>void; activeId:string; onArrive:(id:string)=>void }) {
  const playerRef=useRef<THREE.Group>(null);
  const controlsRef=useRef<any>(null);
  const lastPlayerPosition=useRef(new THREE.Vector3(0,0,12.8));
  const activeIndex=stalls.findIndex(stall=>stall.id===activeId);
  const target=activeIndex<0?null:new THREE.Vector3(STALL_X_START+(activeIndex%6)*STALL_X_SPACING,0,STALL_Z_START+Math.floor(activeIndex/6)*STALL_Z_SPACING+2.4);
  useFrame(()=>{
    if(!playerRef.current||!controlsRef.current)return;
    const delta=playerRef.current.position.clone().sub(lastPlayerPosition.current);
    if(delta.lengthSq()>0.000001){
      controlsRef.current.target.add(delta);
      controlsRef.current.object.position.add(delta);
      controlsRef.current.update();
      lastPlayerPosition.current.copy(playerRef.current.position);
    }
  });
  return <>
    <color attach="background" args={['#182232']}/><fog attach="fog" args={['#182232',20,55]}/>
    <ambientLight intensity={.72}/><hemisphereLight args={['#b7c9eb','#7d5c3d',1.25]}/>
    <directionalLight position={[8,14,6]} intensity={2.5} castShadow shadow-mapSize={[2048,2048]} shadow-bias={-.0002}/>
    <pointLight position={[0,8,0]} color="#ffb35c" intensity={38} distance={28}/>
    <Stars radius={80} depth={35} count={350} factor={2} fade speed={0.15}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.12,0]} receiveShadow><planeGeometry args={[40,34]}/><meshStandardMaterial color="#55483c" roughness={.98}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.09,0]} receiveShadow><planeGeometry args={[34,30]}/><meshStandardMaterial color="#b59672" roughness={.94}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.06,0]} receiveShadow><planeGeometry args={[5.1,30]}/><meshStandardMaterial color="#45494b" roughness={.9}/></mesh>
    <StreetDetails/>
    {[-19,19].map(x=><group key={x} position={[x,0,-1]}><mesh position={[0,3,0]} castShadow><boxGeometry args={[4,6,32]}/><meshStandardMaterial color={x<0?'#62514a':'#66525a'}/></mesh><mesh position={[0,6.1,0]}><boxGeometry args={[4.15,0.22,32.1]}/><meshStandardMaterial color="#92704c"/></mesh>{[-12,-6,0,6,12].map(z=><mesh key={z} position={[-2.02,3,z]}><boxGeometry args={[0.05,0.65,0.8]}/><meshStandardMaterial color="#ffc56f" emissive="#ff9a3b" emissiveIntensity={0.5}/></mesh>)}</group>)}
    {stalls.map((stall,index)=>{
      return <StallBooth key={stall.id} stall={stall} position={stallPosition(index)} onTalk={onTalk} selected={stall.id===activeId}/>;
    })}
    <Walker target={target} targetId={activeId} onArrive={onArrive} playerRef={playerRef} stalls={stalls}/>
    <OrbitControls ref={controlsRef} target={[0,1,0]} minDistance={11} maxDistance={25} maxPolarAngle={Math.PI/2.08} enablePan/>
  </>;
}

export default function GameScene({stalls,onTalk,activeId,onArrive}:{stalls:Stall[];onTalk:(id:string)=>void;activeId:string;onArrive:(id:string)=>void}) {
  return <div className="scene-wrap city-plaza"><KeyboardControls map={[
    {name:'forward',keys:['ArrowUp','KeyW']},{name:'backward',keys:['ArrowDown','KeyS']},
    {name:'left',keys:['ArrowLeft','KeyA']},{name:'right',keys:['ArrowRight','KeyD']},
  ]}><Canvas shadows dpr={[1,1.75]} gl={{antialias:true}} camera={{position:[0,13,22],fov:42}}><Plaza stalls={stalls} onTalk={onTalk} activeId={activeId} onArrive={onArrive}/></Canvas></KeyboardControls>
    <div className="scene-hint">WASD / ARROWS TO WANDER · CLICK OR TELL ME WHERE TO GO</div>
  </div>;
}
