import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { TerrainData, GameMode, Entity, KeyBindings, VoxelData } from '../types';
import Player from './Player';
import { ENTITY_MODELS } from '../utils/voxelModels';
import { getBiomeColor, hexToRgb, generateMoistureColor } from '../utils/gameUtils';

interface VoxelSceneProps {
  terrain: TerrainData;
  terrainVersion: number;
  plants: VoxelData[];
  entities: Entity[];
  gameMode: GameMode;
  onInteract: (point: THREE.Vector3, isRightClick: boolean) => void;
  onSelect?: (type: 'ENTITY' | 'PLANT' | null, id: string | number | null) => void;
  isLocked: boolean;
  isPaused: boolean;
  onUnlock: () => void;
  followedEntity: Entity | null;
  keyBindings: KeyBindings;
  brushSize: number;
  selectedPlantId: string;
}

// --- Terrain Mesh Component ---
const TerrainMesh: React.FC<{ terrain: TerrainData, version: number, overlayMode: boolean }> = ({ terrain, version, overlayMode }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.PlaneGeometry>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastVersionRef = useRef<number>(-1);
  const lastOverlayRef = useRef<boolean>(false);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    // Force update if overlay mode changes or terrain version changes
    const needsUpdate = lastVersionRef.current !== version || lastOverlayRef.current !== overlayMode;
    
    if (needsUpdate && (now - lastUpdateRef.current > 0.05)) {
      if (geometryRef.current && meshRef.current) {
        const geo = geometryRef.current;
        const { heights, moisture, vegetation, size } = terrain;
        const count = geo.attributes.position.count;
        
        const colors = new Float32Array(count * 3);
        const positions = geo.attributes.position.array as Float32Array;
        
        for (let i = 0; i < count; i++) {
           const ix = i % size;
           const iy = Math.floor(i / size);
           // FIX: Remove inversion. Map iy directly to Z to align with logic coordinates.
           const terrainIdx = iy * size + ix;
           
           if (terrainIdx >= 0 && terrainIdx < heights.length) {
              const h = heights[terrainIdx];
              const m = moisture[terrainIdx];
              const v = vegetation[terrainIdx];
              
              positions[i * 3 + 2] = h; 

              let cHex = '#000000';
              if (overlayMode) {
                  cHex = generateMoistureColor(m);
              } else {
                  cHex = getBiomeColor(h, m, v);
              }
              
              const cRgb = hexToRgb(cHex);
              colors[i * 3] = cRgb.r;
              colors[i * 3 + 1] = cRgb.g;
              colors[i * 3 + 2] = cRgb.b;
           }
        }

        geo.attributes.position.needsUpdate = true;
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        
        lastUpdateRef.current = now;
        lastVersionRef.current = version;
        lastOverlayRef.current = overlayMode;
      }
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      rotation={[-Math.PI / 2, 0, 0]} 
      receiveShadow 
      castShadow
      userData={{ isTerrain: true }}
      name="terrain-mesh"
    >
      <planeGeometry ref={geometryRef} args={[terrain.size, terrain.size, terrain.size - 1, terrain.size - 1]} />
      <meshStandardMaterial vertexColors flatShading roughness={0.8} metalness={0.1} />
    </mesh>
  );
};

// --- Plants Rendering ---
const PlantRenderer: React.FC<{ plants: VoxelData[] }> = ({ plants }) => {
   return (
     <group>
       {plants.map((p, i) => (
         <mesh 
            key={i} 
            position={[p.x, p.y, p.z]} 
            castShadow 
            receiveShadow
            userData={{ type: 'PLANT', index: i }} // Used for raycasting
         >
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color={p.color} />
         </mesh>
       ))}
     </group>
   );
};

const EntityRenderer: React.FC<{ entity: Entity }> = ({ entity }) => {
  const model = ENTITY_MODELS[entity.type];
  const groupRef = useRef<THREE.Group>(null);
  const offset = useMemo(() => Math.random() * 100, []);

  useFrame((state) => {
    if (groupRef.current) {
       groupRef.current.position.lerp(new THREE.Vector3(entity.x, entity.y, entity.z), 0.2);
       const bob = Math.sin(state.clock.elapsedTime * 5 + offset) * 0.05;
       groupRef.current.position.y += bob;
       
       if (entity.rotation !== undefined) {
         let r = entity.rotation;
         const cur = groupRef.current.rotation.y;
         while(r - cur > Math.PI) r -= Math.PI*2;
         while(r - cur < -Math.PI) r += Math.PI*2;
         groupRef.current.rotation.y = THREE.MathUtils.lerp(cur, r, 0.1);
       }
    }
  });

  if (!model) return null;

  return (
    <group 
      ref={groupRef} 
      position={[entity.x, entity.y, entity.z]}
      userData={{ type: 'ENTITY', id: entity.id }} // Used for raycasting
    >
      {model.map((v, i) => (
        <mesh key={i} position={[v.x * 0.4, v.y * 0.4, v.z * 0.4]} castShadow>
           <boxGeometry args={[0.4, 0.4, 0.4]} />
           <meshStandardMaterial color={v.color} />
        </mesh>
      ))}
    </group>
  );
};

const VoxelScene: React.FC<VoxelSceneProps> = ({ 
  terrain, terrainVersion, plants, entities, gameMode, onInteract, onSelect, isLocked, isPaused, onUnlock, followedEntity, keyBindings, brushSize, selectedPlantId
}) => {
  const highlightRef = useRef<THREE.Mesh>(null);
  const isRainMode = gameMode === 'RAIN_ADD' || gameMode === 'RAIN_SUB';

  return (
    <div className="w-full h-full bg-black cursor-crosshair">
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 50, near: 0.1, far: 1000 }}>
        <Player 
          gameMode={gameMode} 
          onInteract={onInteract}
          onSelect={onSelect || (() => {})} 
          highlightRef={highlightRef}
          isPaused={isPaused}
          onUnlock={onUnlock}
          followedEntity={followedEntity}
          keyBindings={keyBindings}
          brushSize={brushSize}
          terrain={terrain}
          selectedPlantId={selectedPlantId}
          entities={entities}
          plants={plants}
        />
        
        <ambientLight intensity={0.6} />
        <directionalLight 
          position={[50, 100, 50]} 
          intensity={1.5} 
          castShadow 
          shadow-mapSize={[2048, 2048]} 
          shadow-camera-left={-64}
          shadow-camera-right={64}
          shadow-camera-top={64}
          shadow-camera-bottom={-64}
        />
        <Sky sunPosition={[100, 40, 100]} turbidity={8} rayleigh={6} />
        <fog attach="fog" args={['#e0f2fe', 20, 100]} />

        <group name="world-content">
           <TerrainMesh terrain={terrain} version={terrainVersion} overlayMode={isRainMode} />
           <PlantRenderer plants={plants} />
           {entities.map(e => <EntityRenderer key={e.id} entity={e} />)}
        </group>

        {/* Cursor Highlight */}
        <mesh ref={highlightRef} visible={false} rotation={[-Math.PI/2, 0, 0]}>
           <ringGeometry args={[0.5, 1, 32]} />
           <meshBasicMaterial color={isRainMode ? "#3b82f6" : "white"} opacity={0.5} transparent />
        </mesh>
      </Canvas>
    </div>
  );
};

export default VoxelScene;