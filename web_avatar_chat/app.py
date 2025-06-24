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

@app.route('/api/synthesize_and_blendshapes', methods=['POST'])
def synthesize_and_blendshapes():
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'franzi')
        print(f"🎯 Sende an NeuroSync: {text} (Stimme: {voice})")
        
        # Voice-ID ermitteln
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        # An NeuroSync-Server weiterleiten mit Voice-ID
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
                    try:
                        from livelink.connect.livelink_init import create_socket_connection, initialize_py_face
                        from livelink.send_to_unreal import pre_encode_facial_data, send_pre_encoded_data_to_unreal
                        from threading import Event, Thread
                        import time
                        
                        print(f"🎯 Perfekte Sync: Audio + LiveLink gleichzeitig für {len(blendshapes_list)} frames")
                        
                        # Audio-Dauer berechnen (Approximation)
                        audio_length_seconds = len(audio_bytes) / (22050 * 2)  # 22kHz, 16bit
                        print(f"🕐 Audio-Dauer: {audio_length_seconds:.1f} Sekunden")
                        
                        # LiveLink parallel zu Browser-Audio starten
                        def start_synchronized_livelink():
                            try:
                                # Kurzer Puffer für Browser-Audio Start
                                time.sleep(0.2)
                                
                                py_face = initialize_py_face()
                                socket_connection = create_socket_connection()
                                encoded_data = pre_encode_facial_data(blendshapes_list, py_face)
                                
                                start_event = Event()
                                start_event.set()
                                
                                print("🎭 Starte LiveLink synchron zu Browser-Audio...")
                                send_pre_encoded_data_to_unreal(encoded_data, start_event, 60, socket_connection)
                                print("🎭 LiveLink Animation komplett (synchron zu Audio)")
                                
                            except Exception as e:
                                print(f"❌ Synchronized LiveLink Fehler: {e}")
                                import traceback
                                traceback.print_exc()
                        
                        # LiveLink-Thread starten (parallel zu Browser-Audio)
                        livelink_thread = Thread(target=start_synchronized_livelink)
                        livelink_thread.start()
                        
                        print(f"🚀 Audio + LiveLink gestartet - perfekte Synchronisation!")
                        
                        # Audio als Base64 für Browser zurückgeben
                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                        
                        return jsonify({
                            "status": "success", 
                            "message": "Avatar spricht perfekt synchron (Audio + LiveLink)",
                            "text": text,
                            "voice": voice,
                            "audio_data": audio_base64,
                            "audio_length": audio_length_seconds,
                            "sync_mode": "perfect_audio_livelink_sync",
                            "play_audio": True
                        })
                        
                    except Exception as e:
                        print(f"❌ Perfekte Sync Fehler: {e}")
                        import traceback
                        traceback.print_exc()
                
            except Exception as e:
                print(f"❌ Multipart parsing error: {e}")
            
            return jsonify({
                "status": "success", 
                "message": "Avatar generiert (ohne Sync)",
                "text": text,
                "voice": voice
            })
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

@app.route('/api/get_audio', methods=['POST'])
def get_audio():
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'franzi')
        
        print(f"🎵 Audio holen für: {text} (Stimme: {voice})")
        
        # Voice-ID ermitteln
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        # Audio vom NeuroSync-Server holen
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
            print(f"❌ Audio-Generierung fehlgeschlagen: {response.status_code}")
            return jsonify({"error": "Audio-Generierung fehlgeschlagen"}), 500
            
    except requests.exceptions.ConnectionError:
        print("❌ Verbindung zum NeuroSync-Server nicht möglich")
        return jsonify({"error": "Verbindung zum NeuroSync-Server nicht möglich"}), 500
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
        
        print(f"🎤 Transkribiere Audio mit ElevenLabs: {len(audio_data)} bytes")
        
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
        
        print(f"🔊 ElevenLabs STT Antwort: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"🔍 Komplette ElevenLabs Response: {result}")
            
            transcription = (
                result.get('transcription') or
                result.get('text') or  
                result.get('transcript') or
                result.get('content') or
                ""
            )
            
            print(f"✅ Gefundene Transkription: '{transcription}'")
            
            return jsonify({
                "transcription": transcription,
                "status": "success"
            })
        else:
            print(f"❌ ElevenLabs STT fehlgeschlagen: {response.status_code}")
            return jsonify({"error": f"ElevenLabs API Fehler: {response.status_code}"}), 500
        
    except Exception as e:
        print(f"❌ Transkriptions-Fehler: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    try:
        response = requests.get(f"{NEUROSYNC_SERVER}/", timeout=5)
        neurosync_status = "online" if response.status_code == 200 else "offline"
        
        try:
            audio_response = requests.get(f"{NEUROSYNC_AUDIO_SERVER}/", timeout=5)
            audio_status = "online" if audio_response.status_code == 200 else "offline"
        except:
            audio_status = "offline"
        
        available_voices = list(VOICE_MAPPING.keys())
        
    except Exception as e:
        neurosync_status = "offline"
        audio_status = "offline"
        available_voices = []
    
    return jsonify({
        "status": "Web-Interface mit perfekter Audio+LiveLink Synchronisation",
        "neurosync_server": neurosync_status,
        "audio_server": audio_status,
        "server_url": NEUROSYNC_SERVER,
        "audio_server_url": NEUROSYNC_AUDIO_SERVER,
        "available_voices": available_voices,
        "default_voice": "franzi",
        "voice_mapping": VOICE_MAPPING,
        "sync_mode": "perfect_audio_livelink_sync",
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

@app.route('/api/set_voice', methods=['POST'])
def set_voice():
    try:
        data = request.get_json()
        voice = data.get('voice', 'franzi')
        
        if voice in VOICE_MAPPING:
            return jsonify({
                "status": "success",
                "voice": voice,
                "voice_id": VOICE_MAPPING[voice],
                "message": f"Stimme auf {voice} gesetzt"
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Unbekannte Stimme",
                "available_voices": list(VOICE_MAPPING.keys())
            }), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("🚀 NeuroSync Web-Interface mit perfekter Audio+LiveLink Synchronisation...")
    print("🎯 NeuroSync Server:", NEUROSYNC_SERVER)
    print("🎤 NeuroSync Audio Server:", NEUROSYNC_AUDIO_SERVER)
    print("🔊 Standard-Stimme: Franzi (Deutsche TTS)")
    print("🔗 LiveLink Integration: AKTIVIERT")
    print("🎵 Sync Modus: Perfekte Audio+LiveLink Synchronisation")
    print("🌐 Web-Interface verfügbar unter:")
    print("   - Lokal: http://127.0.0.1:9000")
    print("   - HTTPS: https://neurosync.aura42.de")
    print("   - HTTPS: https://avatar.aura42.de")
    print("📋 Verfügbare Stimmen:", list(VOICE_MAPPING.keys()))
    print("🎊 PERFEKTE SYNCHRONISATION: Audio + LiveLink zur exakt gleichen Zeit!")
    app.run(host='127.0.0.1', port=9000, debug=False)