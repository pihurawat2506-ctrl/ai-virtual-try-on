import { GoogleGenAI, Modality } from '@google/genai';
import { Base64File } from '../utils/fileUtils';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

type FitAdjustment = 'default' | 'tighter' | 'looser';

export const dressModel = async (
  modelImage: Base64File, 
  clothingImage: Base64File, 
  fit: FitAdjustment = 'default',
  backgroundPrompt: string = ''
): Promise<string> => {
  try {
    const model = 'gemini-2.5-flash-image';

    let fitInstruction = '';
    if (fit === 'tighter') {
      fitInstruction = "The clothing should be adjusted to have a tighter, more form-fitting appearance on the model.";
    } else if (fit === 'looser') {
      fitInstruction = "The clothing should be adjusted to have a looser, more relaxed, and comfortable fit on the model.";
    }

    let backgroundInstruction = "The original background from the first image must be preserved perfectly.";
    if (backgroundPrompt && backgroundPrompt.trim().length > 0) {
        backgroundInstruction = `The original background must be replaced with a new one described as: "${backgroundPrompt}". The new background should be photorealistic and blend seamlessly with the model.`;
    }


    const prompt = `
      You are an expert photorealistic virtual stylist. Your primary goal is to create a final image that is indistinguishable from a real photograph.

      Your task is to seamlessly dress the person from the first image (the model) with the clothes from the second image (the outfit).

      **Core Instructions:**
      1.  **Preserve Realism:** The final output **must** look like a real photograph, not an AI generation. Avoid any "airbrushed" or overly smooth AI look.
      2.  **Model & Background Integrity:** The person's pose, facial expression, body shape, and skin tone from the first image must be preserved perfectly. Do not alter the model in any way. ${backgroundInstruction}
      3.  **Outfit Integration:**
          *   Identify the complete outfit from the second image.
          *   Realistically transfer this outfit onto the person in the first image.
          *   **Crucially, the clothing must conform naturally to the person's body and pose.** Pay close attention to how fabric would drape, fold, and crease in reality.
          *   ${fitInstruction}
      4.  **Lighting and Shadows:** The lighting on the new clothes (shadows, highlights) must perfectly match the lighting conditions of the original model's photo and the new background (if any). This is key to making the image look real.
      5.  **Texture and Detail:** Maintain the original texture and details of the fabric from the clothing image.
      6.  **Seamless Edges:** Ensure the edges where the clothing meets the person's skin or the background are clean and perfectly blended.
      7.  **Final Output:** The result must be a high-quality, photorealistic image with no added text, watermarks, or any other artifacts.
    `;

    const modelImagePart = {
      inlineData: {
        data: modelImage.base64,
        mimeType: modelImage.mimeType,
      },
    };

    const clothingImagePart = {
      inlineData: {
        data: clothingImage.base64,
        mimeType: clothingImage.mimeType,
      },
    };

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [modelImagePart, clothingImagePart, textPart],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });
    
    // Find the image part in the response
    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    
    if (imagePart && imagePart.inlineData) {
      return imagePart.inlineData.data;
    } else {
      throw new Error('AI failed to generate an image. Please try again with different images.');
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error('Failed to generate image from AI. The model may have refused to process the request. Check your images and try again.');
  }
};

export const changeBackground = async (
  sourceImage: Base64File,
  backgroundPrompt: string,
  backgroundImage: Base64File | null = null
): Promise<string> => {
    if ((!backgroundPrompt || backgroundPrompt.trim().length === 0) && !backgroundImage) {
        throw new Error("A background description or a background image is required.");
    }
    try {
        const model = 'gemini-2.5-flash-image';
        
        const parts: ( { inlineData: { data: string, mimeType: string } } | { text: string } )[] = [];
        let prompt: string;

        // Add the source image first
        parts.push({
            inlineData: {
                data: sourceImage.base64,
                mimeType: sourceImage.mimeType,
            },
        });

        if (backgroundImage) {
            // Case 1: A background image is provided
            parts.push({
                inlineData: {
                    data: backgroundImage.base64,
                    mimeType: backgroundImage.mimeType,
                },
            });

            prompt = `
                You are a photorealistic image editing expert. Your goal is to create a final image that is indistinguishable from a real photograph.

                Your task is to replace the background of the first image (the source) with the second image (the new background).

                **Core Instructions:**
                1.  **Preserve Subject:** The main subject (person, object, animal) in the foreground of the source image **must be perfectly preserved**. Do not alter its appearance, pose, lighting, or details in any way.
                2.  **Use New Background:** Use the second image as the new background for the subject from the first image.
                3.  **Seamless Integration:** The new background must blend seamlessly with the foreground subject. The lighting, shadows, and perspective of the new background must be adjusted to perfectly match the original subject to create a cohesive and realistic final image.
                4.  **Additional Instructions:** ${backgroundPrompt ? `Follow these additional user instructions for blending: "${backgroundPrompt}"` : 'Ensure the composition is natural and believable.'}
                5.  **Clean Edges:** Ensure the edges around the subject are clean and natural, with no "cut-out" or artificial look. Pay special attention to hair or fine details.
                6.  **Final Output:** The result must be a high-quality, photorealistic image with no added text, watermarks, or any other artifacts.
            `;
        } else {
            // Case 2: Only a text prompt is provided
             prompt = `
                You are a photorealistic image editing expert. Your goal is to create a final image that is indistinguishable from a real photograph.

                Your task is to replace the background of the provided image with a new one based on the user's description, while leaving the foreground subject completely untouched.

                **Core Instructions:**
                1.  **Preserve Subject:** The main subject (person, object, animal) in the foreground of the image **must be perfectly preserved**. Do not alter its appearance, pose, lighting, or details in any way.
                2.  **Identify Background:** Accurately identify and isolate the entire background from the foreground subject.
                3.  **Generate New Background:** Generate a new, photorealistic background based on this description: "${backgroundPrompt}".
                4.  **Seamless Integration:** The new background must blend seamlessly with the foreground subject. The lighting, shadows, and perspective of the new background must perfectly match the original subject to create a cohesive and realistic final image.
                5.  **Clean Edges:** Ensure the edges around the subject are clean and natural, with no "cut-out" or artificial look. Pay special attention to hair or fine details.
                6.  **Final Output:** The result must be a high-quality, photorealistic image with no added text, watermarks, or any other artifacts.
            `;
        }

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: model,
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart && imagePart.inlineData) {
            return imagePart.inlineData.data;
        } else {
            throw new Error('AI failed to generate an image. Please try again with a different image or prompt.');
        }

    } catch (error) {
        console.error('Error calling Gemini API for background change:', error);
        throw new Error('Failed to change background from AI. The model may have refused to process the request. Check your image and try again.');
    }
};
