
"""
Standalone Sentiment Analysis Predictor
CNN + BiLSTM Model

Usage:
    python predict_sentiment.py "Your text here"

Or import and use in your own script:
    from predict_sentiment import SentimentPredictor
    predictor = SentimentPredictor('saved_models')
    result = predictor.predict("Your text here")
"""

import os
import re
import pickle
import numpy as np
import sys

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing.sequence import pad_sequences


class SentimentPredictor:
    """
    Sentiment Analysis Predictor using trained CNN + BiLSTM model.
    """

    def __init__(self, model_path='saved_models'):
        """
        Initialize the predictor by loading the trained model.

        Args:
            model_path: Path to the saved_models directory
        """
        print("Loading sentiment analysis model...")

        # Load model
        self.model = load_model(f'{model_path}/sentiment_cnn_bilstm_model.keras')

        # Load tokenizer
        with open(f'{model_path}/tokenizer.pickle', 'rb') as f:
            self.tokenizer = pickle.load(f)

        # Load label encoder
        with open(f'{model_path}/label_encoder.pickle', 'rb') as f:
            self.label_encoder = pickle.load(f)

        # Load config
        with open(f'{model_path}/model_config.pickle', 'rb') as f:
            self.config = pickle.load(f)

        print("Model loaded successfully!")

    def clean_text(self, text):
        """Clean and preprocess text."""
        if not isinstance(text, str):
            return ""
        text = text.lower()
        text = re.sub(r'http\S+|www\S+|https\S+', '', text)
        text = re.sub(r'\S+@\S+', '', text)
        text = re.sub(r'[^a-zA-Z\sñÑ]', ' ', text)
        text = ' '.join(text.split())
        return text.strip()

    def predict(self, text):
        """
        Predict sentiment for a given text.

        Args:
            text: Input text (string)

        Returns:
            dict: Prediction results
        """
        # Clean text
        cleaned = self.clean_text(text)

        # Tokenize and pad
        sequence = self.tokenizer.texts_to_sequences([cleaned])
        padded = pad_sequences(sequence, maxlen=self.config['max_sequence_length'], 
                              padding='post', truncating='post')

        # Predict
        prediction = self.model.predict(padded, verbose=0)[0]

        # Get results
        predicted_class = np.argmax(prediction)
        predicted_sentiment = self.label_encoder.inverse_transform([predicted_class])[0]
        confidence = float(prediction[predicted_class])

        # All probabilities
        probabilities = {label: float(prob) 
                        for label, prob in zip(self.config['class_names'], prediction)}

        return {
            'text': text,
            'cleaned_text': cleaned,
            'sentiment': predicted_sentiment,
            'confidence': confidence,
            'probabilities': probabilities
        }

    def predict_batch(self, texts):
        """Predict sentiment for multiple texts."""
        return [self.predict(text) for text in texts]


if __name__ == "__main__":
    # Initialize predictor
    predictor = SentimentPredictor()

    # Check for command line arguments
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:])
        result = predictor.predict(text)
        print(f"\nText: {result['text']}")
        print(f"Sentiment: {result['sentiment']}")
        print(f"Confidence: {result['confidence']*100:.2f}%")
        print(f"Probabilities: {result['probabilities']}")
    else:
        # Interactive mode
        print("\n" + "="*50)
        print("Sentiment Analysis - Interactive Mode")
        print("="*50)
        print("Type your text and press Enter to analyze.")
        print("Type 'quit' to exit.\n")

        while True:
            text = input("Enter text: ").strip()
            if text.lower() == 'quit':
                print("Goodbye!")
                break
            if text:
                result = predictor.predict(text)
                print(f"  → Sentiment: {result['sentiment']} ({result['confidence']*100:.2f}%)")
                print()
