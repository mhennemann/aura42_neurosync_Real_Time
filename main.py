import os
from threading import Thread
from flask import Flask, request, jsonify, Response
from datetime import datetime
import json
import traceback
import time
import warnings
warnings.simplefilter("ignore")

os.environ["CUDA_VISIBLE_DEVICES"] = "0"  # choose which GPU to use, 0 is main.

import torch
from models.neurosync.config import config
from utils.utils_emb import process_embedding
from utils.utils_audio import process_transcription, process_blendshapes, generate_speech_segment_tts
from utils.utils_image import process_image, process_clip, process_pdf_imagery

from utils.model_loader import load_audio_models, load_embedding_model, load_image_models, load_tts_model

LOG_FILE_PATH = "log"
os.makedirs(LOG_FILE_PATH, exist_ok=True)

# -----------------------------------------------------------
# Global flags to enable/disable features (New additions)
# -----------------------------------------------------------
ENABLE_TIMING = False  # Set to False to disable timing of endpoints
ENABLE_AUDIO_ENDPOINTS = True  # Set to False to disable audio endpoints
ENABLE_IMAGE_ENDPOINTS = False  # Set to False to disable image endpoints
ENABLE_TTS_ENDPOINTS = True    # Set to False to disable TTS endpoints
ENABLE_EMBEDDING_ENDPOINTS = False  # Set to False to disable embedding endpoints

def log_event(event_type, status, details=None):
    """Logs events such as transcriptions, embeddings, and blendshape generations."""
    log_entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "event_type": event_type,
        "status": status,
        "details": details
    }
    log_file = os.path.join(LOG_FILE_PATH, "app_log.jsonl")
    with open(log_file, "a") as file:
        file.write(json.dumps(log_entry) + "\n")

# -----------------------------------------------------------
# Decorator to time endpoint functions (modified to check flag)
# -----------------------------------------------------------
def time_endpoint(func):
    def wrapper(*args, **kwargs):
        if not ENABLE_TIMING:
            return func(*args, **kwargs)
        start_time = time.time()
        result = func(*args, **kwargs)
        elapsed_time = time.time() - start_time
        print(f"Time taken for {func.__name__}: {elapsed_time:.2f} seconds")
        return result
    wrapper.__name__ = func.__name__
    return wrapper

