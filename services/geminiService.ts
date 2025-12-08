import { GoogleGenAI, Type } from "@google/genai";
import { Measurements } from "../types";

export const detectLandmarks = async (
  base64Image: string
): Promise<Partial<Measurements> | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing");
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We remove the data:image/xxx;base64, prefix for the API
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const prompt = `
      Analyze this image of a person wearing glasses for optometry measurement purposes.
      I need to find the vertical position of the top rim of the glasses frame and the bottom rim of the glasses frame to measure frame height.
      I also need the precise center coordinates of the person's left pupil and right pupil.
      
      Important: 
      - "Left Pupil" refers to the person's left eye (which appears on the right side of the image for the viewer).
      - "Right Pupil" refers to the person's right eye (which appears on the left side of the image for the viewer).
      - All coordinates must be normalized (0.0 to 1.0) relative to the image dimensions.
      
      Return a JSON object.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: base64Data } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            frameTopY: { type: Type.NUMBER, description: "Y coordinate of the top edge of the lens/frame (0-1)" },
            frameBottomY: { type: Type.NUMBER, description: "Y coordinate of the bottom edge of the lens/frame (0-1)" },
            leftPupil: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"],
              description: "Center of the person's left eye (viewer's right)"
            },
            rightPupil: {
              type: Type.OBJECT,
              properties: {
                x: { type: Type.NUMBER },
                y: { type: Type.NUMBER }
              },
              required: ["x", "y"],
              description: "Center of the person's right eye (viewer's left)"
            }
          },
          required: ["frameTopY", "frameBottomY", "leftPupil", "rightPupil"]
        }
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        frameTopY: data.frameTopY,
        frameBottomY: data.frameBottomY,
        leftPupil: data.leftPupil,
        rightPupil: data.rightPupil,
        rotation: 0 // AI usually assumes upright, let user adjust rotation manually
      };
    }
    return null;
  } catch (error) {
    console.error("Gemini detection failed:", error);
    return null;
  }
};
