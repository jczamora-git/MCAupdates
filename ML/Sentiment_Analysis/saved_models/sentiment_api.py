"""
Flask API for Sentiment Analysis
Run this server to provide sentiment analysis endpoint for the feedback system.

Usage:
    python sentiment_api.py

The API will be available at http://localhost:5000
"""

import os
import sys

# Add saved_models to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify
from flask_cors import CORS
from predict_sentiment import SentimentPredictor

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize the sentiment predictor
print("Initializing Sentiment Analysis Model...")
predictor = None

def get_predictor():
    global predictor
    if predictor is None:
        model_path = os.path.dirname(os.path.abspath(__file__))
        predictor = SentimentPredictor(model_path)
    return predictor


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'message': 'Sentiment Analysis API is running'
    })


@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict sentiment for given text
    
    Request body:
        {
            "text": "Your text here"
        }
    
    Response:
        {
            "text": "Your text here",
            "cleaned_text": "your text here",
            "sentiment": "positive|negative|neutral",
            "confidence": 0.95,
            "probabilities": {
                "positive": 0.1,
                "negative": 0.05,
                "neutral": 0.85
            }
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({
                'error': 'Missing "text" field in request body'
            }), 400
        
        text = data['text']
        
        if not text or not text.strip():
            return jsonify({
                'error': 'Text cannot be empty'
            }), 400
        
        # Get prediction
        pred = get_predictor()
        result = pred.predict(text)
        
        return jsonify(result)
    
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """
    Predict sentiment for multiple texts
    
    Request body:
        {
            "texts": ["Text 1", "Text 2", ...]
        }
    
    Response:
        {
            "results": [
                { sentiment result 1 },
                { sentiment result 2 },
                ...
            ]
        }
    """
    try:
        data = request.get_json()
        
        if not data or 'texts' not in data:
            return jsonify({
                'error': 'Missing "texts" field in request body'
            }), 400
        
        texts = data['texts']
        
        if not isinstance(texts, list) or len(texts) == 0:
            return jsonify({
                'error': '"texts" must be a non-empty array'
            }), 400
        
        # Get predictions
        pred = get_predictor()
        results = pred.predict_batch(texts)
        
        return jsonify({
            'results': results
        })
    
    except Exception as e:
        return jsonify({
            'error': str(e)
        }), 500


if __name__ == '__main__':
    # Pre-load the model
    get_predictor()
    print("\n" + "="*50)
    print("Sentiment Analysis API Server")
    print("="*50)
    print("Server running at: http://localhost:5000")
    print("Endpoints:")
    print("  GET  /health        - Health check")
    print("  POST /predict       - Predict sentiment for single text")
    print("  POST /predict/batch - Predict sentiment for multiple texts")
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=False)
