
import os
import json
import base64
import numpy as np
import cv2
from PIL import Image
import io
from google import genai
from google.genai import types
from ultralytics import YOLO

# Initialize CV Models
try:
    yolo_model = YOLO('yolov8n.pt')
except Exception as e:
    print(f"YOLO Initialization Warning: {e}")
    yolo_model = None

# MediaPipe for skeletal telemetry (optional, depends on version/support)
try:
    import mediapipe as mp  # type: ignore

    mp_pose = mp.solutions.pose  # type: ignore[attr-defined]
    pose_engine = mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5)
except Exception as e:
    print(f"MediaPipe Initialization Warning: {e}")
    mp_pose = None
    pose_engine = None

def _load_api_key_from_env_files() -> str | None:
    """
    Best-effort loader for local environment files.
    Checks `.env.local` in the project root for GEMINI_API_KEY if
    it is not already present in the OS environment.
    """
    if os.environ.get("GEMINI_API_KEY") or os.environ.get("API_KEY"):
        return os.environ.get("GEMINI_API_KEY") or os.environ.get("API_KEY")

    # Try reading from .env.local next to this file's parent directory
    project_root = os.path.dirname(os.path.dirname(__file__))
    env_path = os.path.join(project_root, ".env.local")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if line.startswith("GEMINI_API_KEY=") or line.startswith("VITE_GEMINI_API_KEY="):
                        value = line.split("=", 1)[1].strip()
                        # Basic strip of surrounding quotes if present
                        if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
                            value = value[1:-1]
                        return value
        except Exception as e:
            print(f".env.local read warning: {e}")

    return None


def get_client():
    api_key = _load_api_key_from_env_files()
    if not api_key:
        raise KeyError("Missing Gemini API key. Set 'GEMINI_API_KEY' or 'API_KEY' in your environment or .env.local.")
    return genai.Client(api_key=api_key)

def process_cv_grounding(image_b64):
    """
    Uses YOLOv8 and MediaPipe to extract high-precision spatial data.
    """
    img_bytes = base64.b64decode(image_b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return {"person_detected": False, "landmarks": {}, "spatial_hints": "IMAGE_DECODE_ERROR"}
    
    cv_telemetry = {
        "person_detected": False,
        "landmarks": {},
        "spatial_hints": ""
    }

    # 1. YOLOv8 Person Detection
    if yolo_model:
        results = yolo_model(img, classes=[0], verbose=False)
        if len(results) > 0 and len(results[0].boxes) > 0:
            cv_telemetry["person_detected"] = True
            box = results[0].boxes[0].xyxyn[0].tolist()
            box = [round(x, 3) for x in box]
            cv_telemetry["spatial_hints"] += f"SUBJECT_BOX: {box}. "

    # 2. MediaPipe Pose Estimation (if available)
    if pose_engine and mp_pose:
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pose_results = pose_engine.process(img_rgb)

        if getattr(pose_results, "pose_landmarks", None):
            lm = pose_results.pose_landmarks.landmark
            critical_points = {
                "L_Shoulder": [round(lm[mp_pose.PoseLandmark.LEFT_SHOULDER].x, 3), round(lm[mp_pose.PoseLandmark.LEFT_SHOULDER].y, 3)],
                "R_Shoulder": [round(lm[mp_pose.PoseLandmark.RIGHT_SHOULDER].x, 3), round(lm[mp_pose.PoseLandmark.RIGHT_SHOULDER].y, 3)],
                "L_Hip": [round(lm[mp_pose.PoseLandmark.LEFT_HIP].x, 3), round(lm[mp_pose.PoseLandmark.LEFT_HIP].y, 3)],
                "R_Hip": [round(lm[mp_pose.PoseLandmark.RIGHT_HIP].x, 3), round(lm[mp_pose.PoseLandmark.RIGHT_HIP].y, 3)],
            }
            cv_telemetry["landmarks"] = critical_points
            cv_telemetry["spatial_hints"] += f"SKELETON_MAP: {json.dumps(critical_points)}. "

    return cv_telemetry

def analyze_try_on(person_b64, top_b64, bottom_b64, dress_b64, gender):
    client = get_client()
    cv_data = process_cv_grounding(person_b64)
    
    prompt = f"""
    Act as a Neural Fashion Analysis Engine for High-Fidelity Try-On. 
    CV TELEMETRY: {cv_data['spatial_hints']}

    TASK: Perform a "Visual Anchor" analysis of the reference garments.
    - Identify EXACT logos, unique textures, and patterns.
    - Create a manifest to ensure PIXEL-PERFECT preservation of these assets.
    - Map garment landmarks to the SKELETON_MAP provided.
    - MUST NOT hallucinate generic designs.
    """
    
    contents = [
        types.Part.from_text(text=prompt),
        types.Part.from_text(text="TARGET_PERSON:"),
        types.Part.from_bytes(data=base64.b64decode(person_b64), mime_type="image/jpeg")
    ]
    
    if top_b64:
        contents.append(types.Part.from_text(text="SOURCE_TOP (Exact design source):"))
        contents.append(types.Part.from_bytes(data=base64.b64decode(top_b64), mime_type="image/jpeg"))
    if bottom_b64:
        contents.append(types.Part.from_text(text="SOURCE_BOTTOM (Exact texture source):"))
        contents.append(types.Part.from_bytes(data=base64.b64decode(bottom_b64), mime_type="image/jpeg"))
    if dress_b64:
        contents.append(types.Part.from_text(text="SOURCE_DRESS (Exact pattern source):"))
        contents.append(types.Part.from_bytes(data=base64.b64decode(dress_b64), mime_type="image/jpeg"))

    response = client.models.generate_content(
        model='gemini-3-flash-preview',
        contents=contents,
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
            response_schema={
                "type": "OBJECT",
                "properties": {
                    "garmentDescription": {"type": "STRING"},
                    "personDescription": {"type": "STRING"},
                    "bodySize": {"type": "STRING"},
                    "technicalPrompt": {"type": "STRING"},
                    "stylingSuggestions": {
                        "type": "OBJECT",
                        "properties": {
                            "suggestedPants": {"type": "STRING"},
                            "suggestedShoes": {"type": "STRING"},
                            "suggestedShirt": {"type": "STRING"},
                            "styleVibe": {"type": "STRING"}
                        }
                    }
                },
                "required": ["garmentDescription", "personDescription", "bodySize", "technicalPrompt", "stylingSuggestions"]
            }
        )
    )
    result = json.loads(response.text)
    result["cv_telemetry"] = cv_data
    return result

