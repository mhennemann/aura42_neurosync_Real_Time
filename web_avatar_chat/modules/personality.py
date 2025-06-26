from flask import Blueprint, render_template, request, jsonify
import json
import os

bp = Blueprint('personality', __name__)

CONFIG_FILE = 'config/avatar_config.json'

@bp.route('/personality')
def personality_page():
    return render_template('modules/personality.html')

@bp.route('/api/personality', methods=['GET', 'POST'])
def personality_api():
    if request.method == 'GET':
        return jsonify(load_personality_config())
    else:
        save_personality_config(request.json)
        return jsonify({"status": "gespeichert"})

def load_personality_config():
    """Standard-Konfiguration laden"""
    default_config = {
        "persoenlichkeit": {
            "name": "Franzi",
            "alter": 28,
            "charakter": "freundlich, hilfsbereit, neugierig"
        },
        "chat_parameter": {
            "temperature": 0.7,
            "max_tokens": 150,
            "top_p": 1.0
        },
        "emotionale_zustaende": {
            "basis_emotion": "neutral",
            "energie_level": 0.5,
            "kreativitaet": 0.6
        }
    }
    
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    return default_config

def save_personality_config(config):
    """Konfiguration speichern"""
    os.makedirs('config', exist_ok=True)
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)