import React, { useState, Suspense, useMemo } from 'react';
import { GameMode, EvolutionNode, NotificationItem, EventLogItem, Entity, KeyBindings, KeyAction, WeatherState } from '../types';
import { Mountain, Shovel, Droplets, CloudRain, CloudOff, MousePointer2, Save, Upload, Play, Info, Lock, CheckCircle2, Waves, Leaf, Footprints, Feather, Skull, Network, TreePine, Sun, Brain, PawPrint, Fish, History, Bell, BookOpen, Eye, Clock, Gamepad2, FileText, Settings, FastForward, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, XCircle, Sprout, CloudSnow, Flame, Thermometer, Layers } from 'lucide-react';
import { EVOLUTION_TREE, getTreeDepth, AVAILABLE_PLANTS, BIOME_EXPLANATIONS } from '../utils/gameUtils';
import { ENTITY_MODELS, PLANT_MODELS } from '../utils/voxelModels';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

interface GameUIProps {
  inventory: any; // Deprecated
  gameMode: GameMode;
  setGameMode: (mode: GameMode) => void;
  entityCount: number;
  entities: Entity[];
  dustRate: number;
  isLocked: boolean;
  setIsPaused: (p: boolean) => void;
  unlockedEvolutions: string[];
  notifications: NotificationItem[];
  eventLog: EventLogItem[];
  brushSize: number;
  setBrushSize: (s: number) => void;
  onResume: () => void;
  onSave: () => void;
  onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
  followedEntityName?: string;
  onStopFollowing: () => void;
  timeScale: number;
  keyBindings: KeyBindings;
  setKeyBindings: (kb: KeyBindings) => void;
  selectedPlantId: string;
  setSelectedPlantId: (id: string) => void;
  selectedEntity: Entity | null;
  selectedPlantIndex: number | null;
  weather: WeatherState;
}

const IconMap: Record<string, React.ReactNode> = {
  'Waves': <Waves className="w-6 h-6" />,
  'Leaf': <Leaf className="w-6 h-6" />,
  'Footprints': <Footprints className="w-6 h-6" />,
  'Feather': <Feather className="w-6 h-6" />,
  'Skull': <Skull className="w-6 h-6" />,
  'TreePine': <TreePine className="w-6 h-6" />,
  'Trees': <TreePine className="w-6 h-6" />,
  'Sun': <Sun className="w-6 h-6" />,
  'Brain': <Brain className="w-6 h-6" />,
  'PawPrint': <PawPrint className="w-6 h-6" />,
  'Fish': <Fish className="w-6 h-6" />,
  'Mountain': <Mountain className="w-6 h-6" />,
  'Sprout': <Sprout className="w-6 h-6" />,
  'Droplets': <Droplets className="w-6 h-6" />,
};

const ModelPreview: React.FC<{ type: string }> = ({ type }) => {
  // @ts-ignore
  const model = ENTITY_MODELS[type] || PLANT_MODELS[type];
  if (!model) return (
    <div className="w-full h-48 bg-gray-800/50 flex items-center justify-center text-gray-500 text-xs">No Model</div>
  );

  return (
    <div className="w-full h-48 bg-gray-800/50 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [3, 3, 3], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls autoRotate enableZoom={false} />
        <group position={[0, -0.5, 0]}>
          {model.map((v: any, i: number) => (
            <mesh key={i} position={[v.x * 0.5, v.y * 0.5, v.z * 0.5]}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color={v.color} />
            </mesh>
          ))}
        </group>
      </Canvas>
    </div>
  );
};

