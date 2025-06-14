from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

# NeuroSync Server URL
NEUROSYNC_SERVER = "http://localhost:8000"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/synthesize_and_blendshapes', methods=['POST'])
def synthesize_and_blendshapes():
    try:
        data = request.get_json()
        text = data.get('text', '')
        
        print(f"🎯 Sending to NeuroSync: {text}")
        
        # Forward to NeuroSync server
        response = requests.post(
            f"{NEUROSYNC_SERVER}/synthesize_and_blendshapes",
            json={"text": text},
            timeout=30
        )
        
        print(f"✅ NeuroSync response: {response.status_code}")
        
        if response.status_code == 200:
            return jsonify({
                "status": "success", 
                "message": "Avatar speaking",
                "text": text
            })
        else:
            return jsonify({
                "status": "error", 
                "message": f"NeuroSync error: {response.status_code}"
            }), 500
            
    except requests.exceptions.ConnectionError:
        return jsonify({
            "status": "error", 
            "message": "Cannot connect to NeuroSync server. Is it running?"
        }), 500
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({
            "status": "error", 
            "message": str(e)
        }), 500

@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file"}), 400
            
        audio_file = request.files['audio']
        
        # Forward to NeuroSync transcription API
        files = {'audio': audio_file}
        response = requests.post(
            f"{NEUROSYNC_SERVER}/transcribe", 
            files=files,
            timeout=30
        )
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({"error": "Transcription failed"}), 500
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    try:
        # Check NeuroSync server health
        response = requests.get(f"{NEUROSYNC_SERVER}/", timeout=5)
        neurosync_status = "online" if response.status_code == 200 else "offline"
    except:
        neurosync_status = "offline"
    
    return jsonify({
        "status": "Web interface running",
        "neurosync_server": neurosync_status,
        "server_url": NEUROSYNC_SERVER
    })

if __name__ == '__main__':
    print("🚀 Starting NeuroSync Web Interface...")
    print("🎯 NeuroSync Server:", NEUROSYNC_SERVER)
    print("🌐 Web Interface will be available at: http://148.251.21.122:9000")
    app.run(host='0.0.0.0', port=9000, debug=True)