# 🆕 EMOTION MODIFICATION FUNCTION
def apply_emotion_to_blendshapes(blendshapes_list, emotion, intensity):
    """
    Modifies blendshapes by adding emotion coefficients to the existing facial animation.
    Uses the native NeuroSync approach with additive blendshape modification.
    """
    
    # Define emotion mappings (adjust these values based on your model)
    emotion_mappings = {
        'happy': {
            'MouthSmileLeft': 0.8 * intensity,      # Strong smile
            'MouthSmileRight': 0.8 * intensity,
            'CheekSquintLeft': 0.6 * intensity,     # Raised cheeks
            'CheekSquintRight': 0.6 * intensity,
            'EyeSquintLeft': 0.4 * intensity,       # Squinted eyes (joy)
            'EyeSquintRight': 0.4 * intensity
        },
        'sad': {
            'MouthFrownLeft': 0.7 * intensity,      # Downturned mouth
            'MouthFrownRight': 0.7 * intensity,
            'BrowDownLeft': 0.5 * intensity,        # Lowered brows
            'BrowDownRight': 0.5 * intensity,
            'BrowInnerUp': 0.4 * intensity          # Sad brow expression
        },
        'angry': {
            'BrowDownLeft': 0.8 * intensity,        # Furrowed brow
            'BrowDownRight': 0.8 * intensity,
            'EyeSquintLeft': 0.6 * intensity,       # Narrowed eyes
            'EyeSquintRight': 0.6 * intensity,
            'MouthPressLeft': 0.5 * intensity,      # Pressed lips
            'MouthPressRight': 0.5 * intensity
        },
        'surprised': {
            'EyeWideLeft': 0.9 * intensity,         # Wide open eyes
            'EyeWideRight': 0.9 * intensity,
            'BrowOuterUpLeft': 0.7 * intensity,     # Raised eyebrows
            'BrowOuterUpRight': 0.7 * intensity,
            'JawOpen': 0.3 * intensity              # Slightly open mouth
        },
        'glücklich': {  # German version
            'MouthSmileLeft': 0.8 * intensity,
            'MouthSmileRight': 0.8 * intensity,
            'CheekSquintLeft': 0.6 * intensity,
            'CheekSquintRight': 0.6 * intensity,
            'EyeSquintLeft': 0.4 * intensity,
            'EyeSquintRight': 0.4 * intensity
        },
        'traurig': {  # German version
            'MouthFrownLeft': 0.7 * intensity,
            'MouthFrownRight': 0.7 * intensity,
            'BrowDownLeft': 0.5 * intensity,
            'BrowDownRight': 0.5 * intensity,
            'BrowInnerUp': 0.4 * intensity
        },
        'überrascht': {  # German version
            'EyeWideLeft': 0.9 * intensity,
            'EyeWideRight': 0.9 * intensity,
            'BrowOuterUpLeft': 0.7 * intensity,
            'BrowOuterUpRight': 0.7 * intensity,
            'JawOpen': 0.3 * intensity
        },
        'extrem': {  # Extreme emotion for testing
            'MouthSmileLeft': 1.0 * intensity,
            'MouthSmileRight': 1.0 * intensity,
            'CheekSquintLeft': 0.8 * intensity,
            'CheekSquintRight': 0.8 * intensity,
            'EyeSquintLeft': 0.7 * intensity,
            'EyeSquintRight': 0.7 * intensity,
            'JawOpen': 0.4 * intensity,
            'BrowOuterUpLeft': 0.6 * intensity,
            'BrowOuterUpRight': 0.6 * intensity
        }
    }
    
    # ARKit blendshape name to index mapping
    arkit_to_index = {
        'EyeBlinkLeft': 0, 'EyeLookDownLeft': 1, 'EyeLookInLeft': 2, 'EyeLookOutLeft': 3,
        'EyeLookUpLeft': 4, 'EyeSquintLeft': 5, 'EyeWideLeft': 6, 'EyeBlinkRight': 7,
        'EyeLookDownRight': 8, 'EyeLookInRight': 9, 'EyeLookOutRight': 10, 'EyeLookUpRight': 11,
        'EyeSquintRight': 12, 'EyeWideRight': 13, 'JawForward': 14, 'JawRight': 15,
        'JawLeft': 16, 'JawOpen': 17, 'MouthClose': 18, 'MouthFunnel': 19,
        'MouthPucker': 20, 'MouthRight': 21, 'MouthLeft': 22, 'MouthSmileLeft': 23,
        'MouthSmileRight': 24, 'MouthFrownLeft': 25, 'MouthFrownRight': 26, 'MouthDimpleLeft': 27,
        'MouthDimpleRight': 28, 'MouthStretchLeft': 29, 'MouthStretchRight': 30, 'MouthRollLower': 31,
        'MouthRollUpper': 32, 'MouthShrugLower': 33, 'MouthShrugUpper': 34, 'MouthPressLeft': 35,
        'MouthPressRight': 36, 'MouthLowerDownLeft': 37, 'MouthLowerDownRight': 38, 'MouthUpperUpLeft': 39,
        'MouthUpperUpRight': 40, 'BrowDownLeft': 41, 'BrowDownRight': 42, 'BrowInnerUp': 43,
        'BrowOuterUpLeft': 44, 'BrowOuterUpRight': 45, 'CheekPuff': 46, 'CheekSquintLeft': 47,
        'CheekSquintRight': 48, 'NoseSneerLeft': 49, 'NoseSneerRight': 50, 'TongueOut': 51,
        'HeadYaw': 52, 'HeadPitch': 53, 'HeadRoll': 54, 'LeftEyeYaw': 55,
        'LeftEyePitch': 56, 'LeftEyeRoll': 57, 'RightEyeYaw': 58, 'RightEyePitch': 59, 'RightEyeRoll': 60
    }
    
    emotion_key = emotion.lower() if emotion else None
    if emotion_key not in emotion_mappings:
        print(f"⚠️ Unknown emotion: {emotion}")
        return blendshapes_list
    
    emotion_coefficients = emotion_mappings[emotion_key]
    modified_blendshapes = []
    
    for frame in blendshapes_list:
        # Copy the original frame
        modified_frame = frame.copy() if isinstance(frame, list) else list(frame)
        
        # Ensure frame has at least 61 values
        while len(modified_frame) < 61:
            modified_frame.append(0.0)
        
        # Apply emotion coefficients additively
        for arkit_name, emotion_value in emotion_coefficients.items():
            if arkit_name in arkit_to_index:
                index = arkit_to_index[arkit_name]
                if index < len(modified_frame):
                    # Add emotion value to existing blendshape (clamped to [0, 1])
                    original_value = float(modified_frame[index]) if modified_frame[index] is not None else 0.0
                    new_value = original_value + emotion_value
                    modified_frame[index] = min(1.0, max(0.0, new_value))
        
        modified_blendshapes.append(modified_frame)
    
    return modified_blendshapes

