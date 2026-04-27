
import { Client } from "@gradio/client";

const HF_SPACE = "yisol/IDM-VTON";

/**
 * Convert a base64 data URL to a Blob suitable for Gradio upload.
 */
function base64ToBlob(base64DataUrl: string): Blob {
    const parts = base64DataUrl.split(",");
    const mime = parts[0]?.match(/:(.*?);/)?.[1] || "image/jpeg";
    const raw = atob(parts.length > 1 ? parts[1] : parts[0]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

/**
 * Call the IDM-VTON HuggingFace Space for a high-fidelity virtual try-on.
 *
 * Only supports a single upper-body garment (shirt/top).
 * Returns a base64 data URL of the result image.
 */
export async function generateIdmVtonTryOn(
    personImageBase64: string,
    garmentImageBase64: string,
    garmentDescription: string = ""
): Promise<string> {
    const hfToken = import.meta.env.VITE_HUGGINGFACE_API_KEY;

    const client = await Client.connect(HF_SPACE, {
        hf_token: hfToken,
    } as any);

    // Upload person image as background for the ImageEditor component
    const personBlob = base64ToBlob(personImageBase64);
    const garmentBlob = base64ToBlob(garmentImageBase64);

    const result = await client.predict("/tryon", {
        dict: { background: personBlob, layers: [], composite: null },
        garm_img: garmentBlob,
        garment_des: garmentDescription,
        is_checked: true,       // auto-masking enabled
        is_checked_crop: false,  // don't auto-crop
        denoise_steps: 30,
        seed: 42,
    });

    // result.data is [outputImage, maskedImage]
    const data = result.data as any[];
    const outputImage = data[0];

    // The Gradio client returns a FileData object with a url property
    if (outputImage?.url) {
        const response = await fetch(outputImage.url);
        const blob = await response.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    throw new Error("IDM-VTON did not return an output image.");
}
