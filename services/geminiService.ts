import { GoogleGenAI, Type } from "@google/genai";
import { VoxelData } from "../types";

// Initialize Gemini Client
// Note: process.env.API_KEY is injected by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash";

export const generateVoxels = async (prompt: string, maxVoxels: number): Promise<VoxelData[]> => {
  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: `You are an expert voxel artist. 
        Your task is to generate a 3D voxel representation of the user's description.
        
        Rules:
        1. Output a JSON array of voxel objects.
        2. Each object must have integer 'x', 'y', 'z' coordinates.
        3. Each object must have a 'color' field with a 6-digit hex string (e.g., "#FF5733").
        4. Coordinate system:
           - Y is up/down.
           - X is left/right.
           - Z is depth.
        5. Center the model around (0, 0, 0).
        6. Keep the scale reasonable (e.g., within a -10 to 10 range per axis) to ensure the model is viewable.
        7. Optimize for "low poly" aesthetic. Do not generate internal voxels that are not visible.
        8. Maximize artistic appeal with limited resolution.
        9. Generate between 50 and ${maxVoxels} voxels depending on complexity. Do not exceed ${maxVoxels} voxels.
        `,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.INTEGER },
              y: { type: Type.INTEGER },
              z: { type: Type.INTEGER },
              color: { type: Type.STRING },
            },
            required: ["x", "y", "z", "color"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No data returned from AI");
    }

    const rawData = JSON.parse(text);
    // Map raw data to VoxelData, defaulting type to 'STRUCTURE' as the AI doesn't return type
    const data: VoxelData[] = rawData.map((v: any) => ({
      ...v,
      type: 'STRUCTURE'
    }));
    
    return data;
  } catch (error) {
    console.error("Voxel Generation Error:", error);
    throw error;
  }
};