import React, { useState, useCallback, useEffect, useRef } from 'react';
import VoxelScene from './components/VoxelScene';
import GameUI from './components/GameUI';
import { VoxelData, GameMode, Entity, NotificationItem, EventLogItem, KeyBindings, TerrainData, WeatherState } from './types';
import { generateTerrainData, AVAILABLE_PLANTS, EVOLUTION_TREE, checkEvolutionCondition, MAP_SIZE, getTerrainHeight, SEA_LEVEL, calculateWeather } from './utils/gameUtils';
import { ENTITY_MODELS } from './utils/voxelModels';
import * as THREE from 'three';

const DEFAULT_BINDINGS: KeyBindings = {
  FORWARD: 'KeyW',
  BACKWARD: 'KeyS',
  LEFT: 'KeyA',
  RIGHT: 'KeyD',
  ROTATE: 'End',
  PAUSE: 'Escape',
  ASCEND: 'Space',
  DESCEND: 'AltLeft'
};

interface GeologicEvent {
  x: number;
  z: number;
  radius: number;
  strength: number; 
  life: number; 
}

const ENTITY_STATS: Record<Entity['type'], Partial<Entity>> = {
  FISH: { maxEnergy: 100, diet: 'HERBIVORE', color: '#f97316' }, 
  AMPHIBIAN: { maxEnergy: 120, diet: 'OMNIVORE', color: '#65a30d' },
  REPTILE: { maxEnergy: 150, diet: 'CARNIVORE', color: '#15803d' },
  BIRD: { maxEnergy: 80, diet: 'OMNIVORE', color: '#e11d48' },
  MAMMAL: { maxEnergy: 200, diet: 'HERBIVORE', color: '#78350f' },
  PRIMATE: { maxEnergy: 180, diet: 'OMNIVORE', color: '#d97706' },
};

