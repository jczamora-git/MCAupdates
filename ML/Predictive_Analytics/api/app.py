# ============================================================
# Flask API for School Enrollment & Payment Prediction
# This API serves predictions from Prophet models
# ============================================================

from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import os
import json
from prophet import Prophet
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app)

# Grade columns
GRADE_COLUMNS = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 
                 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6']

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, 'saved_models')
DATA_PATH = os.path.join(BASE_DIR, 'enrollment_data.txt')

# Store loaded models
models = {}
enrollment_df = None

def load_data():
    """Load enrollment data"""
    global enrollment_df
    enrollment_df = pd.read_csv(DATA_PATH)
    enrollment_df = enrollment_df[(enrollment_df['Year'] >= 2018) & (enrollment_df['Year'] <= 2025)]
    print(f"Loaded data: {len(enrollment_df)} years ({enrollment_df['Year'].min()}-{enrollment_df['Year'].max()})")
    return enrollment_df

def train_model(column_name):
    """Train a Prophet model for a specific column"""
    df = load_data()
    df_prophet = df[['Year', column_name]].copy()
    df_prophet.columns = ['ds', 'y']
    df_prophet['ds'] = pd.to_datetime(df_prophet['ds'], format='%Y')
    
    model = Prophet(
        yearly_seasonality=False,
        weekly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.1
    )
    model.fit(df_prophet)
    return model

def get_model(model_key, column_name):
    """Get or train a model"""
    global models
    if model_key not in models:
        print(f"Training model for {column_name}...")
        models[model_key] = train_model(column_name)
        print(f"  [OK] {column_name}")
    return models[model_key]

def load_models():
    """Pre-train all models"""
    global models
    
    print("Initializing Prophet models...")
    load_data()
    
    # Train enrollment models
    for grade in GRADE_COLUMNS + ['TotalOverall']:
        safe_name = grade.lower().replace(' ', '_')
        models[f'enrollment_{safe_name}'] = train_model(grade)
        print(f"  [OK] {grade}")
    
    # Train payment model
    models['payment'] = train_model('Total_Payment')
    print(f"  [OK] Payment")
    
    print(f"\nModels ready: {len(models)}")

# Load models when app starts
load_models()

@app.route('/')
def home():
    """API Home"""
    return jsonify({
        'status': 'online',
        'message': 'School Enrollment & Payment Prediction API (Prophet)',
        'models_loaded': len(models),
        'endpoints': {
            '/api/grades': 'GET - List all grade levels',
            '/api/predict': 'GET - Predict enrollment (params: year, grade)',
            '/api/predict/all': 'GET - Predict all grades (params: year)',
            '/api/forecast': 'GET - Get multi-year forecast (params: grade, years)',
            '/api/forecast/all': 'GET - Get forecast for all grades (params: years)',
            '/api/payment/predict': 'GET - Predict payment (params: year)',
            '/api/payment/forecast': 'GET - Forecast payment (params: years)',
            '/api/historical': 'GET - Get historical data',
            '/api/metrics': 'GET - Get model metrics'
        }
    })

@app.route('/api/grades')
def get_grades():
    """Return list of available grade levels"""
    return jsonify({
        'status': 'success',
        'grades': GRADE_COLUMNS,
        'count': len(GRADE_COLUMNS)
    })

@app.route('/api/predict')
def predict_single():
    """Predict enrollment for a specific year and grade"""
    year = request.args.get('year', type=int)
    grade = request.args.get('grade', type=str)
    
    if not year:
        return jsonify({'status': 'error', 'message': 'Year parameter required'}), 400
    if not grade:
        return jsonify({'status': 'error', 'message': 'Grade parameter required'}), 400
    
    safe_name = grade.lower().replace(' ', '_')
    model_key = f'enrollment_{safe_name}'
    
    if model_key not in models:
        return jsonify({'status': 'error', 'message': f'Model not found: {grade}'}), 400
    
    model = models[model_key]
    future_df = pd.DataFrame({'ds': pd.to_datetime([year], format='%Y')})
    forecast = model.predict(future_df)
    
    return jsonify({
        'status': 'success',
        'year': year,
        'grade': grade,
        'prediction': int(round(forecast['yhat'].values[0])),
        'lower_bound': int(round(forecast['yhat_lower'].values[0])),
        'upper_bound': int(round(forecast['yhat_upper'].values[0]))
    })

