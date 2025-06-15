@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "Keine Audio-Datei"}), 400
            
        audio_file = request.files['audio']
        audio_data = audio_file.read()
        
        print(f"🎤 Transkribiere Audio mit ElevenLabs: {len(audio_data)} bytes")
        
        # ElevenLabs Speech-to-Text API verwenden
        files = {
            'file': ('audio.wav', audio_data, 'audio/wav')
        }
        
        data = {
            'model_id': 'scribe_v1',
            'language_code': 'de',
            'timestamp_granularity': 'word'
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
            
            # Verschiedene mögliche Response-Felder prüfen
            transcription = ""
            if 'transcription' in result:
                transcription = result['transcription']
            elif 'text' in result:
                transcription = result['text']
            elif 'transcript' in result:
                transcription = result['transcript']
            elif isinstance(result, dict) and len(result) > 0:
                # Falls das Response-Format anders ist, ersten Wert nehmen
                first_key = list(result.keys())[0]
                transcription = str(result[first_key])
            
            print(f"✅ Gefundene Transkription: '{transcription}'")
            
            if transcription and transcription.strip():
                return jsonify({
                    "transcription": transcription.strip(),
                    "status": "success"
                })
            else:
                return jsonify({
                    "transcription": "Keine Sprache erkannt",
                    "status": "empty"
                })
                
        elif response.status_code == 422:
            print(f"❌ ElevenLabs Validation Error: {response.text}")
            return jsonify({"error": "Audio-Format nicht unterstützt"}), 422
        else:
            print(f"❌ ElevenLabs STT fehlgeschlagen: {response.status_code}")
            print(f"❌ Response: {response.text}")
            return jsonify({"error": f"ElevenLabs API Fehler: {response.status_code}"}), 500
        
    except requests.exceptions.Timeout:
        print("❌ ElevenLabs API Timeout")
        return jsonify({"error": "Transkription Timeout"}), 504
    except requests.exceptions.ConnectionError:
        print("❌ Verbindung zu ElevenLabs nicht möglich")
        return jsonify({"error": "Verbindung zu ElevenLabs nicht möglich"}), 503
    except Exception as e:
        print(f"❌ Transkriptions-Fehler: {e}")
        return jsonify({"error": str(e)}), 500