const App: React.FC = () => {
  // --- State ---
  const [terrain, setTerrain] = useState<TerrainData>(() => generateTerrainData(MAP_SIZE));
  const [terrainVersion, setTerrainVersion] = useState(0); 
  const [plants, setPlants] = useState<VoxelData[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [unlockedEvolutions, setUnlockedEvolutions] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
  const [followedEntityId, setFollowedEntityId] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>('VIEW');
  const [brushSize, setBrushSize] = useState(3);
  const [selectedPlantId, setSelectedPlantId] = useState<string>('shrub');
  const [isPaused, setIsPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1.0);
  const [keyBindings, setKeyBindings] = useState<KeyBindings>(DEFAULT_BINDINGS);
  
  // New Ecosystem State
  const [globalTick, setGlobalTick] = useState(0);
  const [weather, setWeather] = useState<WeatherState>(calculateWeather(0));

  // Selection State
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedPlantIndex, setSelectedPlantIndex] = useState<number | null>(null);

  const terrainRef = useRef(terrain);
  const plantsRef = useRef(plants);
  const entitiesRef = useRef(entities);
  const unlockedRef = useRef(unlockedEvolutions);
  const timeScaleRef = useRef(timeScale);
  const geologicEvents = useRef<GeologicEvent[]>([]);

  useEffect(() => { terrainRef.current = terrain; }, [terrain]);
  useEffect(() => { plantsRef.current = plants; }, [plants]);
  useEffect(() => { entitiesRef.current = entities; }, [entities]);
  useEffect(() => { unlockedRef.current = unlockedEvolutions; }, [unlockedEvolutions]);
  useEffect(() => { timeScaleRef.current = timeScale; }, [timeScale]);

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalKeys = (e: KeyboardEvent) => {
        if (e.key === '=' || e.key === '+') setBrushSize(s => Math.min(s + 1, 15));
        if (e.key === '-' || e.key === '_') setBrushSize(s => Math.max(s - 1, 1));
        if (e.code === 'PageUp') setTimeScale(t => Math.min(t + 0.5, 10));
        if (e.code === 'PageDown') setTimeScale(t => Math.max(t - 0.5, 0));
    };
    window.addEventListener('keydown', handleGlobalKeys);
    return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, []);

  const handleToggleGameMode = (mode: GameMode) => {
    setGameMode(current => current === mode ? 'VIEW' : mode);
  };

  const addNotification = useCallback((title: string, message: string, icon: string) => {
    const id = Math.random().toString(36);
    setNotifications(prev => [...prev, { id, title, message, icon, timestamp: Date.now() }]);
    setEventLog(prev => [...prev, { id, title, description: message, timestamp: new Date() }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 9000);
  }, []);

  // --- Interaction Handler ---
  const handleSelect = useCallback((type: 'ENTITY' | 'PLANT' | null, id: string | number | null) => {
      if (type === 'ENTITY') {
          setSelectedEntityId(id as string);
          setFollowedEntityId(id as string);
          setSelectedPlantIndex(null);
      } else if (type === 'PLANT') {
          setSelectedPlantIndex(id as number);
          setSelectedEntityId(null);
          setFollowedEntityId(null);
      } else {
          setSelectedEntityId(null);
          setSelectedPlantIndex(null);
          setFollowedEntityId(null);
      }
  }, []);

  const handleInteract = useCallback((point: THREE.Vector3, isRightClick: boolean) => {
    const half = MAP_SIZE / 2;
    const cx = Math.round(point.x + half);
    const cz = Math.round(point.z + half);
    
    if (cx < 0 || cx >= MAP_SIZE || cz < 0 || cz >= MAP_SIZE) return;

    const tData = terrainRef.current;
    const { heights, moisture, vegetation } = tData;
    let modified = false;

    const brushRad = Math.floor(brushSize / 2);

    for (let dx = -brushRad; dx <= brushRad; dx++) {
      for (let dz = -brushRad; dz <= brushRad; dz++) {
         const x = cx + dx;
         const z = cz + dz;
         if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) continue;
         
         const idx = z * MAP_SIZE + x;
         const dist = Math.sqrt(dx*dx + dz*dz);
         if (dist > brushRad) continue;
         
         const falloff = 1 - (dist / (brushRad + 1)); 

         switch (gameMode) {
            case 'RISE':
               heights[idx] += 0.5 * falloff;
               modified = true;
               break;
            case 'LOWER':
               heights[idx] -= 0.5 * falloff;
               modified = true;
               break;
            case 'RAIN_ADD':
               moisture[idx] = Math.min(1.0, moisture[idx] + 0.1 * falloff);
               modified = true;
               break;
            case 'RAIN_SUB':
               moisture[idx] = Math.max(0.0, moisture[idx] - 0.1 * falloff);
               modified = true;
               break;
         }
      }
    }

    if (modified) setTerrainVersion(v => v + 1);

  }, [gameMode, brushSize]);

  // --- Physics Loop ---
  useEffect(() => {
    const physicsInterval = setInterval(() => {
      if (isPaused) return;
      const dt = timeScaleRef.current;
      if (dt <= 0) return;
      
      const tData = terrainRef.current;
      let terrainModified = false;
      
      // Update Weather Tick
      setGlobalTick(prev => {
        const next = prev + 1;
        if (next % 30 === 0) { // Update weather every second (30 physics ticks)
           setWeather(calculateWeather(next));
        }
        return next;
      });

      // 1. Tectonics 
      if (Math.random() < 0.002 * dt) { 
         geologicEvents.current.push({
            x: Math.floor(Math.random() * MAP_SIZE),
            z: Math.floor(Math.random() * MAP_SIZE),
            radius: 5 + Math.random() * 15,
            strength: (Math.random() - 0.5) * 0.05, 
            life: 200 + Math.random() * 300 
         });
      }

      // Event Processing
      if (geologicEvents.current.length > 0) {
         const activeEvents: GeologicEvent[] = [];
         geologicEvents.current.forEach(evt => {
            evt.life -= dt;
            if (evt.life > 0) {
               const { heights } = tData;
               const range = Math.ceil(evt.radius);
               for (let dz = -range; dz <= range; dz++) {
                  for (let dx = -range; dx <= range; dx++) {
                     const cx = evt.x + dx;
                     const cz = evt.z + dz;
                     if (cx >= 0 && cx < MAP_SIZE && cz >= 0 && cz < MAP_SIZE) {
                        const dist = Math.sqrt(dx*dx + dz*dz);
                        if (dist <= evt.radius) {
                           const influence = (1 - dist/evt.radius) * evt.strength * dt;
                           const idx = cz * MAP_SIZE + cx;
                           heights[idx] += influence;
                           terrainModified = true;
                        }
                     }
                  }
               }
               activeEvents.push(evt);
            }
         });
         geologicEvents.current = activeEvents;
      }

      // 2. Weather-Driven Vegetation Growth
      // We perform updates in batches to keep performance up, randomly sampling grid
      for (let i = 0; i < 400; i++) { // Increased sample rate
         const rx = Math.floor(Math.random() * MAP_SIZE);
         const rz = Math.floor(Math.random() * MAP_SIZE);
         const idx = rz * MAP_SIZE + rx;
         
         const h = tData.heights[idx];
         const m = tData.moisture[idx];
         let v = tData.vegetation[idx];
         
         if (h > SEA_LEVEL) { 
             // Growth modifiers from weather
             const effectiveMoisture = (m + weather.rainfall) / 2;
             const effectiveTemp = weather.temperature;

             let growthRate = 0;
             if (effectiveTemp < 0.3) {
                 // Winter/Cold: Decay
                 growthRate = -0.01;
             } else if (effectiveMoisture < 0.2) {
                 // Drought: Fast Decay
                 growthRate = -0.05;
             } else {
                 // Growing season
                 const tempFactor = 1 - Math.abs(0.7 - effectiveTemp); // 0 to 1 peak
                 growthRate = 0.05 * tempFactor * effectiveMoisture;
             }
             
             // Spontaneous Generation (Nature's rebound)
             if (v < 0.1 && effectiveMoisture > 0.4 && effectiveTemp > 0.4 && Math.random() < 0.05 * dt) {
                 v = 0.1;
             } else {
                 v = Math.max(0, Math.min(1, v + growthRate * dt));
             }
         } else if (h < SEA_LEVEL - 1.0) {
             // Marine Algae Growth (Simple Logic)
             // Grows well in shallow water
             if (v < 0.5 && Math.random() < 0.05 * dt) {
                 v += 0.02 * dt;
             }
             // Cap marine veg
             v = Math.min(0.5, v);
         } else {
             v = 0; // Transition zone clear
         }
         
         if (v !== tData.vegetation[idx]) {
            tData.vegetation[idx] = v;
            terrainModified = true;
         }
      }
      if (terrainModified) setTerrainVersion(v => v + 1);

      // 3. Spontaneous Marine Plant (Kelp) Generation
      for(let i=0; i<3; i++) {
          const rx = Math.floor(Math.random() * MAP_SIZE);
          const rz = Math.floor(Math.random() * MAP_SIZE);
          const idx = rz * MAP_SIZE + rx;
          const h = tData.heights[idx];
          
          if (h < SEA_LEVEL - 2.0 && h > SEA_LEVEL - 8.0) {
               // Check crowding
              const wx = rx - MAP_SIZE/2;
              const wz = rz - MAP_SIZE/2;
              const nearby = plantsRef.current.filter(p => Math.abs(p.x - wx) < 3 && Math.abs(p.z - wz) < 3).length;
              
              if (nearby === 0 && Math.random() < 0.01 * dt) {
                  const kelpDef = AVAILABLE_PLANTS.find(p => p.id === 'kelp');
                  if (kelpDef) {
                       setPlants(prev => [
                          ...prev,
                          ...kelpDef.structure.map(s => ({
                              x: s.x + wx,
                              y: s.y + h + 1, 
                              z: s.z + wz,
                              color: s.color,
                              type: 'PLANT' as const
                          }))
                      ]);
                  }
              }
          }
      }

      // 4. Entity Physics & AI
      setEntities(prevEntities => prevEntities.map(entity => {
         let { x, y, z, vx = 0, vy = 0, vz = 0, targetX, targetY, targetZ } = entity;
         
         // Metabolic Cost (Weather Impact)
         // Cold weather increases energy burn
         let metabolicCost = 0;
         if (weather.temperature < 0.3) metabolicCost = 0.05 * dt; // Shivering
         // Movement burns energy
         const speed = Math.sqrt(vx*vx + vz*vz);
         metabolicCost += speed * 0.1 * dt;
         entity.energy -= metabolicCost;

         // --- TERRITORIAL LOGIC ---
         const needNewTarget = targetX === undefined || (Math.abs(x - targetX) < 1 && Math.abs(z - targetZ) < 1);
         
         if (needNewTarget) {
            let validAttempt = false;
            let attempts = 0;
            const roamingRadius = entity.type === 'AMPHIBIAN' ? 5 : 8; 
            
            if (entity.isMigrating) {
                targetX = entity.homeX;
                targetZ = entity.homeZ;
                validAttempt = true;
                if (Math.abs(x - entity.homeX) < 5 && Math.abs(z - entity.homeZ) < 5) {
                    entity.isMigrating = false;
                    // Reset home to current location when migration complete
                    entity.homeX = x;
                    entity.homeZ = z;
                }
            } else {
                while (!validAttempt && attempts < 5) {
                    const angle = Math.random() * Math.PI * 2;
                    const r = Math.random() * roamingRadius;
                    const tx = entity.homeX + Math.cos(angle) * r;
                    const tz = entity.homeZ + Math.sin(angle) * r;
                    
                    const th = getTerrainHeight(tData, tx, tz);
                    
                    if (th === -10) { attempts++; continue; }

                    if (entity.type === 'FISH') {
                        if (th < SEA_LEVEL - 1.0) validAttempt = true;
                    } else if (entity.type === 'BIRD') {
                        validAttempt = true; 
                    } else if (entity.type === 'AMPHIBIAN') {
                        if (th > SEA_LEVEL - 2 && th < SEA_LEVEL + 2) validAttempt = true;
                    } else {
                        if (th > SEA_LEVEL) validAttempt = true;
                    }

                    if (validAttempt) {
                        targetX = tx;
                        targetZ = tz;
                    }
                    attempts++;
                }
            }
            if (!validAttempt) { targetX = x; targetZ = z; } 
         }

         const dx = targetX! - x;
         const dz = targetZ! - z;
         const dist = Math.sqrt(dx*dx + dz*dz);
         
         let speedFactor = 0.01; 
         if (entity.type === 'BIRD') speedFactor = 0.06; 
         if (entity.type === 'FISH') speedFactor = 0.03;

         if (dist > 0.1) {
            vx += (dx / dist) * speedFactor * dt; 
            vz += (dz / dist) * speedFactor * dt;
         }

         vx *= 0.9;
         vz *= 0.9;
         
         let nextX = x + vx * dt;
         let nextZ = z + vz * dt;
         const nextH = getTerrainHeight(tData, nextX, nextZ);

         let canMove = true;
         if (entity.type === 'FISH') {
             if (nextH > SEA_LEVEL - 0.5) canMove = false;
         } 
         else if (entity.type === 'AMPHIBIAN') {
             if (nextH < SEA_LEVEL - 2 || nextH > SEA_LEVEL + 2) canMove = false;
         }
         else if (entity.type !== 'BIRD') {
             if (nextH < SEA_LEVEL) canMove = false;
         }

         if (canMove) {
             x = nextX;
             z = nextZ;
         } else {
             vx *= -1;
             vz *= -1;
             targetX = x;
             targetZ = z;
         }

         const limit = (MAP_SIZE / 2) - 1;
         if (x < -limit || x > limit) { vx *= -1; x = Math.max(-limit, Math.min(x, limit)); }
         if (z < -limit || z > limit) { vz *= -1; z = Math.max(-limit, Math.min(z, limit)); }

         const groundH = getTerrainHeight(tData, x, z);

         if (entity.type === 'FISH') {
            const ceiling = SEA_LEVEL - 0.2;
            const floor = groundH + 0.2;
            if (ceiling > floor) {
               const depth = (ceiling - floor);
               const mid = floor + depth * 0.5;
               const bob = Math.sin(Date.now() / 800 + parseInt(entity.id)) * (depth * 0.3);
               y = THREE.MathUtils.lerp(y, mid + bob, 0.1);
            } else {
               y = floor;
            }
         } else if (entity.type === 'BIRD') {
            if (groundH > 6.0 && Math.random() < 0.005) {
                y = THREE.MathUtils.lerp(y, groundH, 0.05);
            } else {
                const cruiseAlt = Math.max(groundH + 5, 12);
                y = THREE.MathUtils.lerp(y, cruiseAlt, 0.05);
            }
         } else {
            y = groundH;
         }

         const rotation = Math.atan2(vx, vz);
         
         return { ...entity, x, y, z, vx, vy, vz, targetX, targetY, targetZ, rotation };
      }));

    }, 33); 
    return () => clearInterval(physicsInterval);
  }, [isPaused, weather]); 

  // --- Life Simulation Loop ---
  useEffect(() => {
    const lifeInterval = setInterval(() => {
       if (isPaused) return;
       const dt = timeScaleRef.current;
       if (dt <= 0) return;

       const tData = terrainRef.current;
       const currentUnlocked = unlockedRef.current;
       
       // ABIOGENESIS (Life from non-life) / Spawning
       // Spawns PACKS of animals
       const population = entitiesRef.current.length;
       const spawnChance = population < 20 ? 0.5 : 0.05; // Rebound

       if (population < 200 && Math.random() < spawnChance * dt) {
             const rx = (Math.random() - 0.5) * (MAP_SIZE - 4);
             const rz = (Math.random() - 0.5) * (MAP_SIZE - 4);
             const rh = getTerrainHeight(tData, rx, rz);
             let typeToSpawn: Entity['type'] | null = null;

             if (currentUnlocked.includes('life_fish') && rh < SEA_LEVEL - 2) typeToSpawn = 'FISH';
             else if (currentUnlocked.includes('life_mammal') && rh > SEA_LEVEL + 1) typeToSpawn = 'MAMMAL';
             else if (currentUnlocked.includes('life_reptile') && rh > SEA_LEVEL + 1) typeToSpawn = 'REPTILE';
             else if (currentUnlocked.includes('life_bird') && rh > 5) typeToSpawn = 'BIRD';
             else if (currentUnlocked.includes('life_amphibian') && rh > SEA_LEVEL - 1 && rh < SEA_LEVEL + 1) typeToSpawn = 'AMPHIBIAN';

             if (typeToSpawn) {
                const stats = ENTITY_STATS[typeToSpawn];
                const packId = Math.random().toString(36).substring(7);
                const packSize = 2 + Math.floor(Math.random() * 4); // 2-6 pack size
                
                const newPack: Entity[] = [];
                for(let i=0; i<packSize; i++) {
                   // Slight offset for each pack member
                   const ox = rx + (Math.random() - 0.5) * 4;
                   const oz = rz + (Math.random() - 0.5) * 4;
                   
                   newPack.push({ 
                       id: Math.random().toString(), 
                       type: typeToSpawn!, 
                       x: ox, y: rh, z: oz, 
                       homeX: rx, homeZ: rz, // Shared home
                       packId: packId,
                       color: stats.color || '#fff',
                       energy: stats.maxEnergy || 100,
                       maxEnergy: stats.maxEnergy || 100,
                       age: 0,
                       diet: stats.diet as any || 'HERBIVORE'
                   });
                }
                setEntities(prev => [...prev, ...newPack].slice(0, 200)); // Hard cap safe check
             }
       }

       setEntities(prevEntities => {
          let nextEntities = [...prevEntities];
          let consumedIds: string[] = []; 

          nextEntities = nextEntities.map(e => ({
             ...e,
             age: e.age + dt,
             energy: e.energy - (0.1 * dt) 
          }));

          nextEntities.forEach(e => {
             if (e.energy >= e.maxEnergy) return;

             if (e.diet === 'HERBIVORE' || e.diet === 'OMNIVORE') {
                 const ix = Math.floor(e.x + MAP_SIZE/2);
                 const iz = Math.floor(e.z + MAP_SIZE/2);
                 const idx = iz * MAP_SIZE + ix;
                 
                 // STARVATION MECHANIC
                 if (idx >= 0 && idx < tData.vegetation.length) {
                     // Herbivores eat algae or grass
                     // Marine Check for Fish eating algae
                     if (e.type === 'FISH') {
                         if (tData.vegetation[idx] > 0.05) { // Algae
                            tData.vegetation[idx] -= 0.05;
                            e.energy += 10;
                            // No visual update call for minor algae changes to save perf
                         } else {
                            e.energy -= 1 * dt; // Starving underwater
                         }
                     } else {
                         // Land animals
                         if (tData.vegetation[idx] > 0.1) {
                             tData.vegetation[idx] -= 0.05; 
                             e.energy += 10;
                             setTerrainVersion(v => v+1); 
                         } else {
                             // Starving - lose extra energy
                             e.energy -= 1 * dt;
                         }
                     }
                 }
             }
             
             if (e.diet === 'CARNIVORE' || e.diet === 'OMNIVORE') {
                 const prey = nextEntities.find(p => p.id !== e.id && !consumedIds.includes(p.id) && Math.sqrt((p.x - e.x)**2 + (p.z - e.z)**2) < 2);
                 if (prey) {
                     consumedIds.push(prey.id);
                     e.energy += 50;
                 } else {
                     e.energy -= 1 * dt; // Starving
                 }
             }
          });
          
          nextEntities = nextEntities.filter(e => !consumedIds.includes(e.id));
          nextEntities = nextEntities.filter(e => e.energy > 0 && e.age < 3000);

          const babies: Entity[] = [];
          
          // Reproduction only if healthy and fed
          if (nextEntities.length < 200) {
              nextEntities.forEach(parent => {
                 if (parent.energy > parent.maxEnergy * 0.9) {
                    const localCount = nextEntities.filter(n => Math.abs(n.x - parent.x) < 10 && Math.abs(n.z - parent.z) < 10).length;
                    if (localCount < 10) { // Allowed local density higher now
                        parent.energy *= 0.6; 
                        
                        const isMigrating = Math.random() < 0.1; 
                        let hx = parent.homeX;
                        let hz = parent.homeZ;
                        let pid = parent.packId;
                        
                        if (isMigrating) {
                            const angle = Math.random() * Math.PI * 2;
                            const r = 20 + Math.random() * 20; 
                            hx = parent.x + Math.cos(angle) * r;
                            hz = parent.z + Math.sin(angle) * r;
                            pid = Math.random().toString(36).substring(7); // New pack ID
                        }

                        babies.push({
                           ...parent,
                           id: Math.random().toString(),
                           x: parent.x + (Math.random() - 0.5),
                           z: parent.z + (Math.random() - 0.5),
                           homeX: hx,
                           homeZ: hz,
                           packId: pid,
                           isMigrating: isMigrating,
                           age: 0,
                           energy: parent.maxEnergy * 0.5
                        });
                    }
                 }
              });
          }

          return [...nextEntities, ...babies];
       });
       
       let newUnlocks: string[] = [];
       EVOLUTION_TREE.forEach(node => {
         if (!currentUnlocked.includes(node.id)) {
            if (!node.parentId || currentUnlocked.includes(node.parentId)) {
               if (checkEvolutionCondition(node.id, tData, entitiesRef.current, plantsRef.current)) {
                  newUnlocks.push(node.id);
                  addNotification("Evolution Unlocked!", node.title, node.icon);
               }
            }
         }
       });
       if (newUnlocks.length > 0) setUnlockedEvolutions(prev => [...prev, ...newUnlocks]);

    }, 1000); 
    return () => clearInterval(lifeInterval);
  }, [isPaused]);


  return (
    <div className="relative w-full h-full flex flex-col bg-black select-none overflow-hidden font-sans">
      <VoxelScene 
        terrain={terrain}
        terrainVersion={terrainVersion}
        plants={plants}
        entities={entities}
        gameMode={gameMode} 
        onInteract={handleInteract}
        onSelect={handleSelect}
        isLocked={!isPaused}
        isPaused={isPaused}
        onUnlock={() => setIsPaused(true)} 
        followedEntity={entities.find(e => e.id === followedEntityId) || null}
        keyBindings={keyBindings}
        brushSize={brushSize}
        selectedPlantId={selectedPlantId}
      />
      
      <GameUI 
        inventory={{}}
        gameMode={gameMode}
        setGameMode={handleToggleGameMode}
        entityCount={entities.length}
        entities={entities}
        dustRate={0} // Deprecated
        isLocked={!isPaused} 
        setIsPaused={setIsPaused}
        unlockedEvolutions={unlockedEvolutions}
        notifications={notifications}
        eventLog={eventLog}
        brushSize={brushSize}
        setBrushSize={setBrushSize}
        onResume={() => setIsPaused(false)}
        onSave={() => {}}
        onLoad={() => {}}
        followedEntityName={entities.find(e => e.id === followedEntityId)?.type}
        onStopFollowing={() => setFollowedEntityId(null)}
        timeScale={timeScale}
        keyBindings={keyBindings}
        setKeyBindings={setKeyBindings}
        selectedPlantId={selectedPlantId}
        setSelectedPlantId={setSelectedPlantId}
        selectedEntity={entities.find(e => e.id === selectedEntityId) || null}
        selectedPlantIndex={selectedPlantIndex}
        weather={weather}
      />
    </div>
  );
};

export default App;