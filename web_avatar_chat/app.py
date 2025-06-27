from flask import Flask, render_template, request, jsonify, Response
import requests
import os
import base64
import openai
import sys

app = Flask(__name__)

# NeuroSync Server URL
NEUROSYNC_SERVER = "http://localhost:8000"
NEUROSYNC_AUDIO_SERVER = "http://localhost:6969"

# OpenAI API Configuration
openai.api_key = "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"

# Voice-Mapping für ElevenLabs (mit Franzi als Standard)
VOICE_MAPPING = {
    'franzi': 'NX39CipaoYitJ3sMwH5I',      # Deutsche Franzi-Stimme
    'bf_isabella': 'EXAVITQu4vr4xnSDxMaL',  # Bella
    'af_heart': '21m00Tcm4TlvDq8ikWAM',     # Rachel
    'default': 'NX39CipaoYitJ3sMwH5I'       # Standard: Franzi
}

# Conversation History (in Produktion: Redis/Database verwenden)
conversation_history = []

# 🆕 PROFESSIONELLES EMOTE-SYSTEM LADEN
sys.path.append('/opt/neurosync/aura42_neurosync_Real_Time/web_avatar_chat/utils/emote_sender')

try:
    from send_emote import EmoteConnect
    EMOTE_SYSTEM_AVAILABLE = True
    print("🎭 Professionelles Emote-System geladen!")
except ImportError as e:
    print(f"⚠️ Emote-System nicht verfügbar: {e}")
    EMOTE_SYSTEM_AVAILABLE = False

def detect_german_emotion_for_csv_system(text):
    """Deutsche Emotion-Detection für professionelles CSV-Animations-System"""
    text_lower = text.lower()
    
    # Mapping zu den vorhandenen Emotion-Ordnern:
    emotion_keywords = {
        'Happy': ['glücklich', 'fröhlich', 'super', 'toll', 'fantastisch', 'genial', 'wunderbar', 'großartig', 'perfekt', 'klasse'],
        'Sad': ['traurig', 'schlecht', 'schlimm', 'deprimiert', 'niedergeschlagen', 'verzweifelt', 'betrübt', 'melancholisch'],
        'Angry': ['wütend', 'sauer', 'ärgerlich', 'genervt', 'frustriert', 'verärgert', 'zornig', 'aufgebracht'],
        'Surprised': ['überrascht', 'erstaunt', 'wow', 'krass', 'unglaublich', 'erstaunlich', 'verblüfft', 'baff'],
        'Fearful': ['angst', 'ängstlich', 'furcht', 'panik', 'besorgt', 'nervös', 'erschrocken', 'beunruhigt'],
        'Disgusted': ['ekel', 'widerlich', 'abscheulich', 'ekelhaft', 'angewidert', 'abstoßend']
    }
    
    # Text nach Emotion-Keywords durchsuchen
    for emotion, keywords in emotion_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            print(f"🎭 Deutsche Emotion erkannt: '{emotion}' für Text: '{text}'")
            return emotion
    
    return None  # Keine spezifische Emotion erkannt

@app.route('/')
def index():
    return render_template('index.html')

def get_chatgpt_response(user_message):
    """Holt intelligente Antwort von ChatGPT"""
    try:
        # Live-Backend Konfiguration verwenden (falls verfügbar)
        live_config = getattr(get_chatgpt_response, 'live_config', {})
        chat_params = live_config.get('chat_parameter', {})
        
        # Standard-Parameter mit Live-Override
        temperature = chat_params.get('temperature', 0.7)
        max_tokens = chat_params.get('max_tokens', 100)
        
        # Conversation History für Kontext
        messages = [
            {
                "role": "system", 
                "content": "Du bist Franzi, ein hilfsreicher KI-Avatar mit NeuroSync-Technologie. Du sprichst Deutsch und antwortest freundlich und hilfreich. Du kannst über Text und Sprache kommunizieren und deine Antworten werden als Audio mit Gesichtsanimation dargestellt. Halte deine Antworten prägnant (max 2-3 Sätze) damit die Audio-Synchronisation gut funktioniert."
            }
        ]
        
        # Letzte 6 Nachrichten für Kontext hinzufügen
        for msg in conversation_history[-6:]:
            messages.append(msg)
        
        # Aktuelle Nachricht hinzufügen
        messages.append({"role": "user", "content": user_message})
        
        print(f"🤖 Sende an ChatGPT: {user_message}")
        print(f"🎛️ Parameter: temp={temperature}, tokens={max_tokens}")
        
        # OpenAI API Call mit Live-Parametern
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=False
        )
        
        ai_response = response.choices[0].message.content.strip()
        print(f"🤖 ChatGPT Antwort: {ai_response}")
        
        # Conversation History aktualisieren
        conversation_history.append({"role": "user", "content": user_message})
        conversation_history.append({"role": "assistant", "content": ai_response})
        
        # Nur letzte 12 Nachrichten behalten (Memory-Management)
        if len(conversation_history) > 12:
            conversation_history.pop(0)
            conversation_history.pop(0)
        
        return ai_response
        
    except Exception as e:
        print(f"❌ ChatGPT Fehler: {e}")
        return f"Entschuldigung, ich kann gerade nicht antworten. Bitte versuchen Sie es erneut."

