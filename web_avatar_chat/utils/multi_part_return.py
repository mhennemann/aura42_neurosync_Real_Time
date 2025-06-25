"""
Multipart Response Parser für NeuroSync - Mit korrekter MY_BOUNDARY_STRING
"""
import json
import re


def parse_multipart_response(response):
    """
    Parst NeuroSync Multipart Response mit MY_BOUNDARY_STRING
    Returns: (audio_bytes, blendshapes_list)
    """
    try:
        # Response Content extrahieren
        if hasattr(response, 'content'):
            content = response.content
        else:
            content = str(response).encode()
        
        print(f"📦 Response Size: {len(content)} bytes")
        
        # NeuroSync verwendet MY_BOUNDARY_STRING
        boundary = b'--MY_BOUNDARY_STRING'
        
        if boundary not in content:
            print("❌ Boundary nicht gefunden")
            return b'', []
        
        # Teile zwischen Boundaries
        parts = content.split(boundary)
        
        audio_bytes = b''
        blendshapes_list = []
        
        for i, part in enumerate(parts):
            if len(part) < 20:  # Skip kleine Teile
                continue
                
            try:
                # Header und Body trennen
                if b'\r\n\r\n' in part:
                    header, body = part.split(b'\r\n\r\n', 1)
                    header_str = header.decode('utf-8', errors='ignore').lower()
                    
                    # Audio Teil
                    if 'audio/wav' in header_str:
                        audio_bytes = body
                        print(f"🎵 Audio gefunden: {len(audio_bytes)} bytes")
                    
                    # JSON Teil
                    elif 'application/json' in header_str:
                        try:
                            json_data = json.loads(body.decode('utf-8'))
                            if isinstance(json_data, list):
                                blendshapes_list = json_data
                            elif isinstance(json_data, dict):
                                blendshapes_list = json_data.get('blendshapes', [])
                            print(f"🎭 Blendshapes gefunden: {len(blendshapes_list)} items")
                        except Exception as e:
                            print(f"⚠️ JSON parsing fehler: {e}")
                
            except Exception as e:
                print(f"⚠️ Part parsing fehler: {e}")
        
        print(f"📊 Final: Audio={len(audio_bytes)} bytes, Blendshapes={len(blendshapes_list)} items")
        return audio_bytes, blendshapes_list
        
    except Exception as e:
        print(f"❌ Parser error: {e}")
        return b'', []


if __name__ == "__main__":
    # Test mit echter Response
    try:
        with open('response_test.bin', 'rb') as f:
            content = f.read()
        
        class MockResponse:
            def __init__(self, content):
                self.content = content
        
        response = MockResponse(content)
        audio, blendshapes = parse_multipart_response(response)
        print(f"✅ Test: Audio={len(audio)} bytes, Blendshapes={len(blendshapes)} items")
    except FileNotFoundError:
        print("response_test.bin nicht gefunden")
