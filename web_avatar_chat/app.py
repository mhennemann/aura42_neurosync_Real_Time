from flask import Flask, render_template, request, jsonify, Response
import requests
import os
import base64

app = Flask(__name__)

# NeuroSync Server URL
NEUROSYNC_SERVER = "http://localhost:8000"
NEUROSYNC_AUDIO_SERVER = "http://localhost:6969"

# Voice-Mapping für ElevenLabs (mit Franzi als Standard)
VOICE_MAPPING = {
    'franzi': 'NX39CipaoYitJ3sMwH5I',      # Deutsche Franzi-Stimme
    'bf_isabella': 'EXAVITQu4vr4xnSDxMaL',  # Bella
    'af_heart': '21m00Tcm4TlvDq8ikWAM',     # Rachel
    'default': 'NX39CipaoYitJ3sMwH5I'       # Standard: Franzi
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate_audio_and_blendshapes', methods=['POST'])
def generate_audio_and_blendshapes():
    """Generiert Audio + Blendshapes, aber startet NICHTS - Browser kontrolliert alles"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'franzi')
        print(f"🎯 Generiere für Browser-Sync: {text} (Stimme: {voice})")
        
        # Voice-ID ermitteln
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        # An NeuroSync-Server weiterleiten
        response = requests.post(
            f"{NEUROSYNC_SERVER}/synthesize_and_blendshapes",
            json={
                "text": text,
                "voice": voice_id
            },
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
                    
                    # Blendshapes für späteren LiveLink-Trigger speichern
                    # (Global oder in Session - hier vereinfacht als Global)
                    global current_blendshapes
                    current_blendshapes = blendshapes_list
                    
                    print(f"🎬 Browser-Sync vorbereitet: {audio_length_seconds:.1f}s Audio + {len(blendshapes_list)} frames")
                    
                    return jsonify({
                        "status": "success",
                        "message": "Audio + Blendshapes für Browser-Sync bereit",
                        "text": text,
                        "voice": voice,
                        "audio_data": audio_base64,
                        "audio_length": audio_length_seconds,
                        "blendshapes_count": len(blendshapes_list),
                        "sync_mode": "browser_controlled_sync",
                        "ready_for_sync": True
                    })
                
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
            
    except requests.exceptions.ConnectionError:
        return jsonify({
            "status": "error",
            "message": "Verbindung zum NeuroSync-Server nicht möglich. Läuft er?"
        }), 500
    except Exception as e:
        print(f"❌ Fehler: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route('/api/trigger_livelink', methods=['POST'])
def trigger_livelink():
    """Browser-gesteuerter LiveLink-Trigger - startet Animation synchron zu Browser-Audio"""
    try:
        print("🎭 Browser triggert LiveLink-Animation...")
        
        # Blendshapes aus Global-Variable (in Produktion: Session/Redis verwenden)
        global current_blendshapes
        if 'current_blendshapes' not in globals() or not current_blendshapes:
            return jsonify({
                "status": "error",
                "message": "Keine Blendshapes verfügbar"
            }), 400
        
        # LiveLink sofort starten
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
                
                print(f"🎭 LiveLink Animation startet für {len(current_blendshapes)} frames...")
                send_pre_encoded_data_to_unreal(encoded_data, start_event, 60, socket_connection)
                print("🎭 LiveLink Animation komplett")
                
            except Exception as e:
                print(f"❌ LiveLink Fehler: {e}")
                import traceback
                traceback.print_exc()
        
        # LiveLink in separatem Thread (non-blocking)
        livelink_thread = Thread(target=execute_livelink)
        livelink_thread.start()
        
        return jsonify({
            "status": "success",
            "message": "LiveLink Animation gestartet",
            "frames": len(current_blendshapes)
        })
        
    except Exception as e:
        print(f"❌ LiveLink Trigger Fehler: {e}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

# Alte API-Endpoints für Kompatibilität
@app.route('/api/synthesize_and_blendshapes', methods=['POST'])
def synthesize_and_blendshapes():
    """Legacy-Endpoint - leitet zu neuer Browser-Sync weiter"""
    return generate_audio_and_blendshapes()

@app.route('/api/get_audio', methods=['POST'])
def get_audio():
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'franzi')
        
        print(f"🎵 Legacy Audio für: {text} (Stimme: {voice})")
        
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        response = requests.post(
            f"{NEUROSYNC_SERVER}/generate_speech",
            json={
                "text": text,
                "voice": voice_id
            },
            timeout=30
        )
        
        print(f"🔊 Audio-Antwort: {response.status_code}, Größe: {len(response.content)} bytes")
        
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
        print(f"❌ Audio-Fehler: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "Keine Audio-Datei"}), 400
            
        audio_file = request.files['audio']
        audio_data = audio_file.read()
        
        print(f"🎤 Transkribiere Audio: {len(audio_data)} bytes")
        
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
            'https://api.elevenlabs.io/v1/speech-to-text',
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
        print(f"❌ Transkriptions-Fehler: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    try:
        response = requests.get(f"{NEUROSYNC_SERVER}/", timeout=5)
        neurosync_status = "online" if response.status_code == 200 else "offline"
    except:
        neurosync_status = "offline"
    
    return jsonify({
        "status": "Web-Interface mit Browser-gesteuerter Synchronisation",
        "neurosync_server": neurosync_status,
        "server_url": NEUROSYNC_SERVER,
        "available_voices": list(VOICE_MAPPING.keys()),
        "default_voice": "franzi",
        "voice_mapping": VOICE_MAPPING,
        "sync_mode": "browser_controlled_sync",
        "livelink_integration": "enabled"
    })

@app.route('/api/voices')
def get_voices():
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
    print("🚀 NeuroSync Web-Interface mit Browser-gesteuerter Synchronisation...")
    print("🎯 NeuroSync Server:", NEUROSYNC_SERVER)
    print("🔊 Standard-Stimme: Franzi (Deutsche TTS)")
    print("🔗 LiveLink Integration: Browser-gesteuert")
    print("🎵 Sync Modus: Browser kontrolliert Audio + LiveLink")
    print("🌐 Web-Interface verfügbar unter:")
    print("   - Lokal: http://127.0.0.1:9000")
    print("   - HTTPS: https://neurosync.aura42.de")
    print("   - HTTPS: https://avatar.aura42.de")
    print("📋 Verfügbare Stimmen:", list(VOICE_MAPPING.keys()))
    print("🎊 BROWSER-GESTEUERTE SYNCHRONISATION: Perfekte Timing-Kontrolle!")
    app.run(host='127.0.0.1', port=9000, debug=False)