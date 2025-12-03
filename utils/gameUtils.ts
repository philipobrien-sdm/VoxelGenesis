import { VoxelData, EvolutionNode, Entity, PlantDefinition, TerrainData, WeatherState, Season } from "../types";
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';

export const MAP_SIZE = 128;
export const SEA_LEVEL = 1.0;

export const hexToRgb = (hex: string): { r: number, g: number, b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
};

// Weather Logic
export const calculateWeather = (tick: number): WeatherState => {
  // Game Time Constants
  const TICKS_PER_DAY = 30; // ~1 second
  const DAYS_PER_SEASON = 30; // ~30 seconds
  const SEASONS_PER_YEAR = 4;
  const TICKS_PER_YEAR = TICKS_PER_DAY * DAYS_PER_SEASON * SEASONS_PER_YEAR; // ~2 minutes per year
  const TREND_CYCLE_YEARS = 10;
  
  // Calculate Time Units
  const year = Math.floor(tick / TICKS_PER_YEAR) + 1;
  const seasonIndex = Math.floor((tick % TICKS_PER_YEAR) / (TICKS_PER_DAY * DAYS_PER_SEASON));
  const seasonProgress = ((tick % (TICKS_PER_YEAR / 4)) / (TICKS_PER_YEAR / 4));
  
  const SEASONS: Season[] = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const currentSeason = SEASONS[seasonIndex];

  // 1. Seasonal Base Values
  let baseTemp = 0.5;
  let baseRain = 0.5;

  switch (currentSeason) {
      case 'Spring': baseTemp = 0.6; baseRain = 0.7; break;
      case 'Summer': baseTemp = 0.8; baseRain = 0.3; break;
      case 'Autumn': baseTemp = 0.5; baseRain = 0.6; break;
      case 'Winter': baseTemp = 0.2; baseRain = 0.5; break; // Snow
  }

  // 2. 10-Year Trend Line (Sine Wave)
  // Continuous variation over 10 years
  const trendPhase = (year % TREND_CYCLE_YEARS) / TREND_CYCLE_YEARS;
  const trendMod = Math.sin(trendPhase * Math.PI * 2); 
  
  // Apply trend: Some decades are hotter/drier, others cooler/wetter
  baseTemp += trendMod * 0.15; 
  baseRain -= trendMod * 0.1; // Hotter usually implies drier trends in this model

  // 3. Daily Fluctuation
  const dailyNoise = Math.sin(tick * 0.05) * 0.05;
  baseTemp += dailyNoise;

  // 4. Freak Weather (Probabilistic)
  // seeded by current day to stay consistent for the "day"
  const daySeed = Math.floor(tick / TICKS_PER_DAY);
  const isFreak = (daySeed * 9301 + 49297) % 100 < 2; // 2% chance per day
  let eventLabel = undefined;

  if (isFreak) {
      const type = (daySeed % 3);
      if (type === 0) {
          baseTemp += 0.4; // Heatwave
          eventLabel = "Heatwave";
      } else if (type === 1) {
          baseTemp -= 0.4; // Cold Snap
          eventLabel = "Cold Snap";
      } else {
          baseRain += 0.5; // Monsoon
          eventLabel = "Monsoon";
      }
  }

  return {
      year,
      season: currentSeason,
      temperature: Math.max(0, Math.min(1, baseTemp)),
      rainfall: Math.max(0, Math.min(1, baseRain)),
      isFreakEvent: isFreak,
      eventLabel
  };
};

// Biome Logic
export const getBiomeColor = (height: number, moisture: number, vegetation: number): string => {
  // 1. Ocean
  if (height < 0.2) return '#3b82f6'; // Deep Ocean
  if (height < SEA_LEVEL) return '#60a5fa'; // Shallow Water / Sea Level

  // 2. Rivers
  if (height < SEA_LEVEL + 3.0 && moisture > 0.85) {
     return '#60a5fa'; // River Blue
  }

  // 3. High Altitude
  if (height > 8.0) {
    if (moisture > 0.5) return '#e5e7eb'; // Snow
    return '#57534e'; // Scorched Mountain Peak
  }

  // 4. Vegetation Overlay
  if (vegetation > 0.1) {
    if (vegetation > 0.8) return '#14532d'; // Dense Jungle
    if (vegetation > 0.5) return '#16a34a'; // Grassland
    if (vegetation > 0.2) return '#84cc16'; // Sparse
  }

  // 5. Barren Land Biomes
  if (height < SEA_LEVEL + 0.5) return '#fde047'; // Beach
  
  if (height > 5.0) {
    if (moisture < 0.3) return '#78350f'; // Red Rocky Mountain
    return '#57534e'; // Stone Mountain
  }

  if (moisture < 0.25) return '#d97706'; // Desert
  if (moisture < 0.4) return '#fcd34d'; // Savanna
  
  return '#57534e'; // Generic dirt
};

