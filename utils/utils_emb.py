
def process_embedding(text, embmodel):
    if not text:
        raise ValueError("No text data provided.")
    embedding = embmodel.encode([text])[0]
    return {'embedding': embedding.tolist()}
