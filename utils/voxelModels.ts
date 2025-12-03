import { VoxelModel, Entity } from "../types";

// Helper to mirror on X axis
const mirrorX = (voxels: VoxelModel): VoxelModel => {
  return [
    ...voxels,
    ...voxels.map(v => ({ ...v, x: -v.x }))
  ];
};

export const ENTITY_MODELS: Record<Entity['type'], VoxelModel> = {
  FISH: [
    { x: 0, y: 0, z: 0, color: '#f97316' }, // Body center
    { x: 0, y: 0, z: 1, color: '#f97316' }, // Head
    { x: 0, y: 0, z: -1, color: '#fdba74' }, // Tail base
    { x: 0, y: 0.2, z: -1.2, color: '#fed7aa' }, // Tail fin top
    { x: 0, y: -0.2, z: -1.2, color: '#fed7aa' }, // Tail fin bot
    { x: 0.2, y: 0, z: 0.2, color: '#fff' }, // Eye R
    { x: -0.2, y: 0, z: 0.2, color: '#fff' }, // Eye L
  ],
  AMPHIBIAN: mirrorX([
    { x: 0, y: 0, z: 0, color: '#65a30d' }, // Body
    { x: 0, y: 0, z: 0.2, color: '#4d7c0f' }, // Back
    { x: 0.3, y: -0.1, z: 0.2, color: '#84cc16' }, // Leg Back R
    { x: 0.3, y: -0.1, z: -0.2, color: '#84cc16' }, // Leg Front R
    { x: 0.1, y: 0.2, z: 0.3, color: '#3f6212' }, // Eye
  ]),
  REPTILE: [
    // Body
    { x: 0, y: 0.1, z: 0, color: '#15803d' }, 
    { x: 0, y: 0.1, z: 0.3, color: '#15803d' },
    { x: 0, y: 0.1, z: -0.3, color: '#15803d' },
    // Head
    { x: 0, y: 0.2, z: 0.5, color: '#166534' },
    // Tail
    { x: 0, y: 0, z: -0.6, color: '#86efac' },
    { x: 0, y: 0, z: -0.8, color: '#86efac' },
    // Legs
    { x: 0.3, y: 0, z: 0.3, color: '#14532d' },
    { x: -0.3, y: 0, z: 0.3, color: '#14532d' },
    { x: 0.3, y: 0, z: -0.3, color: '#14532d' },
    { x: -0.3, y: 0, z: -0.3, color: '#14532d' },
  ],
  BIRD: [
    { x: 0, y: 0, z: 0, color: '#e11d48' }, // Body
    { x: 0, y: 0.1, z: 0.1, color: '#e11d48' }, // Head
    { x: 0, y: 0.1, z: 0.3, color: '#fbbf24' }, // Beak
    { x: 0.3, y: 0.1, z: -0.1, color: '#be123c' }, // Wing R
    { x: -0.3, y: 0.1, z: -0.1, color: '#be123c' }, // Wing L
    { x: 0, y: 0.1, z: -0.2, color: '#9f1239' }, // Tail
  ],
  MAMMAL: mirrorX([
    { x: 0, y: 0.2, z: 0, color: '#78350f' }, // Torso
    { x: 0, y: 0.2, z: 0.2, color: '#78350f' },
    { x: 0, y: 0.2, z: -0.2, color: '#78350f' },
    
    { x: 0, y: 0.4, z: 0.4, color: '#92400e' }, // Head
    { x: 0, y: 0.4, z: 0.6, color: '#1f2937' }, // Nose
    
    { x: 0.2, y: 0, z: 0.2, color: '#451a03' }, // Leg FR
    { x: 0.2, y: 0, z: -0.2, color: '#451a03' }, // Leg BR
  ]),
  PRIMATE: [
    // Body
    { x: 0, y: 0.3, z: 0, color: '#d97706' },
    { x: 0, y: 0.5, z: 0, color: '#d97706' },
    // Head
    { x: 0, y: 0.7, z: 0, color: '#b45309' },
    { x: 0, y: 0.7, z: 0.1, color: '#fcd34d' }, // Face
    // Arms
    { x: 0.3, y: 0.5, z: 0, color: '#92400e' },
    { x: -0.3, y: 0.5, z: 0, color: '#92400e' },
    // Legs
    { x: 0.15, y: 0.1, z: 0, color: '#92400e' },
    { x: -0.15, y: 0.1, z: 0, color: '#92400e' },
  ]
};

export const PLANT_MODELS: Record<string, VoxelModel> = {
  TREE: [
      { x: 0, y: 0, z: 0, color: '#451a03' },
      { x: 0, y: 1, z: 0, color: '#451a03' },
      { x: 0, y: 2, z: 0, color: '#15803d' }, 
      { x: 1, y: 2, z: 0, color: '#15803d' },
      { x: -1, y: 2, z: 0, color: '#15803d' },
      { x: 0, y: 2, z: 1, color: '#15803d' },
      { x: 0, y: 2, z: -1, color: '#15803d' },
      { x: 0, y: 3, z: 0, color: '#16a34a' },
  ],
  MOSS: [
     { x: 0, y: 0, z: 0, color: '#4ade80' },
     { x: 0.5, y: 0, z: 0.5, color: '#22c55e' },
     { x: -0.5, y: 0, z: -0.2, color: '#86efac' },
  ],
  SHRUB: [
     { x: 0, y: 0, z: 0, color: '#65a30d' },
     { x: 0.2, y: 0.2, z: 0, color: '#84cc16' },
     { x: -0.2, y: 0.2, z: 0.2, color: '#4d7c0f' },
  ],
  KELP: [
     { x: 0, y: 0, z: 0, color: '#064e3b' },
     { x: 0, y: 1, z: 0, color: '#064e3b' },
     { x: 0.1, y: 2, z: 0, color: '#065f46' },
     { x: -0.1, y: 3, z: 0, color: '#047857' },
     { x: 0, y: 4, z: 0, color: '#059669' },
  ]
};