device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype_audio = torch.bfloat16 if torch.cuda.is_available() else torch.float32
torch_dtype_image = torch.float16 if torch.cuda.is_available() else torch.float32

# ============================================================
# Load Models Using model_loader.py (Modified to load models conditionally)
# ============================================================

# Audio models are needed by both audio and TTS endpoints.
if ENABLE_AUDIO_ENDPOINTS or ENABLE_TTS_ENDPOINTS:
    audio_models = load_audio_models()  # New addition: conditionally load audio models
    transgenerator = audio_models["transgenerator"]
    blendshape_model = audio_models["blendshape_model"]
else:
    audio_models = None
    transgenerator = None
    blendshape_model = None

# Embedding model is needed for the embedding endpoints.
if ENABLE_EMBEDDING_ENDPOINTS:
    embmodel = load_embedding_model()  # New addition: conditionally load embedding model
else:
    embmodel = None

# Image models are needed for image endpoints.
if ENABLE_IMAGE_ENDPOINTS:
    image_models = load_image_models()  # New addition: conditionally load image models
    blip_processor = image_models["blip_processor"]
    blip_model = image_models["blip_model"]
    clip_processor = image_models["clip_processor"]
    clip_model = image_models["clip_model"]
    vilt_processor = image_models["vilt_processor"]
    vilt_model = image_models["vilt_model"]
else:
    image_models = None
    blip_processor = None
    blip_model = None
    clip_processor = None
    clip_model = None
    vilt_processor = None
    vilt_model = None

# TTS model is needed for TTS endpoints.
if ENABLE_TTS_ENDPOINTS:
    tts_models = load_tts_model()  # New addition: conditionally load TTS model
else:
    tts_models = None

# ------------------- Audio API (Port 6969) -------------------
app_audio = Flask("audio_app")

if ENABLE_AUDIO_ENDPOINTS:
    @app_audio.route("/transcribe", methods=["POST"])
    @time_endpoint
    def transcribe_audio():
        try:
            audio_base64 = request.json.get('audio_base64')
            if not audio_base64:
                log_event("transcription", "failure", "No audio data provided.")
                return jsonify({"status": "error", "message": "No audio data provided."}), 400

            return_timestamps = request.json.get('return_timestamps', False)
            result = process_transcription(audio_base64, return_timestamps, transgenerator)
            log_event("transcription", "success", result)
            return jsonify(result)
        except Exception as e:
            err_msg = str(e)
            log_event("transcription", "failure", err_msg)
            return jsonify({"status": "error", "message": err_msg}), 500

    @app_audio.route('/audio_to_blendshapes', methods=['POST'])
    @time_endpoint
    def audio_to_blendshapes_route():
        try:
            audio_bytes = request.data
            if not audio_bytes:
                msg = "No audio data provided."
                log_event("blendshapes", "failure", msg)
                return jsonify({"status": "error", "message": msg}), 400
            result = process_blendshapes(audio_bytes, blendshape_model, device, config)
            log_event("blendshapes", "success", "Blendshapes generated successfully.")
            return jsonify(result)
        except Exception as e:
            err_msg = str(e)
            print("Exception occurred:", err_msg)
            print(traceback.format_exc())
            log_event("blendshapes", "failure", err_msg)
            return jsonify({"status": "error", "message": err_msg}), 500
