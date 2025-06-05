"""
Utility functions for image processing.
These functions are called by the routes defined in main.py.
"""

import base64
from io import BytesIO
from PIL import Image
import torch

def process_image(data, blip_processor, blip_model, clip_processor, clip_model, vilt_processor, vilt_model, device):
    if not data:
        raise ValueError("No image data received.")
    try:
        image_data = base64.b64decode(data)
        raw_image = Image.open(BytesIO(image_data)).convert('RGB')
    except Exception as e:
        raise ValueError(f"Invalid image data: {str(e)}")
    # Conditional captioning
    text_condition = "Image showing"
    conditional_inputs = blip_processor(raw_image, text_condition, return_tensors="pt").to(device)
    conditional_out = blip_model.generate(**conditional_inputs)
    conditional_caption = blip_processor.decode(conditional_out[0], skip_special_tokens=True)
    # Unconditional captioning
    unconditional_inputs = blip_processor(raw_image, return_tensors="pt").to(device)
    unconditional_out = blip_model.generate(**unconditional_inputs)
    unconditional_caption = blip_processor.decode(unconditional_out[0], skip_special_tokens=True)
    # Image classification with CLIP
    clip_inputs = clip_processor(
        text=["Happy", "Sad", "Angry", "Disgusted", "Fearful", "Surprised", "Neutral"],
        images=raw_image,
        return_tensors="pt",
        padding=True
    ).to(device)
    outputs = clip_model(**clip_inputs)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1)
    clip_results = {label: probs[0][i].item() for i, label in enumerate(
        ["Happy", "Sad", "Angry", "Disgusted", "Fearful", "Surprised", "Neutral"]
    )}
    # Visual question answering using VILT
    question = "What is visible?"
    encoding = vilt_processor(raw_image, question, return_tensors="pt").to(device)
    outputs = vilt_model(**encoding)
    logits = outputs.logits
    probs = torch.softmax(logits, dim=1).squeeze(0)
    top5_values, top5_idx = torch.topk(probs, 5)
    vilt_results = [(vilt_model.config.id2label[idx.item()], top5_values[i].item()) for i, idx in enumerate(top5_idx)]
    return {
        "conditional_caption": conditional_caption,
        "unconditional_caption": unconditional_caption,
        "clip_results": clip_results,
        "vilt_results": vilt_results
    }

def process_clip(data, clip_processor, clip_model, device):
    if not data:
        raise ValueError("No image data received.")
    try:
        image_data = base64.b64decode(data)
        raw_image = Image.open(BytesIO(image_data)).convert('RGB')
    except Exception as e:
        raise ValueError(f"Invalid image data: {str(e)}")
    emotions = ["Angry", "Disgusted", "Fearful", "Happy", "Neutral", "Sad", "Surprised"]
    clip_inputs = clip_processor(
        text=emotions,
        images=raw_image,
        return_tensors="pt",
        padding=True
    ).to(device)
    outputs = clip_model(**clip_inputs)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1)
    clip_results = {label: probs[0][i].item() for i, label in enumerate(emotions)}
    return {"clip_results": clip_results}

def process_pdf_imagery(data, blip_processor, blip_model, clip_processor, clip_model, vilt_processor, vilt_model, device):
    if not data:
        raise ValueError("No image data received.")
    try:
        image_data = base64.b64decode(data)
        raw_image = Image.open(BytesIO(image_data)).convert('RGB')
    except Exception as e:
        raise ValueError(f"Invalid image data: {str(e)}")
    # Unconditional captioning
    unconditional_inputs = blip_processor(raw_image, return_tensors="pt").to(device)
    unconditional_out = blip_model.generate(**unconditional_inputs)
    unconditional_caption = blip_processor.decode(unconditional_out[0], skip_special_tokens=True)
    # Domain-specific classification using CLIP
    pdf_labels = ["Number", "Panel", "Joint", "Measurement", "Text", "Diagram", "Other"]
    clip_inputs = clip_processor(
        text=pdf_labels,
        images=raw_image,
        return_tensors="pt",
        padding=True
    ).to(device)
    outputs = clip_model(**clip_inputs)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1)
    pdf_classification = {label: probs[0][i].item() for i, label in enumerate(pdf_labels)}
    # Domain-specific Q&A using VILT
    question = "What measurements or specifications are visible in this image?"
    encoding = vilt_processor(raw_image, question, return_tensors="pt").to(device)
    outputs = vilt_model(**encoding)
    logits = outputs.logits
    probs = torch.softmax(logits, dim=1).squeeze(0)
    top5_values, top5_idx = torch.topk(probs, 5)
    vilt_results = [(vilt_model.config.id2label[idx.item()], top5_values[i].item()) for i, idx in enumerate(top5_idx)]
    return {
        "unconditional_caption": unconditional_caption,
        "pdf_classification": pdf_classification,
        "vilt_results": vilt_results
    }
