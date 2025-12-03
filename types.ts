import 'react';

// New Terrain System Types
export interface TerrainData {
  size: number;
  heights: Float32Array; // 1D array representing 2D grid
  moisture: Float32Array; // 0.0 to 1.0
  vegetation: Float32Array; // 0.0 to 1.0 (Density of grass/moss)
}

// VoxelData is now only for Structures/Flora on top of terrain
export interface VoxelData {
  x: number;
  y: number;
  z: number;
  color: string;
  type: 'PLANT' | 'STRUCTURE' | 'WATER_SOURCE'; 
}

export interface Entity {
  id: string;
  type: 'FISH' | 'AMPHIBIAN' | 'REPTILE' | 'BIRD' | 'MAMMAL' | 'PRIMATE';
  x: number;
  y: number;
  z: number;
  color: string;
  rotation?: number; 
  vx?: number;
  vy?: number;
  vz?: number;
  targetX?: number; 
  targetY?: number;
  targetZ?: number;
  
  // Territory & Migration
  homeX: number;
  homeZ: number;
  isMigrating?: boolean;
  packId?: string; // For grouping behavior
  
  // Life Sim
  energy: number;
  maxEnergy: number;
  age: number;
  diet: 'HERBIVORE' | 'CARNIVORE' | 'OMNIVORE';
}

export type GameMode = 'VIEW' | 'RISE' | 'LOWER' | 'RAIN_ADD' | 'RAIN_SUB';

export type Season = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export interface WeatherState {
  year: number;
  season: Season;
  temperature: number; // 0.0 (Freezing) to 1.0 (Scorching)
  rainfall: number; // 0.0 (Arid) to 1.0 (Monsoon)
  isFreakEvent: boolean;
  eventLabel?: string;
}

export interface EvolutionNode {
  id: string;
  title: string;
  hint: string;
  description: string;
  icon: string; 
  parentId?: string;
  unlocksEntity?: Entity['type'];
  dustMultiplierBonus?: number;
}

export interface PlantDefinition {
  id: string;
  name: string;
  cost: number;
  unlockId: string;
  structure: { x: number, y: number, z: number, color: string }[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  icon: string;
  timestamp: number;
}

export interface EventLogItem {
  id: string;
  title: string;
  timestamp: Date;
  description: string;
}

export type VoxelModel = { x: number, y: number, z: number, color: string }[];

export type KeyAction = 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'ROTATE' | 'PAUSE' | 'ASCEND' | 'DESCEND';
export type KeyBindings = Record<KeyAction, string>;

// Augment React's JSX namespace for React 18+ / Automatic Runtime
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      group: any;
      mesh: any;
      boxGeometry: any;
      planeGeometry: any;
      ringGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      fog: any;
      primitive: any;
      instancedMesh: any;
      [elemName: string]: any;
    }
  }
}

// Augment Global JSX namespace for Classic Runtime / General TS
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      group: any;
      mesh: any;
      boxGeometry: any;
      planeGeometry: any;
      ringGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      fog: any;
      primitive: any;
      instancedMesh: any;
      [elemName: string]: any;
    }
  }
}