export const generateMoistureColor = (moisture: number): string => {
    // Red (Dry) -> Yellow -> Blue (Wet)
    if (moisture < 0.3) return '#ef4444'; // Red
    if (moisture < 0.6) return '#facc15'; // Yellow
    return '#3b82f6'; // Blue
};

export const BIOME_EXPLANATIONS = [
  { name: 'Deep Ocean', color: '#3b82f6', desc: 'Starting point of life.' },
  { name: 'Shallows/River', color: '#60a5fa', desc: 'Freshwater and transition zones.' },
  { name: 'Vegetation', color: '#16a34a', desc: 'Green areas indicate grass or moss.' },
  { name: 'Beach', color: '#fde047', desc: 'Dry land edge.' },
  { name: 'Desert', color: '#d97706', desc: 'Very dry. Reptiles thrive here.' },
  { name: 'Mountain', color: '#57534e', desc: 'High altitude stone.' },
];

export const generateTerrainData = (size: number): TerrainData => {
  const heights = new Float32Array(size * size);
  const moisture = new Float32Array(size * size);
  const vegetation = new Float32Array(size * size);
  
  const heightNoise = createNoise2D();
  const moistureNoise = createNoise2D(); 
  
  const center = size / 2;
  const maxRadius = size / 2;

  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const idx = z * size + x;
      const nx = x / 40;
      const nz = z / 40;
      
      const dx = x - center;
      const dz = z - center;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const d = dist / maxRadius;
      let mask = 1.0 - Math.pow(d, 2.5); 
      if (mask < 0) mask = 0;

      let h = heightNoise(nx, nz) * 6 + heightNoise(nx * 2, nz * 2) * 3;
      h = (h + 3) * mask - 2; 
      if (h > 5) h += heightNoise(nx * 4, nz * 4);
      heights[idx] = h;

      let m = (moistureNoise(nx * 2, nz * 2) + 1) / 2; 
      moisture[idx] = m;
      
      // Seed initial vegetation near water
      if (h > SEA_LEVEL && h < SEA_LEVEL + 1.0 && m > 0.4) {
         vegetation[idx] = 0.2;
      } else {
         vegetation[idx] = 0.0;
      }
    }
  }

  return { size, heights, moisture, vegetation };
};

export const getTerrainHeight = (data: TerrainData, x: number, z: number): number => {
  const half = data.size / 2;
  const ix = Math.floor(x + half);
  const iz = Math.floor(z + half);
  
  if (ix < 0 || ix >= data.size || iz < 0 || iz >= data.size) return -10;
  
  return data.heights[iz * data.size + ix];
};

export const checkPlantSuitability = (plantId: string, height: number, moisture: number): boolean => {
  return height > SEA_LEVEL + 0.2 && moisture > 0.4;
};

// --- Plants & Evolution ---

export const AVAILABLE_PLANTS: PlantDefinition[] = [
  {
    id: 'shrub',
    name: 'Wild Shrub',
    cost: 0, 
    unlockId: 'flora_grass',
    structure: [
      { x: 0, y: 0.2, z: 0, color: '#65a30d' } 
    ]
  },
  {
    id: 'tree',
    name: 'Pine Tree',
    cost: 0, 
    unlockId: 'flora_tree',
    structure: [
      { x: 0, y: 0.5, z: 0, color: '#451a03' }, 
      { x: 0, y: 1.5, z: 0, color: '#15803d' }, 
      { x: 0, y: 2.5, z: 0, color: '#16a34a' }, 
    ]
  },
  {
    id: 'kelp',
    name: 'Giant Kelp',
    cost: 0,
    unlockId: 'flora_algae',
    structure: [
       { x: 0, y: 0, z: 0, color: '#064e3b' },
       { x: 0, y: 1, z: 0, color: '#064e3b' },
       { x: 0, y: 2, z: 0, color: '#065f46' },
    ]
  }
];

