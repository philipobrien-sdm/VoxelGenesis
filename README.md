# VoxelGenesis: Evolutionary Ecosystem Simulator

**VoxelGenesis** is a browser-based, 3D interactive sandbox that simulates a living, breathing ecosystem. Built with React and Three.js, it places you in the role of a deity, allowing you to sculpt terrain, control the climate, and nurture the evolution of life from simple organisms to complex mammals.

The simulation runs a complex logic loop featuring cyclical seasons, metabolic energy systems, and dynamic population genetics.
<img width="1000" height="500" alt="Screenshot 2025-12-03 210851" src="https://github.com/user-attachments/assets/edbd79e1-3f5f-4cfa-b5f8-58ed9310da1c" />

## 🌟 Key Features

### 🌍 Terraforming & Climate Control
*   **Voxel Sculpting**: Raise mountains to create barriers or dig trenches to form oceans and lakes.
*   **Moisture Painting**: Control the rainfall in specific regions. Turn deserts into lush jungles or dry out swamps to force adaptation.
*   **Dynamic Biomes**: The terrain shader automatically updates based on height and moisture, transitioning from Sand -> Grass -> Forest -> Snow / Mountain Rock.

### 🌦️ Advanced Weather System
*   **Seasons**: A full yearly cycle (Spring, Summer, Autumn, Winter) that dictates temperature and vegetation growth.
*   **Climate Trends**: A 10-year sine-wave trend shifts global baselines, creating eras of drought or ice ages.
*   **Freak Events**: Probabilistic weather events like **Heatwaves**, **Cold Snaps**, and **Monsoons** that can destabilize the ecosystem.

### 🧬 Evolution & Life Simulation
*   **Evolutionary Tree**: Unlock new species by creating specific environmental conditions.
    *   *Water &rarr; Fish &rarr; Amphibians &rarr; Reptiles &rarr; Mammals / Birds*.
*   **Metabolism**: Animals burn energy based on movement speed and ambient temperature. Cold winters increase energy costs.
*   **Pack Behavior**: Social animals spawn and move in groups using a shared pack ID.
*   **Food Chain**:
    *   **Herbivores** graze on vegetation (grass/kelp). Overgrazing turns land to dirt.
    *   **Carnivores** hunt other entities.
    *   **Starvation**: Lack of food or extreme weather leads to population collapse.

### 📊 Real-time Analytics
*   **Population Counters**: Track the breakdown of species in your world.
*   **Timeline**: Visual graph showing your progress through the evolutionary tree.
*   **Bestiary**: Inspect 3D voxel models of unlocked species.

## 🎮 Controls

### Camera & Movement
*   **W / A / S / D**: Move Camera (Forward, Left, Back, Right)
*   **Click & Drag (View Mode)**: Pan the map
*   **Scroll Wheel**: Zoom In/Out
*   **Ctrl + Scroll**: Adjust Camera Pitch
*   **Space**: Ascend (Camera Up)
*   **Alt**: Descend (Camera Down)
*   **End**: Rotate Camera 90 degrees

### Tools & Interaction
*   **1**: View Mode (Select entities/pan)
*   **2**: Rise Terrain
*   **3**: Lower Terrain
*   **4**: Rain + (Increase Moisture)
*   **5**: Rain - (Decrease Moisture)
*   **+ / -**: Increase/Decrease Brush Size

### Simulation Management
*   **Page Up**: Speed Up Time
*   **Page Down**: Slow Down Time
*   **ESC**: Pause / Open Menu

## 🛠️ Tech Stack

*   **Frontend**: React 19
*   **3D Engine**: Three.js / @react-three/fiber
*   **UI Components**: Lucide React, Tailwind CSS
*   **Noise Generation**: `simplex-noise` for terrain generation
*   **AI Integration**: Google GenAI SDK (configured for generative capabilities)

## 🚀 Getting Started

1.  **Installation**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Ensure you have an API key for the Google GenAI SDK if utilizing the generative features.
    
    *Note: The core ecosystem simulation runs locally without the API key, but generative features require it.*

3.  **Run the App**
    ```bash
    npm start
    ```

## 🧠 Simulation Logic

The heart of the project is the physics loop in `App.tsx`.

*   **Vegetation Growth**: Calculated every tick based on `(Moisture + Rainfall) / 2` and `Temperature`.
    *   *Winter (< 0.3 Temp)*: Vegetation decays.
    *   *Spring/Summer*: Growth is boosted.
*   **Marine Life**: Fish consume algae (vegetation < 0.5) and Kelp.
*   **Rebound Mechanic**: If population drops below 20, spontaneous spawning rates increase to prevent total extinction.
*   **Evolution Check**: The system periodically scans the map statistics (Land count, Water count, Avg Temp) to see if criteria for the next evolutionary node are met.

## 📄 License

Distributed under the MIT License.
