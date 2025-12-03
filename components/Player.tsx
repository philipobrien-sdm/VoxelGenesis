import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GameMode, Entity, KeyBindings, TerrainData, VoxelData } from '../types';
import { getTerrainHeight, checkPlantSuitability, MAP_SIZE } from '../utils/gameUtils';
import { ENTITY_MODELS } from '../utils/voxelModels';

interface PlayerProps {
  gameMode: GameMode;
  onInteract: (point: THREE.Vector3, isRightClick: boolean) => void;
  onSelect: (type: 'ENTITY' | 'PLANT' | null, id: string | number | null) => void;
  highlightRef: React.MutableRefObject<THREE.Mesh | null>;
  isPaused: boolean;
  onUnlock: () => void;
  followedEntity: Entity | null;
  keyBindings: KeyBindings;
  brushSize: number;
  terrain: TerrainData;
  selectedPlantId: string;
  entities: Entity[];
  plants: VoxelData[];
}

const Player: React.FC<PlayerProps> = ({ 
  gameMode, 
  onInteract, 
  onSelect,
  highlightRef,
  isPaused,
  onUnlock,
  followedEntity,
  keyBindings,
  brushSize,
  terrain,
  selectedPlantId,
  entities,
  plants
}) => {
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  
  // Camera Control
  const [rotationIndex, setRotationIndex] = useState(0); 
  const [targetPos, setTargetPos] = useState(new THREE.Vector3(0, 0, 0)); 
  const [zoom, setZoom] = useState(30);
  const [pitch, setPitch] = useState(Math.PI / 4);
  
  const [moveState, setMoveState] = useState({
    forward: false, backward: false, left: false, right: false, ascend: false, descend: false
  });
  const [userInteracted, setUserInteracted] = useState(false);

  // Interaction State
  const isInteracting = useRef(false);
  const isDragging = useRef(false);
  const lastInteractTime = useRef(0);
  const intersectPoint = useRef<THREE.Vector3 | null>(null);
  
  // Dragging State for Pan
  const dragStart = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    if (followedEntity) setUserInteracted(false);
  }, [followedEntity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMoveKey = [keyBindings.FORWARD, keyBindings.BACKWARD, keyBindings.LEFT, keyBindings.RIGHT, keyBindings.ROTATE, keyBindings.ASCEND, keyBindings.DESCEND].includes(event.code);
      if (followedEntity && isMoveKey) setUserInteracted(true);
      if (isPaused) return;

      if (event.code === keyBindings.DESCEND || event.key === 'Alt') event.preventDefault();

      switch (event.code) {
        case keyBindings.FORWARD: setMoveState(s => ({ ...s, forward: true })); break;
        case keyBindings.BACKWARD: setMoveState(s => ({ ...s, backward: true })); break;
        case keyBindings.LEFT: setMoveState(s => ({ ...s, left: true })); break;
        case keyBindings.RIGHT: setMoveState(s => ({ ...s, right: true })); break;
        case keyBindings.ROTATE: setRotationIndex(prev => (prev + 1) % 4); break;
        case keyBindings.ASCEND: setMoveState(s => ({ ...s, ascend: true })); break;
        case keyBindings.DESCEND: setMoveState(s => ({ ...s, descend: true })); break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (isPaused) return;
      switch (event.code) {
        case keyBindings.FORWARD: setMoveState(s => ({ ...s, forward: false })); break;
        case keyBindings.BACKWARD: setMoveState(s => ({ ...s, backward: false })); break;
        case keyBindings.LEFT: setMoveState(s => ({ ...s, left: false })); break;
        case keyBindings.RIGHT: setMoveState(s => ({ ...s, right: false })); break;
        case keyBindings.ASCEND: setMoveState(s => ({ ...s, ascend: false })); break;
        case keyBindings.DESCEND: setMoveState(s => ({ ...s, descend: false })); break;
      }
    };

    const attemptInteraction = (isClick: boolean, button: number) => {
       // If dragging in VIEW mode, don't interact with world
       if (isDragging.current && gameMode === 'VIEW') return;

       // 1. Check Entities/Plants first (Selection) - Only on Click
       if (isClick && button === 0) { 
          const worldContent = scene.getObjectByName('world-content');
          if (worldContent) {
              const hits = raycaster.current.intersectObjects(worldContent.children, true);
              for (const hit of hits) {
                  let obj: THREE.Object3D | null = hit.object;
                  while (obj && obj !== worldContent) {
                      if (obj.userData?.type === 'ENTITY') {
                          onSelect('ENTITY', obj.userData.id);
                          return; 
                      }
                      if (obj.userData?.type === 'PLANT') {
                          onSelect('PLANT', obj.userData.index);
                          return;
                      }
                      obj = obj.parent;
                  }
              }
          }
      }

      // 2. Interact with Terrain
      if (intersectPoint.current) {
          if (button === 0) {
             if (isClick && gameMode !== 'VIEW') onSelect(null, null); // Deselect on terrain click unless just panning
             if (gameMode !== 'VIEW') onInteract(intersectPoint.current, false);
          } else if (button === 2) {
             onInteract(intersectPoint.current, true);
          }
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      if (isPaused) return;
      if (event.target !== gl.domElement) return;
      
      isInteracting.current = true;
      isDragging.current = false;
      dragStart.current = { x: event.clientX, y: event.clientY };

      attemptInteraction(true, event.button);
      lastInteractTime.current = Date.now();
    };

    const onMouseMove = (event: MouseEvent) => {
      if (isPaused) return;
      
      // Dragging Logic for VIEW mode
      if (isInteracting.current && gameMode === 'VIEW' && dragStart.current) {
         const dx = event.clientX - dragStart.current.x;
         const dy = event.clientY - dragStart.current.y;
         
         if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging.current = true;
         
         if (isDragging.current) {
             // Calculate movement relative to camera rotation
             const currentYRotation = rotationIndex * (Math.PI / 2);
             const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYRotation);
             const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYRotation);
             
             // Scale factor based on zoom
             const scale = zoom * 0.002;
             
             setTargetPos(prev => {
                 const next = prev.clone();
                 next.addScaledVector(right, -dx * scale);
                 next.addScaledVector(forward, dy * scale); // Drag down moves camera backward (pulling map)
                 return next;
             });
             
             dragStart.current = { x: event.clientX, y: event.clientY };
         }
      }

      if (!isInteracting.current) return;
      if (gameMode === 'VIEW') return; // No tool interaction while moving in view mode

      const now = Date.now();
      if (now - lastInteractTime.current < 50) return; // Throttled

      attemptInteraction(false, event.button); 
      lastInteractTime.current = now;
    };

    const onMouseUp = () => {
      isInteracting.current = false;
      isDragging.current = false;
      dragStart.current = null;
    };

    const onWheel = (e: WheelEvent) => {
       if (isPaused) return;
       e.preventDefault();

       if (e.ctrlKey) {
          setPitch(p => THREE.MathUtils.clamp(p + e.deltaY * 0.002, 0.2, 1.4));
       } else {
          setZoom(z => THREE.MathUtils.clamp(z + e.deltaY * 0.05, 5, 80));
       }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove); 
    window.addEventListener('mouseup', onMouseUp);
    gl.domElement.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      gl.domElement.removeEventListener('wheel', onWheel);
    };
  }, [isPaused, camera, scene, onInteract, onSelect, followedEntity, keyBindings, gl, gameMode, rotationIndex, zoom]);

  useFrame((state, delta) => {
    // --- RAYCASTING UPDATE ---
    raycaster.current.setFromCamera(state.pointer, camera);
    
    // Check Terrain Intersection for Highlight & Click
    const terrainMesh = scene.getObjectByName('terrain-mesh');
    if (terrainMesh && highlightRef.current) {
       const hits = raycaster.current.intersectObject(terrainMesh);
       if (hits.length > 0) {
          const point = hits[0].point;
          intersectPoint.current = point;
          
          // Only show highlight cursor if NOT in VIEW mode (unless viewing info)
          if (gameMode !== 'VIEW') {
              highlightRef.current.visible = true;
              highlightRef.current.position.copy(point);
              const s = brushSize;
              highlightRef.current.scale.set(s, s, 1);
          } else {
              highlightRef.current.visible = false;
          }
       } else {
          highlightRef.current.visible = false;
          intersectPoint.current = null;
       }
    }

    // --- CAMERA MOVEMENT ---
    if (followedEntity && !userInteracted) {
       const groundH = getTerrainHeight(terrain, followedEntity.x, followedEntity.z);
       const camPos = new THREE.Vector3(followedEntity.x, groundH + 10, followedEntity.z + 10);
       camera.position.lerp(camPos, 0.05);
       camera.lookAt(followedEntity.x, followedEntity.y, followedEntity.z);
       return;
    }

    // RTS Controls (Keyboard)
    const moveSpeed = 40.0 * delta;
    const currentYRotation = rotationIndex * (Math.PI / 2);
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYRotation);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), currentYRotation);

    if (moveState.forward) targetPos.addScaledVector(forward, moveSpeed);
    if (moveState.backward) targetPos.addScaledVector(forward, -moveSpeed);
    if (moveState.right) targetPos.addScaledVector(right, moveSpeed);
    if (moveState.left) targetPos.addScaledVector(right, -moveSpeed);
    
    const limit = terrain.size / 2 - 2;
    targetPos.x = THREE.MathUtils.clamp(targetPos.x, -limit, limit);
    targetPos.z = THREE.MathUtils.clamp(targetPos.z, -limit, limit);
    
    if (moveState.ascend) setZoom(z => Math.min(z + 20 * delta, 80));
    if (moveState.descend) setZoom(z => Math.max(z - 20 * delta, 5));

    const groundH = getTerrainHeight(terrain, targetPos.x, targetPos.z);
    targetPos.y = THREE.MathUtils.lerp(targetPos.y, groundH, 0.1);
    
    const yOffset = Math.sin(pitch) * zoom;
    const zOffset = Math.cos(pitch) * zoom;

    const offset = new THREE.Vector3(0, yOffset, zOffset).applyAxisAngle(new THREE.Vector3(0,1,0), currentYRotation);
    const desiredPos = targetPos.clone().add(offset);
    
    const camGroundH = getTerrainHeight(terrain, desiredPos.x, desiredPos.z);
    if (desiredPos.y < camGroundH + 2) {
       desiredPos.y = camGroundH + 2;
    }

    camera.position.lerp(desiredPos, 0.1);
    camera.lookAt(targetPos);
  });

  return null;
};

export default Player;