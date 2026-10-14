import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, KeyboardControls, OrbitControls, Stars, useKeyboardControls } from '@react-three/drei';
import * as THREE from 'three';

export type Stall = { id:string; food:string; vendor:string; description:string; color:string; personality:string };

function StallBooth({ stall, position, onTalk, selected }: { stall:Stall; position:[number,number,number]; onTalk:(id:string)=>void; selected:boolean }) {
  const booth = useRef<THREE.Group>(null);
  return <group ref={booth} position={position} onClick={(event)=>{event.stopPropagation();onTalk(stall.id)}} onPointerOver={()=>{document.body.style.cursor='pointer'}} onPointerOut={()=>{document.body.style.cursor='auto'}}>
    {selected&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,0.015,0.95]}><ringGeometry args={[1.2,1.5,32]}/><meshBasicMaterial color="#ffe0a2" transparent opacity={0.72}/></mesh>}
    <mesh position={[0,1.18,0]} castShadow><boxGeometry args={[3.25,2.35,1.95]}/><meshStandardMaterial color="#634331" roughness={0.8}/></mesh>
    <mesh position={[0,2.18,0]} castShadow><boxGeometry args={[3.6,0.22,2.2]}/><meshStandardMaterial color={stall.color} roughness={0.72}/></mesh>
    <mesh position={[0,1.74,1.03]}><boxGeometry args={[3.18,0.62,0.14]}/><meshStandardMaterial color="#f2dfb8"/></mesh>
    <mesh position={[0,1.74,1.12]}><planeGeometry args={[2.9,0.46]}/><meshBasicMaterial color="#33251d"/></mesh>
    <Html position={[0,1.74,1.2]} center transform distanceFactor={8}>
    <div className="stall-sign">{stall.food}</div>
    </Html>
    <mesh position={[0,1.03,1.15]} castShadow><boxGeometry args={[3.05,0.2,0.42]}/><meshStandardMaterial color="#a96c42"/></mesh>
    <group position={[0,0.55,0.37]}>
      <mesh position={[0,0.36,0]} castShadow><capsuleGeometry args={[0.27,0.55,4,10]}/><meshStandardMaterial color={stall.color}/></mesh>
      <mesh position={[0,1.03,0]} castShadow><sphereGeometry args={[0.26,18,18]}/><meshStandardMaterial color="#bd805d"/></mesh>
      <mesh position={[0,1.31,0]}><cylinderGeometry args={[0.29,0.31,0.12,16]}/><meshStandardMaterial color="#49352b"/></mesh>
    </group>
    <Html position={[0,2.8,0]} center distanceFactor={10}>
      <div className="vendor-label"><b>{stall.vendor}</b><span>· {stall.food}</span><small>TALK</small></div>
    </Html>
  </group>;
}

