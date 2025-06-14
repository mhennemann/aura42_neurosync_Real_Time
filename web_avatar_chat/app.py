from flask import Flask, render_template, request, jsonify, Response
import requests
import os

app = Flask(__name__)

# NeuroSync Server URL
NEUROSYNC_SERVER = "http://localhost:8000"

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
        voice = data.get('voice', 'franzi')  # Standard: Franzi
        
        print(f"🎯 Sende an NeuroSync: {text} (Stimme: {voice})")
        
        # Voice-ID ermitteln
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        # An NeuroSync-Server weiterleiten mit Voice-ID
        response = requests.post(
            f"{NEUROSYNC_SERVER}/synthesize_and_blendshapes",
            json={
                "text": text,
                "voice": voice_id  # ElevenLabs Voice-ID senden
            },
            timeout=30
        )
        
        print(f"✅ NeuroSync Antwort: {response.status_code}")
        
        if response.status_code == 200:
            return jsonify({
                "status": "success", 
                "message": "Avatar spricht",
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
        voice = data.get('voice', 'franzi')  # Standard: Franzi
        
        print(f"🎵 Audio holen für: {text} (Stimme: {voice})")
        
        # Voice-ID ermitteln
        voice_id = VOICE_MAPPING.get(voice, VOICE_MAPPING['default'])
        
        # Audio vom NeuroSync-Server holen
        response = requests.post(
            f"{NEUROSYNC_SERVER}/generate_speech",
            json={
                "text": text,
                "voice": voice_id  # ElevenLabs Voice-ID senden
            },
            timeout=30
        )
        
        print(f"🔊 Audio-Antwort: {response.status_code}, Größe: {len(response.content)} bytes")
        
        if response.status_code == 200:
            # Audio-Daten direkt zurückgeben
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
        
        print(f"🎤 Transkribiere Audio: {audio_file.filename}")
        
        # An NeuroSync Transkriptions-API weiterleiten
        files = {'audio': audio_file}
        response = requests.post(
            f"{NEUROSYNC_SERVER}/transcribe", 
            files=files,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            transcription = result.get('transcription', '')
            print(f"✅ Transkription: {transcription}")
            return jsonify(result)
        else:
            print(f"❌ Transkription fehlgeschlagen: {response.status_code}")
            return jsonify({"error": "Transkription fehlgeschlagen"}), 500
        
    except Exception as e:
        print(f"❌ Transkriptions-Fehler: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    try:
        # NeuroSync-Server-Gesundheit prüfen
        response = requests.get(f"{NEUROSYNC_SERVER}/", timeout=5)
        neurosync_status = "online" if response.status_code == 200 else "offline"
        
        # Voice-Mapping-Info hinzufügen
        available_voices = list(VOICE_MAPPING.keys())
        
    except Exception as e:
        neurosync_status = "offline"
        available_voices = []
    
    return jsonify({
        "status": "Web-Interface läuft",
        "neurosync_server": neurosync_status,
        "server_url": NEUROSYNC_SERVER,
        "available_voices": available_voices,
        "default_voice": "franzi",
        "voice_mapping": VOICE_MAPPING
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

@app.route('/api/set_voice', methods=['POST'])
def set_voice():
    """Standard-Stimme ändern"""
    try:
        data = request.get_json()
        voice = data.get('voice', 'franzi')
        
        if voice in VOICE_MAPPING:
            # Hier könnten Sie die Standard-Stimme in einer Session oder Datenbank speichern
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
    print("🚀 NeuroSync Web-Interface wird gestartet...")
    print("🎯 NeuroSync Server:", NEUROSYNC_SERVER)
    print("🔊 Standard-Stimme: Franzi (Deutsche TTS)")
    print("🌐 Web-Interface verfügbar unter: http://148.251.21.122:9000")
    print("📋 Verfügbare Stimmen:", list(VOICE_MAPPING.keys()))
    app.run(host='0.0.0.0', port=9000, debug=True)