@app.route('/api/generate_audio_and_blendshapes', methods=['POST'])
def generate_audio_and_blendshapes():
    """Generiert Audio + Blendshapes mit automatischer deutscher Emotion-Detection"""
    try:
        data = request.get_json()
        user_text = data.get('text', '')
        voice = data.get('voice', 'franzi')
        print(f"🎯 User Input: {user_text} (Stimme: {voice})")
        
        # 🆕 AUTOMATISCHE DEUTSCHE EMOTION-DETECTION
        detected_emotion = detect_german_emotion_for_csv_system(user_text)
        
        # ChatGPT Antwort holen
        ai_response = get_chatgpt_response(user_text)
        
        # Voice-ID ermitteln
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        # 🆕 EMOTION AN PROFESSIONELLES EMOTE-SYSTEM SENDEN
        if detected_emotion and EMOTE_SYSTEM_AVAILABLE:
            try:
                print(f"🎭 Sende Emotion an professionelles Emote-System: {detected_emotion}")
                EmoteConnect.send_emote(detected_emotion)
                print(f"✅ Emotion '{detected_emotion}' erfolgreich getriggert!")
            except Exception as e:
                print(f"❌ Emote-System Fehler: {e}")
        
        # Request-Daten für NeuroSync (normale Audio+Blendshapes)
        request_data = {
            "text": ai_response,  # ← ChatGPT Antwort statt User Input!
            "voice": voice_id
        }
        
        # AI-Antwort an NeuroSync senden für Audio+Blendshapes
        response = requests.post(
            f"{NEUROSYNC_SERVER}/synthesize_and_blendshapes",
            json=request_data,
            timeout=30
        )
        
        print(f"✅ NeuroSync Antwort: {response.status_code}")
        
        if response.status_code == 200:
            try:
                from utils.multi_part_return import parse_multipart_response
                audio_bytes, blendshapes_list = parse_multipart_response(response)
                
                print(f"📊 Audio: {len(audio_bytes) if audio_bytes else 0} bytes")
                print(f"🎭 Blendshapes: {len(blendshapes_list) if blendshapes_list else 0} frames")
                
                if blendshapes_list and audio_bytes:
                    # Audio-Dauer berechnen
                    audio_length_seconds = len(audio_bytes) / (22050 * 2)
                    
                    # Audio als Base64 enkodieren
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    
                    # Blendshapes für LiveLink speichern
                    global current_blendshapes
                    current_blendshapes = blendshapes_list
                    
                    print(f"🎬 ChatGPT-Sync vorbereitet: {audio_length_seconds:.1f}s Audio + {len(blendshapes_list)} frames")
                    
                    response_data = {
                        "status": "success",
                        "message": "ChatGPT Antwort für Audio-Sync bereit",
                        "user_text": user_text,
                        "ai_response": ai_response,
                        "voice": voice,
                        "audio_data": audio_base64,
                        "audio_length": audio_length_seconds,
                        "blendshapes_count": len(blendshapes_list),
                        "sync_mode": "chatgpt_audio_sync",
                        "ready_for_sync": True
                    }
                    
                    # 🆕 EMOTION-INFO hinzufügen
                    if detected_emotion:
                        response_data["emotion_detected"] = detected_emotion
                        response_data["emotion_method"] = "professional_csv_animations"
                        response_data["emotion_system"] = "emote_connect"
                    
                    return jsonify(response_data)
                    
            except Exception as e:
                print(f"❌ Multipart parsing error: {e}")
                import traceback
                traceback.print_exc()
            
            return jsonify({
                "status": "error",
                "message": "Keine Audio/Blendshapes Daten erhalten"
            }), 500
        else:
            return jsonify({
                "status": "error",
                "message": f"NeuroSync Fehler: {response.status_code}"
            }), 500
            
    except Exception as e:
        print(f"❌ ChatGPT Integration Fehler: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/trigger_livelink', methods=['POST'])
def trigger_livelink():
    """Browser-gesteuerter LiveLink-Trigger für ChatGPT Antworten"""
    try:
        print("🎭 Browser triggert LiveLink für ChatGPT Antwort...")

        global current_blendshapes
        if 'current_blendshapes' not in globals() or not current_blendshapes:
            return jsonify({"status": "error", "message": "Keine Blendshapes verfügbar"}), 400

        # LiveLink-Code (Emotion läuft parallel über Emote-System)
        from livelink.connect.livelink_init import create_socket_connection, initialize_py_face
        from livelink.send_to_unreal import pre_encode_facial_data, send_pre_encoded_data_to_unreal
        from threading import Event, Thread

        def execute_livelink():
            try:
                py_face = initialize_py_face()
                socket_connection = create_socket_connection()
                encoded_data = pre_encode_facial_data(current_blendshapes, py_face)

                start_event = Event()
                start_event.set()

                print(f"🎭 ChatGPT LiveLink Animation startet für {len(current_blendshapes)} frames...")
                send_pre_encoded_data_to_unreal(encoded_data, start_event, 60, socket_connection)
                print("🎭 ChatGPT LiveLink Animation komplett")

            except Exception as e:
                print(f"❌ ChatGPT LiveLink Fehler: {e}")
                import traceback
                traceback.print_exc()

        animation_thread = Thread(target=execute_livelink)
        animation_thread.start()

        return jsonify({
            "status": "success",
            "message": "ChatGPT LiveLink Animation gestartet",
            "frames": len(current_blendshapes)
        })
        
    except Exception as e:
        print(f"❌ LiveLink Fehler: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

# 🆕 PROFESSIONELLE EMOTION-ROUTES
@app.route('/api/trigger_professional_emotion', methods=['POST'])
def trigger_professional_emotion():
    """Triggert Emotionen über professionelles EmoteConnect-System"""
    try:
        data = request.get_json()
        emotion = data.get('emotion', '')
        
        # Verfügbare Emotionen validieren
        available_emotions = ['Happy', 'Sad', 'Angry', 'Surprised', 'Fearful', 'Disgusted', 'Neutral']
        
        if emotion not in available_emotions:
            return jsonify({
                "status": "error",
                "message": f"Emotion '{emotion}' nicht verfügbar",
                "available_emotions": available_emotions
            }), 400
        
        if not EMOTE_SYSTEM_AVAILABLE:
            return jsonify({
                "status": "error",
                "message": "Emote-System nicht verfügbar"
            }), 500
        
        # Emotion über professionelles System triggern
        EmoteConnect.send_emote(emotion)
        print(f"🎭 Professionelle Emotion getriggert: {emotion}")
        
        return jsonify({
            "status": "success",
            "message": f"Professionelle Emotion '{emotion}' getriggert",
            "emotion": emotion,
            "system": "emote_connect_csv_animations",
            "port": 7777
        })
        
    except Exception as e:
        print(f"❌ Professionelle Emotion Fehler: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/conversation_history', methods=['GET'])
def get_conversation_history():
    """Gibt die Conversation History zurück"""
    return jsonify({
        "history": conversation_history,
        "count": len(conversation_history)
    })

@app.route('/api/clear_conversation', methods=['POST'])
def clear_conversation():
    """Löscht die Conversation History"""
    global conversation_history
    conversation_history.clear()
    return jsonify({
        "status": "success",
        "message": "Conversation History gelöscht"
    })

@app.route('/api/update_config', methods=['POST'])
def update_config():
    """Empfängt Live-Konfiguration vom FastAPI Backend"""
    try:
        config = request.get_json()
        
        # Konfiguration für ChatGPT speichern
        get_chatgpt_response.live_config = config
        
        print(f"🔥 Live-Konfiguration empfangen: {config}")
        
        return jsonify({
            "status": "success",
            "message": "Konfiguration live aktualisiert"
        })
        
    except Exception as e:
        print(f"❌ Config-Update Fehler: {e}")
        return jsonify({"error": str(e)}), 500

# Legacy-Endpoints für Kompatibilität
@app.route('/api/synthesize_and_blendshapes', methods=['POST'])
def synthesize_and_blendshapes():
    """Legacy-Endpoint - leitet an generate_audio_and_blendshapes weiter"""
    return generate_audio_and_blendshapes()

@app.route('/api/get_audio', methods=['POST'])
def get_audio():
    """Legacy-Endpoint für direkte Audio-Generierung"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'franzi')
        
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        response = requests.post(
            f"{NEUROSYNC_SERVER}/generate_speech",
            json={
                "text": text,
                "voice": voice_id
            },
            timeout=30
        )
        
        if response.status_code == 200:
            return Response(
                response.content,
                mimetype="audio/wav",
                headers={
                    "Content-Disposition": "attachment; filename=franzi_speech.wav",
                    "Content-Length": str(len(response.content))
                }
            )
        else:
            return jsonify({"error": "Audio-Generierung fehlgeschlagen"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """ElevenLabs Speech-to-Text Integration"""
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "Keine Audio-Datei"}), 400
            
        audio_file = request.files['audio']
        audio_data = audio_file.read()
        
        files = {
            'file': ('audio.wav', audio_data, 'audio/wav')
        }
        
        data = {
            'model_id': 'scribe_v1'
        }
        
        headers = {
            'xi-api-key': 'sk_9739f15bbe43d93268abcba00d20ab63973945a02a36723a'
        }
        
        response = requests.post(
            'https://api.elevenlabs.io/v2/speech-to-text',
            files=files,
            data=data,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            transcription = (
                result.get('transcription') or
                result.get('text') or  
                result.get('transcript') or
                result.get('content') or
                ""
            )
            
            return jsonify({
                "transcription": transcription,
                "status": "success"
            })
        else:
            return jsonify({"error": f"ElevenLabs API Fehler: {response.status_code}"}), 500
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    """System-Health-Check mit professionellem Emotion-Support"""
    try:
        response = requests.options(f"{NEUROSYNC_SERVER}/synthesize_and_blendshapes", timeout=5)
        neurosync_status = "online" if response.status_code in [200, 405] else "offline"
    except:
        neurosync_status = "offline"
    
    return jsonify({
        "status": "NeuroSync Web-Interface mit professionellem Emotion-System",
        "neurosync_server": neurosync_status,
        "server_url": NEUROSYNC_SERVER,
        "available_voices": list(VOICE_MAPPING.keys()),
        "default_voice": "franzi",
        "voice_mapping": VOICE_MAPPING,
        "sync_mode": "chatgpt_audio_event_sync",
        "ai_integration": "ChatGPT (OpenAI)",
        "conversation_history": len(conversation_history),
        "livelink_integration": "enabled",
        "backend_integration": "FastAPI WebSocket",
        "emotion_support": {
            "enabled": EMOTE_SYSTEM_AVAILABLE,
            "method": "professional_csv_animations",
            "system": "emote_connect_port_7777",
            "available_emotions": ["Happy", "Sad", "Angry", "Surprised", "Fearful", "Disgusted", "Neutral"],
            "automatic_detection": True,
            "german_keywords": True
        }
    })

@app.route('/api/voices')
def get_voices():
    """Verfügbare Stimmen zurückgeben"""
    return jsonify({
        "voices": VOICE_MAPPING,
        "default": "franzi",
        "description": {
            "franzi": "Deutsche Stimme (Standard)",
            "bf_isabella": "Englische Stimme - Bella",
            "af_heart": "Englische Stimme - Rachel"
        }
    })

if __name__ == '__main__':
    print("🚀 NeuroSync Web-Interface mit professionellem Emotion-System...")
    print("🎯 NeuroSync Server:", NEUROSYNC_SERVER)
    print("🔊 Standard-Stimme: Franzi (Deutsche TTS)")
    print("🔗 LiveLink Integration: Browser-gesteuert")
    print("🤖 AI Integration: ChatGPT (OpenAI)")
    if EMOTE_SYSTEM_AVAILABLE:
        print("🎭 Emotion System: Professionelle CSV-Animationen (EmoteConnect Port 7777)")
        print("🇩🇪 Deutsche Keywords: Happy, Sad, Angry, Surprised, Fearful, Disgusted")
    else:
        print("⚠️ Emotion System: Nicht verfügbar")
    print("🎵 Sync Modus: ChatGPT + Audio-Event + Parallel Emotion-Animationen")
    print("🔥 Backend Integration: FastAPI WebSocket Live-Updates")
    print("🌐 Web-Interface verfügbar unter:")
    print("   - Lokal: http://127.0.0.1:9000")
    print("   - HTTPS: https://neurosync.aura42.de")
    print("   - Backend: https://backend.aura42.de")
    print("📋 Verfügbare Stimmen:", list(VOICE_MAPPING.keys()))
    print("🎊 PROFESSIONELLES EMOTION-SYSTEM: Original NeuroSync CSV-Animationen!")
    app.run(host='0.0.0.0', port=9000, debug=False)