
import { GoogleGenAI, Type } from "@google/genai";
import { Gender, BodySize } from "../types";

const prepareImagePart = (base64String: string) => {
  const parts = base64String.split(',');
  const data = parts.length > 1 ? parts[1] : parts[0];
  return {
    inlineData: {
      data,
      mimeType: 'image/jpeg'
    }
  };
};

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error.message?.includes('429') || error.message?.includes('500') || error.status === 429;
    if (isRetryable && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const analyzeTryOn = async (
  personImageBase64: string, 
  shirtImageBase64: string | null, 
  pantImageBase64: string | null,
  dressImageBase64: string | null,
  gender: Gender,
  preferredSize: BodySize
) => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    
    const prompt = `
      [SYSTEM_DESIGNER: BODY_STRUCTURE_ANALYSIS]
      You are a high-precision virtual try-on system. 
      
      STEP 1: ANALYZE PERSON (x_p)
      - Detect body landmarks: shoulders, chest width, waist position, arm length, and torso length.
      - Use these landmarks to estimate the subject's physical size relative to the garments.
      - DO NOT imagine the body underneath clothing or change the posture.
      
      STEP 2: ANALYZE GARMENT (x_g)
      - Determine Sleeve Type: Are the sleeves "SHORT/HALF" or "LONG/FULL"?
      - Identify hemline construction: Is it designed to be worn un-tucked?
      
      STEP 3: FIT PLANNING
      - Plan an UN-TUCKED fit for size ${preferredSize}.
      - Maintain the EXACT pose of the person.
    `;

    const parts: any[] = [
      { text: prompt },
      { text: "PERSON_PORTRAIT (x_p):" },
      prepareImagePart(personImageBase64)
    ];

    if (shirtImageBase64) parts.push({ text: "SOURCE_TOP (x_g):" }, prepareImagePart(shirtImageBase64));
    if (pantImageBase64) parts.push({ text: "SOURCE_BOTTOM (x_g):" }, prepareImagePart(pantImageBase64));
    if (dressImageBase64) parts.push({ text: "SOURCE_DRESS (x_g):" }, prepareImagePart(dressImageBase64));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            garmentDescription: { type: Type.STRING },
            personDescription: { type: Type.STRING },
            sleeveLength: { type: Type.STRING, enum: ['SHORT', 'LONG', 'NONE'] },
            technicalPrompt: { type: Type.STRING, description: "Detailed fit and draping instructions." }
          },
          required: ["garmentDescription", "personDescription", "technicalPrompt", "sleeveLength"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  });
};

export const generateVirtualTryOnImage = async (
  personImageBase64: string, 
  shirtImageBase64: string | null, 
  pantImageBase64: string | null,
  dressImageBase64: string | null,
  technicalDescription: string, 
  selectedSize: BodySize, 
  gender: Gender,
  detectedSleeve: string
) => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
    
    const sleeveRule = {
      SHORT: "The garment MUST have short/half sleeves as seen in the source.",
      LONG: "The garment MUST have long/full sleeves as seen in the source.",
      NONE: "The garment MUST be sleeveless."
    }[detectedSleeve as 'SHORT' | 'LONG' | 'NONE'] || "";

    const systemInstruction = `
      [SYNTHESIS_PHASE: VIRTUAL_TRY_ON_DESIGNER]
      
      MANDATORY CONSTRAINTS:
      1. POSTURE LOCK: The user's posture, pose, and body position must remain EXACTLY identical to the original image. Do not move arms, shoulders, head, or torso. Do not rotate or bend the body.
      2. UN-TUCKED POLICY: The top garment must hang OUTSIDE of the pants or skirt. The hem must sit over the waistband. DO NOT tuck the shirt in.
      3. SLEEVE LOCK: ${sleeveRule}
      4. SIZE ACCURACY: Fit the garment to the user's detected body size (${selectedSize}). If L, make it look loose and oversized. If S, make it look tight.
      5. IDENTITY PRESERVATION: Keep face, hair, and background 100% original.
      
      Render the garment onto the body landmarks naturally while preserving all pixel data of the person outside the garment area.
    `;

    const parts: any[] = [
      { text: "TARGET_PERSON:" },
      prepareImagePart(personImageBase64)
    ];

    if (shirtImageBase64) parts.push({ text: "SOURCE_TOP:" }, prepareImagePart(shirtImageBase64));
    if (pantImageBase64) parts.push({ text: "SOURCE_BOTTOM:" }, prepareImagePart(pantImageBase64));
    if (dressImageBase64) parts.push({ text: "SOURCE_DRESS:" }, prepareImagePart(dressImageBase64));

    parts.push({ 
      text: `EXECUTION: Apply ${selectedSize} fit. 
      Sleeve type: ${detectedSleeve}. 
      Style: UN-TUCKED. 
      Posture: LOCKED. 
      Manifest: ${technicalDescription}.` 
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: { 
        systemInstruction,
        imageConfig: { aspectRatio: "3:4" }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Virtual Try-On synthesis failed.");
  });
};