else:
    print("Audio endpoints are disabled.")

# ------------------- Image API (Port 1234) -------------------
app_image = Flask("image_app")

if ENABLE_IMAGE_ENDPOINTS:
    @app_image.route("/process_image", methods=["POST"])
    @time_endpoint
    def route_process_image():
        try:
            data = request.data.decode("utf-8")
            result = process_image(data, blip_processor, blip_model, clip_processor, clip_model, vilt_processor, vilt_model, device)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app_image.route("/process_clip", methods=["POST"])
    @time_endpoint
    def route_process_clip():
        try:
            data = request.data.decode("utf-8")
            result = process_clip(data, clip_processor, clip_model, device)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400

    @app_image.route("/process_pdf_imagery", methods=["POST"])
    @time_endpoint
    def route_process_pdf_imagery():
        try:
            data = request.data.decode("utf-8")
            result = process_pdf_imagery(data, blip_processor, blip_model, clip_processor, clip_model, vilt_processor, vilt_model, device)
            return jsonify(result)
        except Exception as e:
            return jsonify({"error": str(e)}), 400
else:
    print("Image endpoints are disabled.")

# ------------------- TTS API (Port 8000) -------------------
app_tts = Flask("tts_app")

if ENABLE_TTS_ENDPOINTS:
    @app_tts.route('/generate_speech', methods=['POST'])
    @time_endpoint
    def generate_speech_tts_endpoint():
        """
        Endpoint for generating speech using the TTS engine.
        """
        data = request.json
        text = data.get('text', '')
        # NEW: Allow the voice to be optionally specified in the request
        voice = data.get('voice', 'af_heart')
        result = generate_speech_segment_tts(text, tts_models["tts_pipeline"], tts_models["tts_lock"], voice=voice)
        if result is None:
            print("TTS engine failed to generate audio.")
            return jsonify({"error": "Failed to generate audio with TTS engine"}), 500
        else:
            return result, 200, {'Content-Type': 'audio/wav'}

    @app_tts.route("/synthesize_and_blendshapes", methods=["POST"])
    @time_endpoint
    def synthesize_and_blendshapes():
        try:
            data = request.json
            text = data.get("text", "").strip()
            if not text:
                log_event("synthesize_and_blendshapes", "failure", "No text data provided.")
                return jsonify({"status": "error", "message": "No text data provided."}), 400

            # EXISTING: Voice parameter
            voice = data.get("voice", "af_heart")
            
            # 🆕 NEW: Emotion parameters
            emotion = data.get("emotion", None)  # e.g., "happy", "sad", "angry", "glücklich", "traurig"
            emotion_intensity = data.get("emotion_intensity", 1.0)  # 0.0 to 1.0
            
            print(f"🎭 NeuroSync Request: text='{text[:50]}...', voice={voice}, emotion={emotion}, intensity={emotion_intensity}")

            # Generate audio
            audio_bytes = generate_speech_segment_tts(text, tts_models["tts_pipeline"], tts_models["tts_lock"], voice=voice)
            if audio_bytes is None:
                log_event("synthesize_and_blendshapes", "failure", "Failed to generate speech with TTS engine.")
                return jsonify({"status": "error", "message": "Failed to generate speech with TTS engine."}), 500

            # Generate blendshapes
            blendshapes_result = process_blendshapes(audio_bytes, blendshape_model, device, config)
            blendshapes_list = blendshapes_result.get("blendshapes", [])
            
            # 🆕 APPLY EMOTION MODIFICATION
            if emotion and emotion_intensity > 0:
                original_count = len(blendshapes_list)
                blendshapes_list = apply_emotion_to_blendshapes(blendshapes_list, emotion, emotion_intensity)
                print(f"🎭 Emotion '{emotion}' (intensity {emotion_intensity}) applied to {original_count} frames")
                log_event("emotion_application", "success", f"Applied {emotion} with intensity {emotion_intensity} to {original_count} frames")

            # Create multipart response
            boundary = "MY_BOUNDARY_STRING"

            part1 = (
                f"--{boundary}\r\n"
                "Content-Type: audio/wav\r\n"
                "Content-Disposition: attachment; filename=\"output.wav\"\r\n"
                "\r\n"
            ).encode('utf-8') + audio_bytes + "\r\n".encode('utf-8')
            
            part2_json = json.dumps(blendshapes_list).encode('utf-8')
            part2 = (
                f"--{boundary}\r\n"
                "Content-Type: application/json\r\n"
                "Content-Disposition: inline\r\n"
                "\r\n"
            ).encode('utf-8') + part2_json + "\r\n".encode('utf-8')

            closing_boundary = f"--{boundary}--\r\n".encode('utf-8')
            multipart_body = part1 + part2 + closing_boundary

            response = Response(multipart_body, status=200)
            response.headers["Content-Type"] = f"multipart/mixed; boundary={boundary}"
            
            success_msg = f"Speech and blendshapes generated successfully"
            if emotion:
                success_msg += f" with emotion: {emotion} (intensity: {emotion_intensity})"
            
            log_event("synthesize_and_blendshapes", "success", success_msg)
            return response
            
        except Exception as e:
            err_msg = str(e)
            print(f"❌ Error in synthesize_and_blendshapes: {err_msg}")
            print(traceback.format_exc())
            log_event("synthesize_and_blendshapes", "failure", err_msg)
            return jsonify({"status": "error", "message": err_msg}), 500

    # 🆕 NEW: Health check endpoint
    @app_tts.route("/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "NeuroSync TTS with Emotion Support",
            "endpoints": [
                "/generate_speech",
                "/synthesize_and_blendshapes"
            ],
            "emotion_support": {
                "enabled": True,
                "supported_emotions": ["happy", "sad", "angry", "surprised", "glücklich", "traurig", "überrascht", "extrem"],
                "intensity_range": "0.0 - 1.0"
            }
        })