export const EVOLUTION_TREE: EvolutionNode[] = [
  { id: 'origin_water', title: 'Primordial Soup', hint: 'The island edges are your cradle.', description: 'Life begins in the deep blue.', icon: 'Waves', dustMultiplierBonus: 0.1 },
  { id: 'origin_land', title: 'Fertile Soil', hint: 'Find the dry land.', description: 'Dry land provides a foundation.', icon: 'Mountain', dustMultiplierBonus: 0.1 },
  
  // Flora
  { id: 'flora_algae', title: 'Algae Blooms', hint: 'Water needs time.', description: 'Simple plant life.', icon: 'Droplets', parentId: 'origin_water', dustMultiplierBonus: 0.2 },
  { id: 'flora_moss', title: 'Vegetation', hint: 'Ensure moisture touches land.', description: 'Greenery covers the stone.', icon: 'Sprout', parentId: 'origin_land', dustMultiplierBonus: 0.2 },
  { id: 'flora_grass', title: 'Dense Pastures', hint: 'Increase rainfall on flat land.', description: 'Vast fields of grass.', icon: 'Leaf', parentId: 'flora_moss', dustMultiplierBonus: 0.5 },
  { id: 'flora_tree', title: 'Deep Roots', hint: 'Maintain high moisture in grassy areas.', description: 'Trees provide shelter.', icon: 'TreePine', parentId: 'flora_grass', dustMultiplierBonus: 1.0 },
  { id: 'flora_forest', title: 'Ancient Canopy', hint: 'A dense, wet ecosystem.', description: 'A thriving forest.', icon: 'Trees', parentId: 'flora_tree', dustMultiplierBonus: 2.0 },

  // Fauna
  { id: 'life_fish', title: 'Ichthyology', hint: 'Ensure ample ocean space.', description: 'Fish now inhabit the waters.', icon: 'Fish', parentId: 'origin_water', unlocksEntity: 'FISH' },
  { id: 'life_amphibian', title: 'The First Step', hint: 'Create wet shorelines (transition zones).', description: 'Amphibians venture onto muddy banks.', icon: 'Footprints', parentId: 'life_fish', unlocksEntity: 'AMPHIBIAN' },
  { id: 'life_reptile', title: 'Scales & Sun', hint: 'Create dry deserts (Low moisture land).', description: 'Reptiles adapt to the dry land.', icon: 'Sun', parentId: 'life_amphibian', unlocksEntity: 'REPTILE' },
  { id: 'life_mammal', title: 'Warm Blood', hint: 'Create rich, lush grasslands.', description: 'Mammals roam the plains.', icon: 'PawPrint', parentId: 'life_reptile', unlocksEntity: 'MAMMAL' },
  { id: 'life_bird', title: 'Flight', hint: 'Create high peaks and forests.', description: 'Birds soar above.', icon: 'Feather', parentId: 'life_reptile', unlocksEntity: 'BIRD' },
];

export const checkEvolutionCondition = (nodeId: string, terrain: TerrainData, entities: Entity[], plants: VoxelData[]): boolean => {
  const { heights, moisture, vegetation } = terrain;
  let waterCount = 0;
  let landCount = 0;
  let vegCount = 0;
  let desertCount = 0;
  let mountainCount = 0;
  
  for(let i=0; i<heights.length; i+=20) {
     const h = heights[i];
     const m = moisture[i];
     const v = vegetation[i];
     
     if (h < SEA_LEVEL) waterCount++;
     else {
        landCount++;
        if (h > 5.0) mountainCount++;
        if (v > 0.3) vegCount++;
        if (m < 0.25) desertCount++;
     }
  }

  const plantCount = plants.length;

  switch (nodeId) {
    case 'origin_water': return true;
    case 'origin_land': return landCount > 10;
    
    case 'flora_algae': return waterCount > 50;
    case 'flora_moss': return vegCount > 10;
    case 'flora_grass': return vegCount > 50;
    case 'flora_tree': return vegCount > 80 && moisture.some(m => m > 0.7); // Requires wet environment
    case 'flora_forest': return plantCount >= 10;
    
    case 'life_fish': return waterCount > 100;
    case 'life_amphibian': return waterCount > 50 && landCount > 50;
    case 'life_reptile': return desertCount > 10;
    case 'life_mammal': return vegCount > 30 && entities.length > 5;
    case 'life_bird': return plantCount > 10 && mountainCount > 10;

    default: return false;
  }
};

export const getTreeDepth = (nodeId: string, depth = 0): number => {
  const node = EVOLUTION_TREE.find(n => n.id === nodeId);
  if (!node || !node.parentId) return depth;
  return getTreeDepth(node.parentId, depth + 1);
};