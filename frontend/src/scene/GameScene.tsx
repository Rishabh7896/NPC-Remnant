import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, Float, Html, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

function Panel({position, color, label, onClick}: {position:[number,number,number];color:string;label:string;onClick:()=>void}) {
  return <group position={position} onClick={onClick}>
    <mesh><boxGeometry args={[0.9,0.75,0.12]}/><meshStandardMaterial color="#222b33" metalness={0.6} roughness={0.35}/></mesh>
    <mesh position={[0,0,0.07]}><planeGeometry args={[0.68,0.48]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6}/></mesh>
    <Html position={[0,-0.58,0]} center distanceFactor={8}><div className="world-label">{label}</div></Html>
  </group>
}
function Aria() {
  return <group position={[0,0,-1.5]}>
    <Float speed={1.4} rotationIntensity={0.05} floatIntensity={0.12}>
      <mesh position={[0,1.55,0]} castShadow><sphereGeometry args={[0.38,32,32]}/><meshStandardMaterial color="#c7d6df" metalness={0.75} roughness={0.28}/></mesh>
      <mesh position={[0,1.57,0.33]}><boxGeometry args={[0.42,0.1,0.08]}/><meshStandardMaterial color="#55e6e0" emissive="#35c9d1" emissiveIntensity={2}/></mesh>
      <mesh position={[0,0.8,0]} castShadow><capsuleGeometry args={[0.35,0.72,6,12]}/><meshStandardMaterial color="#718895" metalness={0.55} roughness={0.38}/></mesh>
      <mesh position={[-0.48,0.8,0]} rotation={[0,0,-0.18]}><capsuleGeometry args={[0.11,0.62,4,8]}/><meshStandardMaterial color="#9aadb7"/></mesh>
      <mesh position={[0.48,0.8,0]} rotation={[0,0,0.18]}><capsuleGeometry args={[0.11,0.62,4,8]}/><meshStandardMaterial color="#9aadb7"/></mesh>
      <mesh position={[-0.2,0.08,0]}><capsuleGeometry args={[0.13,0.55,4,8]}/><meshStandardMaterial color="#586c78"/></mesh>
      <mesh position={[0.2,0.08,0]}><capsuleGeometry args={[0.13,0.55,4,8]}/><meshStandardMaterial color="#586c78"/></mesh>
    </Float>
    <Html position={[0,2.25,0]} center><div className="aria-tag"><span className="pulse-dot"/> ARIA · CREW COMPANION</div></Html>
  </group>
}
export default function GameScene({onInteract}:{onInteract:(id:string)=>void}) {
  const [hover,setHover] = useState('');
  return <div className="scene-wrap"><Canvas shadows camera={{position:[5,4.5,8],fov:45}} onCreated={({scene})=>{scene.background=new THREE.Color('#0a1019')}}>
    <ambientLight intensity={0.8}/><directionalLight position={[4,8,5]} intensity={2.1} castShadow/><pointLight position={[-4,2,-2]} color="#e87842" intensity={20}/>
    <Stars radius={80} depth={30} count={800} factor={3} fade speed={0.2}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.38,0]} receiveShadow><planeGeometry args={[15,15]}/><meshStandardMaterial color="#332d2a" roughness={0.95}/></mesh>
    <mesh position={[0,1.45,-3.2]}><boxGeometry args={[8,3.7,0.22]}/><meshStandardMaterial color="#37424c" metalness={0.3}/></mesh>
    <mesh position={[0,1.55,-3.06]}><planeGeometry args={[4.2,2.2]}/><meshBasicMaterial color="#a8442c"/></mesh>
    <mesh position={[0,1.55,-3.04]}><planeGeometry args={[3.7,1.8]}/><meshBasicMaterial color="#d96a3a"/></mesh>
    {Array.from({length:9},(_,i)=><mesh key={i} position={[-1.7+i*0.42,0.65,-3.0]}><sphereGeometry args={[0.06+(i%3)*0.025,8,8]}/><meshBasicMaterial color="#512d2b"/></mesh>)}
    <mesh position={[-4,1.35,0]}><boxGeometry args={[0.22,3.2,7]}/><meshStandardMaterial color="#3b4852"/></mesh>
    <mesh position={[4,1.35,0]}><boxGeometry args={[0.22,3.2,7]}/><meshStandardMaterial color="#3b4852"/></mesh>
    <mesh position={[0,3.1,0]}><boxGeometry args={[8,0.2,7]}/><meshStandardMaterial color="#2a353e"/></mesh>
    <mesh position={[0,0.03,0]}><cylinderGeometry args={[0.8,0.8,0.08,32]}/><meshStandardMaterial color="#6d7b84" metalness={0.7}/></mesh>
    <Aria/>
    <Panel position={[-2.4,1.4,0.2]} color="#d54b43" label="SENSOR CONSOLE" onClick={()=>onInteract('sensor_engineering_01')}/>
    <Panel position={[2.3,1.3,-0.2]} color="#e8a64b" label="REPAIR PANEL" onClick={()=>onInteract('repair_sensor_panel')}/>
    <Panel position={[0,1.15,1.9]} color="#54d5c6" label="ENGINEERING DOOR" onClick={()=>onInteract('enter_engineering_wing')}/>
    <ContactShadows position={[0,-0.34,0]} opacity={0.45} scale={12} blur={2.5}/>
    <OrbitControls makeDefault target={[0,1,0]} minDistance={5} maxDistance={12} maxPolarAngle={Math.PI/2.05}/>
  </Canvas><div className="scene-hint">DRAG TO LOOK · CLICK A CONSOLE TO INTERACT</div></div>
}