def generate_virtual_try_on_image(person_b64, top_b64, bottom_b64, dress_b64, technical_prompt, body_size, gender):
    client = get_client()
    cv_data = process_cv_grounding(person_b64)
    
    prompt = f"""
    MANDATORY PIXEL-PERFECT RENDER.
    GROUNDING_DATA: {cv_data['spatial_hints']}
    MANIFEST: {technical_prompt}

    INSTRUCTIONS:
    1. Transfer the colors, textures, and EXACT logos from SOURCE images onto the TARGET_PERSON.
    2. DO NOT change the garment design. No generic replacements allowed.
    3. Keep the face, hair, and original environment of TARGET_PERSON exactly as provided.
    4. Drape fabrics according to the SKELETON_MAP points.
    """
    
    contents = [
        types.Part.from_text(text=prompt),
        types.Part.from_text(text="TARGET_PERSON:"),
        types.Part.from_bytes(data=base64.b64decode(person_b64), mime_type="image/jpeg")
    ]
    
    if top_b64:
        contents.append(types.Part.from_text(text="SOURCE_TOP (Preserve this exact logo):"))
        contents.append(types.Part.from_bytes(data=base64.b64decode(top_b64), mime_type="image/jpeg"))
    if bottom_b64:
        contents.append(types.Part.from_text(text="SOURCE_BOTTOM (Preserve this exact fabric):"))
        contents.append(types.Part.from_bytes(data=base64.b64decode(bottom_b64), mime_type="image/jpeg"))
    if dress_b64:
        contents.append(types.Part.from_text(text="SOURCE_DRESS (Preserve this exact pattern):"))
        contents.append(types.Part.from_bytes(data=base64.b64decode(dress_b64), mime_type="image/jpeg"))

    response = client.models.generate_content(
        model='gemini-2.5-flash-image',
        contents=contents
    )
    
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            return f"data:{part.inline_data.mime_type};base64,{base64.b64encode(part.inline_data.data).decode()}"
    return None
