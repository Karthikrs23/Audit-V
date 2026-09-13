import json
import os
import pickle
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

def main():
    dataset_path = r"c:\Audit-V\datasets\basic_voice_intents.json"
    model_dir = r"c:\Audit-V\models"
    
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)

    print(f"Loading dataset from {dataset_path}...")
    with open(dataset_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    X = []
    y = []

    for item in data.get("intents", []):
        intent = item["intent"]
        for utterance in item["utterances"]:
            X.append(utterance)
            y.append(intent)

    print(f"Loaded {len(X)} utterances across {len(set(y))} intents.")

    # Create a simple pipeline with TF-IDF and Logistic Regression
    model = make_pipeline(TfidfVectorizer(), LogisticRegression())
    
    print("Training model...")
    model.fit(X, y)
    
    # Save the model
    model_path = os.path.join(model_dir, "voice_intent_model.pkl")
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
        
    print(f"Model successfully trained and saved to {model_path}")

    # Test with a few examples
    test_phrases = [
        "hi there assistant",
        "is it cold outside today",
        "wake me up in 20 minutes",
        "turn on the porch lights"
    ]
    
    print("\n--- Testing Model ---")
    for phrase in test_phrases:
        prediction = model.predict([phrase])[0]
        print(f"'{phrase}' -> Intent: {prediction}")

if __name__ == "__main__":
    main()