@app.route('/api/predict/all')
def predict_all():
    """Predict enrollment for all grades for a specific year"""
    year = request.args.get('year', type=int)
    
    if not year:
        return jsonify({'status': 'error', 'message': 'Year parameter required'}), 400
    
    predictions = []
    for grade in GRADE_COLUMNS:
        safe_name = grade.lower().replace(' ', '_')
        model_key = f'enrollment_{safe_name}'
        
        if model_key in models:
            model = models[model_key]
            future_df = pd.DataFrame({'ds': pd.to_datetime([year], format='%Y')})
            forecast = model.predict(future_df)
            
            predictions.append({
                'grade': grade,
                'prediction': int(round(forecast['yhat'].values[0])),
                'lower_bound': int(round(forecast['yhat_lower'].values[0])),
                'upper_bound': int(round(forecast['yhat_upper'].values[0]))
            })
    
    # Total Overall
    if 'enrollment_totaloverall' in models:
        model = models['enrollment_totaloverall']
        future_df = pd.DataFrame({'ds': pd.to_datetime([year], format='%Y')})
        forecast = model.predict(future_df)
        total = int(round(forecast['yhat'].values[0]))
    else:
        total = sum(p['prediction'] for p in predictions)
    
    return jsonify({
        'status': 'success',
        'year': year,
        'predictions': predictions,
        'total': total
    })

@app.route('/api/forecast')
def forecast_grade():
    """Forecast enrollment for multiple years"""
    grade = request.args.get('grade', default='TotalOverall', type=str)
    years = request.args.get('years', default=5, type=int)
    
    safe_name = grade.lower().replace(' ', '_')
    model_key = f'enrollment_{safe_name}'
    
    if model_key not in models:
        return jsonify({'status': 'error', 'message': f'Model not found: {grade}'}), 400
    
    df = pd.read_csv(DATA_PATH)
    base_year = int(df['Year'].max())
    future_years = [base_year + i + 1 for i in range(years)]
    
    model = models[model_key]
    future_df = pd.DataFrame({'ds': pd.to_datetime(future_years, format='%Y')})
    forecast = model.predict(future_df)
    
    predictions = []
    for i, year in enumerate(future_years):
        predictions.append({
            'year': year,
            'prediction': int(round(forecast['yhat'].values[i])),
            'lower_bound': int(round(forecast['yhat_lower'].values[i])),
            'upper_bound': int(round(forecast['yhat_upper'].values[i]))
        })
    
    return jsonify({
        'status': 'success',
        'grade': grade,
        'base_year': base_year,
        'forecast': predictions
    })

@app.route('/api/forecast/all')
def forecast_all():
    """Forecast enrollment for all grades"""
    years = request.args.get('years', default=5, type=int)
    
    df = pd.read_csv(DATA_PATH)
    base_year = int(df['Year'].max())
    future_years = [base_year + i + 1 for i in range(years)]
    
    all_forecasts = {}
    for grade in GRADE_COLUMNS + ['TotalOverall']:
        safe_name = grade.lower().replace(' ', '_')
        model_key = f'enrollment_{safe_name}'
        
        if model_key in models:
            model = models[model_key]
            future_df = pd.DataFrame({'ds': pd.to_datetime(future_years, format='%Y')})
            forecast = model.predict(future_df)
            
            all_forecasts[grade] = []
            for i, year in enumerate(future_years):
                all_forecasts[grade].append({
                    'year': year,
                    'prediction': int(round(forecast['yhat'].values[i])),
                    'lower_bound': int(round(forecast['yhat_lower'].values[i])),
                    'upper_bound': int(round(forecast['yhat_upper'].values[i]))
                })
    
    return jsonify({
        'status': 'success',
        'base_year': base_year,
        'forecast_years': years,
        'forecasts': all_forecasts
    })

