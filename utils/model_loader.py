"""
Module for loading audio and image models.
This module loads all necessary models and returns them for use in the main app.
"""

import torch

device = "cuda" if torch.cuda.is_available() else "cpu"

def load_audio_models():
    from transformers import pipeline, AutoModelForSpeechSeq2Seq, AutoProcessor
    from models.neurosync.model.model import load_model
    from models.neurosync.config import config

    torch_dtype_audio = torch.bfloat16 if torch.cuda.is_available() else torch.float32

    audio_model_id = 'models/whisper_turbo'
    new_model = AutoModelForSpeechSeq2Seq.from_pretrained(
        audio_model_id,
        torch_dtype=torch_dtype_audio,
        use_safetensors=True
    ).to(device)
    processor = AutoProcessor.from_pretrained(audio_model_id)

    # Create the transcription pipeline
    transgenerator = pipeline(
        "automatic-speech-recognition",
        model=new_model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype_audio,
        device=device
    )

    # Load the blendshape model
    model_path = 'models/neurosync/model/model.pth'
    blendshape_model = load_model(model_path, config, device)

    return {
        "transgenerator": transgenerator,
        "blendshape_model": blendshape_model
    }

def load_embedding_model():
    from sentence_transformers import SentenceTransformer
    emb_model_path = "models/arctic_embed"
    embmodel = SentenceTransformer(emb_model_path).to(device)
    return embmodel

def load_image_models():
    from transformers import (
        BlipProcessor,
        BlipForConditionalGeneration,
        CLIPProcessor,
        CLIPModel,
        ViltProcessor,
        ViltForQuestionAnswering
    )

    blip_path = "models/vision/blip-image-captioning-large"
    blip_processor = BlipProcessor.from_pretrained(blip_path)
    blip_model = BlipForConditionalGeneration.from_pretrained(blip_path).to(device)

    clip_path = "models/vision/clip-vit-large-patch14"
    clip_processor = CLIPProcessor.from_pretrained(clip_path)
    clip_model = CLIPModel.from_pretrained(clip_path).to(device)

    vilt_path = "models/vision/vilt-b32-finetuned-vqa"
    vilt_processor = ViltProcessor.from_pretrained(vilt_path)
    vilt_model = ViltForQuestionAnswering.from_pretrained(vilt_path).to(device)

    return {
        "blip_processor": blip_processor,
        "blip_model": blip_model,
        "clip_processor": clip_processor,
        "clip_model": clip_model,
        "vilt_processor": vilt_processor,
        "vilt_model": vilt_model
    }

def load_tts_model():
    from kokoro import KPipeline
    from threading import Lock
    tts_pipeline = KPipeline(lang_code='a', repo_id="hexgrad/Kokoro-82M")
    tts_lock = Lock()
    return {"tts_pipeline": tts_pipeline, "tts_lock": tts_lock}