function Walker({ target }: {target:THREE.Vector3|null}) {
  const ref = useRef<THREE.Group>(null);
  const [, get] = useKeyboardControls();
  useFrame((_, delta) => {
    if (!ref.current) return;
    const controls = get() as Record<string, boolean>;
    const speed = 4.2 * delta;
    const manual=controls.forward||controls.backward||controls.left||controls.right;
    if (controls.forward) ref.current.position.z -= speed;
    if (controls.backward) ref.current.position.z += speed;
    if (controls.left) ref.current.position.x -= speed;
    if (controls.right) ref.current.position.x += speed;
    if (!manual&&target){
      const dx=target.x-ref.current.position.x,dz=target.z-ref.current.position.z;
      const distance=Math.hypot(dx,dz);
      if(distance>0.22){ref.current.position.x+=dx/distance*speed;ref.current.position.z+=dz/distance*speed;ref.current.rotation.y=Math.atan2(dx,dz)}
    }
    ref.current.position.x = THREE.MathUtils.clamp(ref.current.position.x, -12, 12);
    ref.current.position.z = THREE.MathUtils.clamp(ref.current.position.z, -9, 10);
    if (controls.left || controls.right) ref.current.rotation.y = controls.left ? -0.35 : 0.35;
    else if (controls.forward || controls.backward) ref.current.rotation.y = controls.forward ? 0 : Math.PI;
  });
  return <group ref={ref} position={[0,0,10]}>
    <mesh position={[0,1.12,0]} castShadow><capsuleGeometry args={[0.34,0.72,6,12]}/><meshStandardMaterial color="#3b8292" roughness={0.75}/></mesh>
    <mesh position={[0,1.78,0]} castShadow><sphereGeometry args={[0.28,18,18]}/><meshStandardMaterial color="#c98f6a"/></mesh>
    <mesh position={[0,1.98,0]}><sphereGeometry args={[0.285,18,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#272b31"/></mesh>
    <mesh position={[0,0.49,0.04]}><boxGeometry args={[0.48,0.12,0.31]}/><meshStandardMaterial color="#b9824e"/></mesh>
    <Html position={[0,2.25,0]} center distanceFactor={10}><div className="player-tag">YOU</div></Html>
  </group>;
}

function Plaza({ stalls, onTalk, activeId }: { stalls:Stall[]; onTalk:(id:string)=>void; activeId:string }) {
  const activeIndex=stalls.findIndex(stall=>stall.id===activeId);
  const target=activeIndex<0?null:new THREE.Vector3(-11.25+(activeIndex%6)*4.5,0,-7.5+Math.floor(activeIndex/6)*7+2.6);
  return <>
    <color attach="background" args={['#182232']}/><fog attach="fog" args={['#182232',20,55]}/>
    <ambientLight intensity={1.05}/><hemisphereLight args={['#c5d8ff','#8c6544',1.1]}/>
    <directionalLight position={[8,14,6]} intensity={2.1} castShadow shadow-mapSize={[2048,2048]}/>
    <pointLight position={[0,8,0]} color="#ffb35c" intensity={38} distance={28}/>
    <Stars radius={80} depth={35} count={350} factor={2} fade speed={0.15}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.12,0]} receiveShadow><planeGeometry args={[36,30]}/><meshStandardMaterial color="#70583e" roughness={0.96}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.09,0]}><planeGeometry args={[28,24]}/><meshStandardMaterial color="#c5a77d" roughness={0.9}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.06,0]}><planeGeometry args={[4.5,24]}/><meshStandardMaterial color="#ad906d" roughness={0.95}/></mesh>
    {[-16,16].map(x=><group key={x} position={[x,0,-1]}><mesh position={[0,3,0]} castShadow><boxGeometry args={[4,6,29]}/><meshStandardMaterial color={x<0?'#354857':'#51424a'}/></mesh><mesh position={[0,6.1,0]}><boxGeometry args={[4.15,0.22,29.1]}/><meshStandardMaterial color="#92704c"/></mesh>{[-10,-5,0,5,10].map(z=><mesh key={z} position={[-2.02,3,z]}><boxGeometry args={[0.05,0.65,0.8]}/><meshStandardMaterial color="#ffc56f" emissive="#ff9a3b" emissiveIntensity={0.5}/></mesh>)}</group>)}
    {stalls.map((stall,index)=>{
      const col=index%6; const row=Math.floor(index/6);
      return <StallBooth key={stall.id} stall={stall} position={[-11.25+col*4.5,0,-7.5+row*7]} onTalk={onTalk} selected={stall.id===activeId}/>;
    })}
    <Walker target={target}/>
    <OrbitControls target={[0,1,0]} minDistance={11} maxDistance={25} maxPolarAngle={Math.PI/2.08} enablePan/>
  </>;
}

export default function GameScene({stalls,onTalk,activeId}:{stalls:Stall[];onTalk:(id:string)=>void;activeId:string}) {
  return <div className="scene-wrap city-plaza"><KeyboardControls map={[
    {name:'forward',keys:['ArrowUp','KeyW']},{name:'backward',keys:['ArrowDown','KeyS']},
    {name:'left',keys:['ArrowLeft','KeyA']},{name:'right',keys:['ArrowRight','KeyD']},
  ]}><Canvas shadows camera={{position:[0,13,22],fov:42}}><Plaza stalls={stalls} onTalk={onTalk} activeId={activeId}/></Canvas></KeyboardControls>
    <div className="scene-hint">WASD / ARROWS TO WANDER · CLICK A STALL TO TALK</div>
  </div>;
}