// ... TimelineGraph and Explanations components remain the same ...
const TimelineGraph: React.FC<{ unlocked: string[] }> = ({ unlocked }) => {
  const nodes = useMemo(() => {
    return EVOLUTION_TREE.map(node => ({
      ...node,
      depth: getTreeDepth(node.id),
    }));
  }, []);

  const columns: Record<number, typeof nodes> = {};
  nodes.forEach(n => {
    if (!columns[n.depth]) columns[n.depth] = [];
    columns[n.depth].push(n);
  });

  const nodeWidth = 200;
  const nodeHeight = 80;
  const gapX = 100;
  const gapY = 40;

  const layout = new Map<string, { x: number, y: number }>();
  Object.keys(columns).forEach(dKey => {
     const depth = parseInt(dKey);
     const colNodes = columns[depth].sort((a,b) => (a.parentId || '').localeCompare(b.parentId || ''));
     colNodes.forEach((node, idx) => {
        layout.set(node.id, {
           x: depth * (nodeWidth + gapX) + 50,
           y: idx * (nodeHeight + gapY) + 50
        });
     });
  });

  const maxX = Math.max(...Array.from(layout.values()).map(p => p.x)) + nodeWidth + 50;
  const maxY = Math.max(...Array.from(layout.values()).map(p => p.y)) + nodeHeight + 50;
  
  const containerWidth = Math.max(maxX, 1200);
  const containerHeight = Math.max(maxY, 400);

  return (
    <div className="w-full h-full bg-black/40 rounded-xl p-4 border border-gray-700 overflow-auto">
      <div style={{ width: containerWidth, height: containerHeight, position: 'relative' }}>
        <svg style={{ width: containerWidth, height: containerHeight, position: 'absolute', top: 0, left: 0 }}>
           {nodes.map(node => {
             if (!node.parentId) return null;
             const start = layout.get(node.parentId);
             const end = layout.get(node.id);
             const isUnlocked = unlocked.includes(node.id);
             if (!start || !end) return null;
             return (
               <path 
                 key={`${node.parentId}-${node.id}`}
                 d={`M ${start.x + nodeWidth} ${start.y + nodeHeight/2} C ${start.x + nodeWidth + gapX/2} ${start.y + nodeHeight/2}, ${end.x - gapX/2} ${end.y + nodeHeight/2}, ${end.x} ${end.y + nodeHeight/2}`}
                 stroke={isUnlocked ? "#3b82f6" : "#4b5563"}
                 strokeWidth="2"
                 fill="none"
               />
             );
           })}
        </svg>

        {nodes.map(node => {
           const pos = layout.get(node.id);
           const isUnlocked = unlocked.includes(node.id);
           if (!pos) return null;
           
           return (
             <div 
               key={node.id}
               className={`absolute p-3 rounded-lg border flex items-center gap-3 transition-colors duration-300 w-[200px] h-[80px]
                 ${isUnlocked ? 'bg-gray-800 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-900 border-gray-700 text-gray-500 grayscale opacity-80'}
               `}
               style={{ left: pos.x, top: pos.y }}
             >
                <div className={`p-2 rounded ${isUnlocked ? 'bg-blue-600' : 'bg-gray-800'}`}>
                  {IconMap[node.icon] || <Info className="w-4 h-4" />}
                </div>
                <div className="overflow-hidden">
                   <div className="text-xs font-bold truncate">{node.title}</div>
                   <div className="text-[10px] truncate opacity-70">{node.unlocksEntity || "Resource"}</div>
                </div>
             </div>
           );
        })}
      </div>
    </div>
  );
};

const Explanations: React.FC = () => (
  <div className="max-w-3xl mx-auto space-y-8 text-gray-300">
    <div className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
         <MousePointer2 className="w-5 h-5 text-blue-400" /> God Tools
      </h3>
      <p>Use the tools to shape the environment. You cannot create life directly; you must create the conditions for it to emerge.
         <br/><strong>Rise/Lower:</strong> Modifies terrain height.
         <br/><strong>Rain + / -:</strong> Modifies regional moisture. High moisture creates rivers and lush vegetation. Low moisture creates deserts.
      </p>
    </div>
  </div>
);