@app.route('/api/payment/predict')
def predict_payment():
    """Predict payment for a specific year"""
    year = request.args.get('year', type=int)
    
    if not year:
        return jsonify({'status': 'error', 'message': 'Year parameter required'}), 400
    
    if 'payment' not in models:
        return jsonify({'status': 'error', 'message': 'Payment model not found'}), 400
    
    model = models['payment']
    future_df = pd.DataFrame({'ds': pd.to_datetime([year], format='%Y')})
    forecast = model.predict(future_df)
    
    return jsonify({
        'status': 'success',
        'year': year,
        'prediction': round(forecast['yhat'].values[0], 2),
        'lower_bound': round(forecast['yhat_lower'].values[0], 2),
        'upper_bound': round(forecast['yhat_upper'].values[0], 2)
    })

@app.route('/api/payment/forecast')
def forecast_payment():
    """Forecast payment for multiple years"""
    years = request.args.get('years', default=5, type=int)
    
    if 'payment' not in models:
        return jsonify({'status': 'error', 'message': 'Payment model not found'}), 400
    
    df = pd.read_csv(DATA_PATH)
    base_year = int(df['Year'].max())
    future_years = [base_year + i + 1 for i in range(years)]
    
    model = models['payment']
    future_df = pd.DataFrame({'ds': pd.to_datetime(future_years, format='%Y')})
    forecast = model.predict(future_df)
    
    predictions = []
    for i, year in enumerate(future_years):
        predictions.append({
            'year': year,
            'prediction': round(forecast['yhat'].values[i], 2),
            'lower_bound': round(forecast['yhat_lower'].values[i], 2),
            'upper_bound': round(forecast['yhat_upper'].values[i], 2)
        })
    
    return jsonify({
        'status': 'success',
        'base_year': base_year,
        'forecast': predictions
    })

@app.route('/api/historical')
def get_historical():
    """Get historical enrollment and payment data"""
    df = pd.read_csv(DATA_PATH)
    df = df[(df['Year'] >= 2018) & (df['Year'] <= 2025)]
    return jsonify({
        'status': 'success',
        'years': df['Year'].tolist(),
        'data': df.to_dict(orient='records'),
        'grades': GRADE_COLUMNS
    })

@app.route('/api/metrics')
def get_metrics():
    """Get model performance metrics"""
    metrics_path = os.path.join(MODEL_PATH, 'prophet_metrics.json')
    
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            metrics = json.load(f)
        return jsonify({
            'status': 'success',
            'metrics': metrics
        })
    
    return jsonify({
        'status': 'error',
        'message': 'Metrics not found'
    }), 404

@app.route('/api/analysis/minmax')
def analysis_minmax():
    """Get min/max enrollment analysis from historical data"""
    df = load_data()
    
    results = []
    for grade in GRADE_COLUMNS:
        max_idx = df[grade].idxmax()
        min_idx = df[grade].idxmin()
        
        results.append({
            'grade': grade,
            'max_year': int(df.loc[max_idx, 'Year']),
            'max_value': int(df.loc[max_idx, grade]),
            'min_year': int(df.loc[min_idx, 'Year']),
            'min_value': int(df.loc[min_idx, grade])
        })
    
    # Overall total
    max_idx = df['TotalOverall'].idxmax()
    min_idx = df['TotalOverall'].idxmin()
    results.append({
        'grade': 'Total Overall',
        'max_year': int(df.loc[max_idx, 'Year']),
        'max_value': int(df.loc[max_idx, 'TotalOverall']),
        'min_year': int(df.loc[min_idx, 'Year']),
        'min_value': int(df.loc[min_idx, 'TotalOverall'])
    })
    
    return jsonify({
        'status': 'success',
        'analysis': results
    })

