"""
Utility functions for audio processing.
These functions are called by the routes defined in main.py.
"""
import numpy as np
from io import BytesIO
from base64 import b64decode
import soundfile as sf
import resampy
from models.neurosync.generate_face_shapes import generate_facial_data_from_bytes

def trim_and_fade(audio, sample_rate, threshold=0.01, fade_duration=0.0, padding_duration=0.1):
    # Find indices where the absolute value exceeds the threshold (non-silent samples)
    above_threshold = np.where(np.abs(audio) > threshold)[0]
    if above_threshold.size == 0:
        return audio
    padding_samples = int(padding_duration * sample_rate)
    start_idx = max(above_threshold[0] - padding_samples, 0)
    desired_silence_samples = int(0.2 * sample_rate)
    trailing_start = above_threshold[-1] + 1
    # Count contiguous silent samples after the trailing_start
    available_silence_samples = 0
    for i in range(trailing_start, len(audio)):
        if np.abs(audio[i]) <= threshold:
            available_silence_samples += 1
        else:
            break
    silence_samples_to_include = min(desired_silence_samples, available_silence_samples)
    end_idx = trailing_start + silence_samples_to_include
    trimmed_audio = audio[start_idx:end_idx]
    if fade_duration > 0:
        fade_samples = int(fade_duration * sample_rate)
        fade_samples = min(fade_samples, len(trimmed_audio))  # Ensure fade_samples is not longer than the trimmed_audio
        fade_in = np.linspace(0, 1, fade_samples)
        trimmed_audio[:fade_samples] *= fade_in
    return trimmed_audio

def generate_speech_segment_tts(text, tts_pipeline, tts_lock, voice='bf_isabella'):
    """
    Generate a speech segment using ElevenLabs TTS.
    """
    try:
        if not text.strip():
            print("Input text is empty or whitespace.")
            return None

        # Voice mapping for ElevenLabs
        voice_mapping = {
            'bf_isabella': "EXAVITQu4vr4xnSDxMaL",  # Bella
            'af_heart': "21m00Tcm4TlvDq8ikWAM",    # Rachel
            'franzi': "NX39CipaoYitJ3sMwH5I",      # Deutsche Franzi
            'default': "NX39CipaoYitJ3sMwH5I"       # Standard: Franzi
        }

        elevenlabs_voice = voice_mapping.get(voice, voice_mapping['default'])

        # Use ElevenLabs client from tts_pipeline
        if tts_pipeline and hasattr(tts_pipeline, 'text_to_speech'):
            # Method 1: Client text_to_speech method
            audio_generator = tts_pipeline.text_to_speech.convert(
                voice_id=elevenlabs_voice,
                text=text,
                model_id="eleven_multilingual_v1"  # ← DAS WAR DIE WICHTIGE ÄNDERUNG!
            )
        else:
            # Method 2: Direct API call
            from elevenlabs.client import ElevenLabs
            client = ElevenLabs(api_key="sk_9739f15bbe43d93268abcba00d20ab63973945a02a36723a")

            audio_generator = client.text_to_speech.convert(
                voice_id=elevenlabs_voice,
                text=text,
                model_id="eleven_multilingual_v1"  # ← UND HIER AUCH!
            )

        # Collect audio data from generator
        audio_chunks = []
        for chunk in audio_generator:
            audio_chunks.append(chunk)

        # Combine all chunks
        audio_bytes = b''.join(audio_chunks)

        print(f"✅ ElevenLabs generated {len(audio_bytes)} bytes for: {text[:50]}...")
        return audio_bytes

    except Exception as e:
        print(f"❌ Error generating speech with ElevenLabs for text '{text}': {e}")

def process_transcription(audio_base64, return_timestamps, transgenerator):
    if not audio_base64:
        raise ValueError("No audio data provided.")
    # Decode the base64 string to bytes and read audio data
    audio_bytes = b64decode(audio_base64)
    audio_input, original_sampling_rate = sf.read(BytesIO(audio_bytes))
    # Convert stereo to mono if needed
    if len(audio_input.shape) == 2:
        audio_input = np.mean(audio_input, axis=1)
    target_sampling_rate = 16000
    if original_sampling_rate != target_sampling_rate:
        audio_input = resampy.resample(audio_input, original_sampling_rate, target_sampling_rate)
    audio_duration = len(audio_input) / target_sampling_rate
    if audio_duration > 29:
        return_timestamps = True
    transcription = transgenerator(audio_input, return_timestamps=return_timestamps)
    if transcription and isinstance(transcription, dict):
        transcription_text = transcription.get('text', '').strip()
        result = {"status": "success", "transcription": transcription_text}
        if return_timestamps:
            result['timestamps'] = transcription.get('segments', [])
        return result
    else:
        raise ValueError("Transcription failed or unexpected format.")

def process_blendshapes(audio_bytes, blendshape_model, device, config):
    if not audio_bytes:
        raise ValueError("No audio data provided.")
    generated_facial_data = generate_facial_data_from_bytes(audio_bytes, blendshape_model, device, config)
    if isinstance(generated_facial_data, np.ndarray):
        return {'blendshapes': generated_facial_data.tolist()}
    else:
        return {'blendshapes': generated_facial_data}