const GameUI: React.FC<GameUIProps> = ({
  inventory,
  gameMode,
  setGameMode,
  entityCount,
  entities,
  dustRate,
  isLocked,
  setIsPaused,
  unlockedEvolutions,
  notifications,
  eventLog,
  brushSize,
  setBrushSize,
  onResume,
  onSave,
  onLoad,
  followedEntityName,
  onStopFollowing,
  timeScale,
  keyBindings,
  setKeyBindings,
  selectedPlantId,
  setSelectedPlantId,
  selectedEntity,
  selectedPlantIndex,
  weather,
}) => {
  const [activeTab, setActiveTab] = useState<'TIMELINE' | 'BESTIARY' | 'CONTROLS' | 'HELP'>('TIMELINE');
  const [isStatsOpen, setIsStatsOpen] = useState(true);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);

  // Compute stats
  const stats = useMemo(() => {
     const counts: Record<string, number> = {};
     entities.forEach(e => {
        counts[e.type] = (counts[e.type] || 0) + 1;
     });
     return counts;
  }, [entities]);

  // ... NotificationToast ...
  const NotificationToast = () => (
    <div className="absolute bottom-8 right-8 z-50 flex flex-col gap-2 pointer-events-none">
      <style>{`
        @keyframes custom-fade {
          0% { opacity: 0; transform: translateY(20px); }
          22% { opacity: 1; transform: translateY(0); }
          77% { opacity: 1; }
          100% { opacity: 0; }
        }
        .animate-custom-fade {
          animation: custom-fade 9s ease-in-out forwards;
        }
      `}</style>
      {notifications.slice(-3).map((note) => (
        <div 
          key={note.id}
          className="animate-custom-fade bg-gray-900/90 border-l-4 border-blue-500 text-white p-4 rounded shadow-2xl backdrop-blur-md flex items-start gap-3 max-w-sm"
        >
          <div className="text-blue-400 mt-1">{IconMap[note.icon] || <Bell />}</div>
          <div>
            <h4 className="font-bold text-sm">{note.title}</h4>
            <p className="text-xs text-gray-300">{note.message}</p>
          </div>
        </div>
      ))}
    </div>
  );

  const WeatherWidget = () => (
    <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-xl w-64 mt-2">
        <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-white text-sm">Year {weather.year}</h3>
            <span className={`text-xs px-2 py-0.5 rounded ${
                weather.season === 'Winter' ? 'bg-blue-900 text-blue-200' :
                weather.season === 'Summer' ? 'bg-orange-900 text-orange-200' :
                'bg-green-900 text-green-200'
            }`}>{weather.season}</span>
        </div>
        
        {weather.isFreakEvent && (
            <div className="bg-red-900/50 border border-red-500/50 rounded p-2 mb-2 text-red-200 text-xs flex items-center gap-2">
                <Flame className="w-3 h-3 animate-pulse" />
                Alert: {weather.eventLabel}
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1 text-xs text-gray-400">
                     <Thermometer className="w-3 h-3" /> Temp
                 </div>
                 <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                     <div className="h-full bg-gradient-to-r from-blue-500 to-red-500 transition-all duration-1000" style={{ width: `${weather.temperature * 100}%` }} />
                 </div>
             </div>
             <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-1 text-xs text-gray-400">
                     <CloudRain className="w-3 h-3" /> Rain
                 </div>
                 <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${weather.rainfall * 100}%` }} />
                 </div>
             </div>
        </div>
    </div>
  );

  if (!isLocked) { 
    return (
      <div className="absolute inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl">
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          <div className="flex justify-between items-center text-white mb-6 border-b border-gray-800 pb-6">
             <div>
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
                  PAUSED
                </h1>
                <p className="text-gray-400 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4"/> Simulation halted
                </p>
             </div>
             <div className="flex gap-4">
                <button onClick={onResume} className="btn-primary flex items-center gap-2 px-6 py-2 bg-blue-600 rounded font-bold hover:bg-blue-500">
                   <Play className="w-4 h-4" /> Resume
                 </button>
             </div>
          </div>

          <div className="flex gap-2 mb-6">
             {['TIMELINE', 'BESTIARY', 'CONTROLS', 'HELP'].map((tab) => (
               <button 
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  className={`px-6 py-3 rounded-lg font-bold text-sm tracking-wider transition-all
                    ${activeTab === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-900 text-gray-500 hover:bg-gray-800 hover:text-white'}
                  `}
               >
                  {tab}
               </button>
             ))}
          </div>

          <div className="flex-1 bg-gray-900/30 border border-gray-800 rounded-2xl p-6 overflow-hidden flex flex-col">
             {activeTab === 'TIMELINE' && <TimelineGraph unlocked={unlockedEvolutions} />}
             {activeTab === 'CONTROLS' && <div className="overflow-auto"><ControlsEditor bindings={keyBindings} onChange={setKeyBindings} /></div>}
             {activeTab === 'HELP' && <div className="overflow-auto"><Explanations /></div>}
             {activeTab === 'BESTIARY' && (
               <div className="overflow-auto grid grid-cols-1 gap-8 p-4">
                 <div>
                    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2 border-b border-gray-700 pb-2">
                       <PawPrint className="text-orange-400"/> Fauna
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                       {EVOLUTION_TREE.filter(node => unlockedEvolutions.includes(node.id) && node.unlocksEntity).map(node => (
                          <div key={node.id} className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 shadow-xl">
                             <div className="h-40 bg-black/40 relative">
                                <ModelPreview type={node.unlocksEntity!} />
                                <div className="absolute top-2 right-2 p-1 bg-black/50 rounded">{IconMap[node.icon]}</div>
                             </div>
                             <div className="p-4">
                                <h4 className="font-bold text-white text-lg">{node.unlocksEntity}</h4>
                                <p className="text-xs text-blue-400 mb-2">{node.title}</p>
                                <p className="text-xs text-gray-400 line-clamp-2">{node.description}</p>
                             </div>
                          </div>
                       ))}
                    </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-40 overflow-hidden">
      <NotificationToast />
      
      <div className="flex flex-col items-start gap-2 pointer-events-auto transition-all duration-300">
        {isStatsOpen ? (
          <div className="flex flex-col gap-2">
            <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-xl w-64">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</div>
                <button onClick={() => setIsStatsOpen(false)} className="text-gray-400 hover:text-white"><ChevronUp className="w-4 h-4"/></button>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                    <div className="text-xl font-black text-white">{entityCount}</div>
                    <div className="text-[10px] text-green-400 uppercase">Population</div>
                    </div>
                    <div className="col-span-2">
                    <div className="text-xl font-black text-yellow-500 flex items-center gap-1">
                        {timeScale.toFixed(1)}x
                        {timeScale > 1 && <FastForward className="w-4 h-4 animate-pulse" />}
                    </div>
                    <div className="text-[10px] text-yellow-700 uppercase">Speed (PgUp/Dn)</div>
                    </div>
                </div>
                
                {/* Population Breakdown */}
                <div className="border-t border-gray-700 pt-3 mt-1 space-y-2">
                    {Object.keys(stats).length === 0 && <div className="text-xs text-gray-500 italic">No life detected.</div>}
                    {Object.entries(stats).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center text-xs">
                             <div className="text-gray-400 flex items-center gap-1">
                                {IconMap[EVOLUTION_TREE.find(n => n.unlocksEntity === type)?.icon || 'PawPrint'] || <PawPrint className="w-3 h-3"/>}
                                {type}
                             </div>
                             <div className="font-mono text-white">{count}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-4">
                    <button onClick={() => setIsPaused(true)} className="w-full py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300">
                        OPEN MENU ({keyBindings.PAUSE})
                    </button>
                </div>
            </div>
            
            <WeatherWidget />
          </div>
        ) : (
          <button onClick={() => setIsStatsOpen(true)} className="bg-gray-900/80 p-2 rounded-lg border border-gray-700 text-white hover:bg-gray-800 shadow-xl">
             <ChevronDown className="w-5 h-5" />
          </button>
        )}
        
        {/* Selection Panel */}
        {(selectedEntity || selectedPlantIndex !== null) && (
          <div className="mt-4 bg-blue-900/80 backdrop-blur-md border border-blue-500 rounded-xl p-3 shadow-xl w-64 animate-in slide-in-from-left duration-300">
              <div className="flex items-center gap-3 mb-2">
                 {selectedEntity ? (
                     <>
                        <div className="p-2 bg-blue-800 rounded-lg">{IconMap[EVOLUTION_TREE.find(n => n.unlocksEntity === selectedEntity.type)?.icon || 'PawPrint']}</div>
                        <div>
                           <div className="font-bold text-white">{selectedEntity.type}</div>
                           <div className="text-[10px] text-blue-300">
                             {selectedEntity.isMigrating ? "Migrating..." : "Roaming Territory"}
                           </div>
                        </div>
                     </>
                 ) : (
                     <>
                        <div className="p-2 bg-green-800 rounded-lg"><Sprout className="w-5 h-5 text-green-200" /></div>
                        <div>
                           <div className="font-bold text-white">Plant Life</div>
                           <div className="text-[10px] text-green-300">Wild Vegetation</div>
                        </div>
                     </>
                 )}
                 <button onClick={onStopFollowing} className="ml-auto text-gray-400 hover:text-white"><XCircle className="w-4 h-4"/></button>
              </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto transition-all duration-300">
        {isToolbarOpen ? (
          <>
            <button onClick={() => setIsToolbarOpen(false)} className="bg-gray-900/80 p-1 rounded-t-lg border-t border-x border-gray-700 text-gray-400 hover:text-white">
              <ChevronDown className="w-4 h-4" />
            </button>
            
            <div className="flex items-end gap-2 bg-gray-900/50 p-2 rounded-2xl border border-gray-700/50 backdrop-blur">
              <ToolButton active={gameMode === 'VIEW'} onClick={() => setGameMode('VIEW')} icon={<MousePointer2 className="w-5 h-5" />} label="View" hotkey="1" />
              <ToolButton active={gameMode === 'RISE'} onClick={() => setGameMode('RISE')} icon={<Mountain className="w-5 h-5" />} label="Rise" hotkey="2" />
              <ToolButton active={gameMode === 'LOWER'} onClick={() => setGameMode('LOWER')} icon={<Shovel className="w-5 h-5" />} label="Lower" hotkey="3" />
              <ToolButton active={gameMode === 'RAIN_ADD'} onClick={() => setGameMode('RAIN_ADD')} icon={<CloudRain className="w-5 h-5 text-blue-400" />} label="Rain +" hotkey="4" />
              <ToolButton active={gameMode === 'RAIN_SUB'} onClick={() => setGameMode('RAIN_SUB')} icon={<CloudOff className="w-5 h-5 text-yellow-400" />} label="Rain -" hotkey="5" />
              <div className="w-px h-10 bg-gray-700 mx-2"></div>
              
              <div className="flex flex-col items-center justify-center w-14 h-14 bg-gray-800 border border-gray-600 rounded-xl text-gray-400">
                <div className="text-lg font-bold text-white">{brushSize}</div>
                <div className="text-[8px] uppercase">Size</div>
              </div>
            </div>
            {(gameMode === 'RAIN_ADD' || gameMode === 'RAIN_SUB') && (
                <div className="bg-blue-900/80 px-3 py-1 rounded text-xs text-blue-100 mt-1 animate-pulse">
                    Moisture Overlay Active
                </div>
            )}
          </>
        ) : (
          <button onClick={() => setIsToolbarOpen(true)} className="bg-gray-900/80 p-3 rounded-full border border-gray-700 text-white hover:bg-gray-800 shadow-xl">
             <ChevronUp className="w-6 h-6" />
          </button>
        )}
      </div>
    </div>
  );
};

// ... ControlsEditor, ToolButton, InventoryItem remain the same ...
const ControlsEditor: React.FC<{ bindings: KeyBindings, onChange: (kb: KeyBindings) => void }> = ({ bindings, onChange }) => {
  const [listeningFor, setListeningFor] = useState<KeyAction | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (listeningFor) {
      e.preventDefault();
      e.stopPropagation();
      onChange({ ...bindings, [listeningFor]: e.code });
      setListeningFor(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" onKeyDown={handleKeyDown} tabIndex={0}>
       {Object.entries(bindings).map(([action, code]) => (
         <div key={action} className="flex justify-between items-center p-3 bg-gray-800 rounded border border-gray-700">
            <span className="font-bold text-gray-300 text-sm">{action}</span>
            <button 
              onClick={() => setListeningFor(action as KeyAction)}
              className={`px-3 py-1 rounded font-mono text-xs border 
                ${listeningFor === action ? 'bg-red-900 border-red-500 animate-pulse text-white' : 'bg-black/50 border-gray-600 text-blue-400 hover:bg-black'}`}
            >
              {listeningFor === action ? 'PRESS KEY' : code}
            </button>
         </div>
       ))}
    </div>
  );
};

const ToolButton: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string, hotkey: string }> = ({ active, onClick, icon, label, hotkey }) => (
  <button
    onClick={onClick}
    className={`
      flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all border-2 relative
      ${active 
        ? 'bg-blue-600 border-blue-400 text-white -translate-y-2 shadow-lg shadow-blue-900/50' 
        : 'bg-gray-900/90 border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white'}
    `}
  >
    {icon}
    <span className="text-[9px] font-bold mt-0.5">{label}</span>
    <span className="absolute top-1 right-1 text-[8px] opacity-50 font-mono">{hotkey}</span>
  </button>
);

export default GameUI;