@app.route('/api/forecast/minmax')
def forecast_minmax():
    """Get min/max enrollment from forecasted data"""
    years = request.args.get('years', 5, type=int)
    start_year = request.args.get('start_year', 2027, type=int)
    
    results = []
    for grade in GRADE_COLUMNS:
        safe_name = grade.lower().replace(' ', '_')
        model_key = f'enrollment_{safe_name}'
        
        if model_key in models:
            model = models[model_key]
            future_years = list(range(start_year, start_year + years))
            future_df = pd.DataFrame({'ds': pd.to_datetime(future_years, format='%Y')})
            forecast = model.predict(future_df)
            
            max_idx = forecast['yhat'].idxmax()
            min_idx = forecast['yhat'].idxmin()
            
            results.append({
                'grade': grade,
                'max_year': future_years[max_idx],
                'max_value': int(round(forecast.loc[max_idx, 'yhat'])),
                'min_year': future_years[min_idx],
                'min_value': int(round(forecast.loc[min_idx, 'yhat']))
            })
    
    # Total Overall
    if 'enrollment_totaloverall' in models:
        model = models['enrollment_totaloverall']
        future_years = list(range(start_year, start_year + years))
        future_df = pd.DataFrame({'ds': pd.to_datetime(future_years, format='%Y')})
        forecast = model.predict(future_df)
        
        max_idx = forecast['yhat'].idxmax()
        min_idx = forecast['yhat'].idxmin()
        
        results.append({
            'grade': 'Total Overall',
            'max_year': future_years[max_idx],
            'max_value': int(round(forecast.loc[max_idx, 'yhat'])),
            'min_year': future_years[min_idx],
            'min_value': int(round(forecast.loc[min_idx, 'yhat']))
        })
    
    return jsonify({
        'status': 'success',
        'start_year': start_year,
        'years': years,
        'analysis': results
    })

@app.route('/api/analysis/trends')
def analysis_trends():
    """Get enrollment trend analysis"""
    df = load_data()
    
    trends = []
    for grade in GRADE_COLUMNS:
        values = df[grade].tolist()
        years = df['Year'].tolist()
        
        # Calculate trend (linear regression slope)
        if len(values) > 1:
            x = np.array(years)
            y = np.array(values)
            slope = np.polyfit(x, y, 1)[0]
            
            # Calculate average growth rate
            growth_rates = [(values[i] - values[i-1]) / values[i-1] * 100 
                           for i in range(1, len(values)) if values[i-1] != 0]
            avg_growth = np.mean(growth_rates) if growth_rates else 0
            
            trends.append({
                'grade': grade,
                'trend': 'increasing' if slope > 0 else 'decreasing',
                'slope': round(slope, 3),
                'avg_growth_rate': round(avg_growth, 2),
                'current_value': int(values[-1]),
                'start_value': int(values[0])
            })
    
    # Total Overall
    values = df['TotalOverall'].tolist()
    years = df['Year'].tolist()
    slope = np.polyfit(np.array(years), np.array(values), 1)[0]
    growth_rates = [(values[i] - values[i-1]) / values[i-1] * 100 
                   for i in range(1, len(values)) if values[i-1] != 0]
    avg_growth = np.mean(growth_rates) if growth_rates else 0
    
    trends.append({
        'grade': 'Total Overall',
        'trend': 'increasing' if slope > 0 else 'decreasing',
        'slope': round(slope, 3),
        'avg_growth_rate': round(avg_growth, 2),
        'current_value': int(values[-1]),
        'start_value': int(values[0])
    })
    
    return jsonify({
        'status': 'success',
        'trends': trends
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
