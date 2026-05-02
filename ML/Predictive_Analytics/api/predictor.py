#!/usr/bin/env python3
"""
Predictive Analytics - Python Predictor Script
Called by PHP backend to make predictions using Prophet models.
Supports: Enrollment Prediction & Payment Prediction
"""

import sys
import json
import os
import warnings
warnings.filterwarnings('ignore')

# Paths — resolved relative to this script's location
_API_DIR = os.path.dirname(os.path.abspath(__file__))
_BASE_DIR = os.path.dirname(_API_DIR)
MODELS_PATH = os.path.join(_BASE_DIR, 'saved_models')
DATA_PATH = _BASE_DIR

def load_prophet_model(name):
    """Load a Prophet model from pickle."""
    import pickle
    filepath = f'{MODELS_PATH}/prophet_{name}.pkl'
    if os.path.exists(filepath):
        with open(filepath, 'rb') as f:
            return pickle.load(f)
    raise FileNotFoundError(f"Prophet model not found: {name}")

def enrollment_predict(params):
    """Predict enrollment for a specific year and grade."""
    import pandas as pd
    
    year = int(params.get('year', 2027))
    grade = params.get('grade', 'TotalOverall')
    
    safe_name = grade.lower().replace(' ', '_')
    model = load_prophet_model(f'enrollment_{safe_name}')
    future = pd.DataFrame({'ds': [pd.to_datetime(str(year))]})
    forecast = model.predict(future)
    
    return {
        'success': True,
        'year': year,
        'grade': grade,
        'predicted': round(forecast['yhat'].values[0]),
        'lower': round(forecast['yhat_lower'].values[0]),
        'upper': round(forecast['yhat_upper'].values[0])
    }

def enrollment_forecast(params):
    """Forecast enrollment for multiple years."""
    import pandas as pd
    
    years = int(params.get('years', 5))
    grade = params.get('grade', 'TotalOverall')
    
    df = pd.read_csv(f'{DATA_PATH}/enrollment_data.txt')
    base_year = int(df['Year'].max())
    
    safe_name = grade.lower().replace(' ', '_')
    future_years = [base_year + i + 1 for i in range(years)]
    
    model = load_prophet_model(f'enrollment_{safe_name}')
    future = pd.DataFrame({'ds': pd.to_datetime([str(y) for y in future_years])})
    forecast = model.predict(future)
    
    predictions = []
    for i, year in enumerate(future_years):
        predictions.append({
            'year': year,
            'predicted': round(forecast['yhat'].values[i]),
            'lower': round(forecast['yhat_lower'].values[i]),
            'upper': round(forecast['yhat_upper'].values[i])
        })
    
    return {
        'success': True,
        'grade': grade,
        'base_year': base_year,
        'forecast': predictions
    }

def payment_predict(params):
    """Predict payment for a specific year."""
    import pandas as pd
    
    year = int(params.get('year', 2027))
    model = load_prophet_model('payment')
    future = pd.DataFrame({'ds': [pd.to_datetime(str(year))]})
    forecast = model.predict(future)
    
    return {
        'success': True,
        'year': year,
        'predicted': round(forecast['yhat'].values[0], 2),
        'lower': round(forecast['yhat_lower'].values[0], 2),
        'upper': round(forecast['yhat_upper'].values[0], 2)
    }

def payment_forecast(params):
    """Forecast payment for multiple years."""
    import pandas as pd
    
    years = int(params.get('years', 5))
    df = pd.read_csv(f'{DATA_PATH}/enrollment_data.txt')
    base_year = int(df['Year'].max())
    future_years = [base_year + i + 1 for i in range(years)]
    
    model = load_prophet_model('payment')
    future = pd.DataFrame({'ds': pd.to_datetime([str(y) for y in future_years])})
    forecast = model.predict(future)
    
    predictions = []
    for i, year in enumerate(future_years):
        predictions.append({
            'year': year,
            'predicted': round(forecast['yhat'].values[i], 2),
            'lower': round(forecast['yhat_lower'].values[i], 2),
            'upper': round(forecast['yhat_upper'].values[i], 2)
        })
    
    return {
        'success': True,
        'base_year': base_year,
        'forecast': predictions
    }

def get_historical(params):
    """Get historical enrollment and payment data."""
    import pandas as pd
    
    df = pd.read_csv(f'{DATA_PATH}/enrollment_data.txt')
    df = df[(df['Year'] >= 2018) & (df['Year'] <= 2025)]
    return {
        'success': True,
        'years': df['Year'].tolist(),
        'data': df.to_dict(orient='records')
    }

def get_model_metrics(params):
    """Get trained model metrics."""
    metrics_path = f'{MODELS_PATH}/prophet_metrics.json'
    
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        return {'success': True, 'metrics': metrics}
    
    return {'success': False, 'error': 'Metrics not found'}

# Main entry point
if __name__ == '__main__':
    # Read JSON from stdin (called by index.php via proc_open)
    raw = sys.stdin.read().strip()
    if raw:
        try:
            payload = json.loads(raw)
            action = payload.get('action', '')
            params = payload.get('params', {})
        except json.JSONDecodeError:
            print(json.dumps({'error': 'Invalid JSON input'}))
            sys.exit(1)
    elif len(sys.argv) >= 2:
        # Fallback: command-line args (e.g. python predictor.py enrollment_predict year=2027)
        action = sys.argv[1]
        params = {}
        for i in range(2, len(sys.argv)):
            if '=' in sys.argv[i]:
                key, value = sys.argv[i].split('=', 1)
                params[key] = value
    else:
        print(json.dumps({'error': 'No action specified'}))
        sys.exit(1)
    
    # Execute the action
    actions = {
        'enrollment_predict': enrollment_predict,
        'enrollment_forecast': enrollment_forecast,
        'payment_predict': payment_predict,
        'payment_forecast': payment_forecast,
        'get_historical': get_historical,
        'get_model_metrics': get_model_metrics
    }
    
    if action in actions:
        try:
            result = actions[action](params)
            print(json.dumps(result))
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))
    else:
        print(json.dumps({'error': f'Unknown action: {action}'}))