else:
    print("TTS endpoints are disabled.")

# ------------------- Embedding API (Port 7070) -------------------
app_embedding = Flask("embedding_app")

if ENABLE_EMBEDDING_ENDPOINTS:
    @app_embedding.route('/get_embedding', methods=['POST'])
    @time_endpoint
    def get_embedding():
        try:
            data = request.json
            if not data or 'text' not in data:
                log_event("embedding", "failure", "No text data provided.")
                return jsonify({"status": "error", "message": "No text data provided."}), 400
            text = data['text']
            result = process_embedding(text, embmodel)
            log_event("embedding", "success", f"Generated embedding for text: {text}")
            return jsonify(result)
        except Exception as e:
            err_msg = str(e)
            log_event("embedding", "failure", err_msg)
            return jsonify({"status": "error", "message": err_msg}), 500
else:
    print("Embedding endpoints are disabled.")

# ------------------- Run All Flask Apps -------------------
if __name__ == '__main__':
    threads = []

    if ENABLE_AUDIO_ENDPOINTS:
        def run_audio_app():
            print("Starting Audio App on port 6969...")
            app_audio.run(host='0.0.0.0', port=6969, debug=False)
        t_audio = Thread(target=run_audio_app)
        threads.append(t_audio)

    if ENABLE_IMAGE_ENDPOINTS:
        def run_image_app():
            print("Starting Image App on port 1234...")
            app_image.run(host='0.0.0.0', port=1234, debug=False)
        t_image = Thread(target=run_image_app)
        threads.append(t_image)

    if ENABLE_TTS_ENDPOINTS:
        def run_tts_app():
            print("🚀 Starting NeuroSync TTS App with Emotion Support on port 8000...")
            print("🎭 Supported emotions: happy, sad, angry, surprised, glücklich, traurig, überrascht, extrem")
            app_tts.run(host='0.0.0.0', port=8000, debug=False)
        t_tts = Thread(target=run_tts_app)
        threads.append(t_tts)

    if ENABLE_EMBEDDING_ENDPOINTS:
        def run_embedding_app():
            print("Starting Embedding App on port 7070...")
            app_embedding.run(host='0.0.0.0', port=7070, debug=False)
        t_embedding = Thread(target=run_embedding_app)
        threads.append(t_embedding)

    # Start all enabled threads
    for t in threads:
        t.start()

    # Wait for all threads to complete
    for t in threads:
        t.join()