# Quick script to retrain and save Prophet models
import pandas as pd
import joblib
import os
from prophet import Prophet
import warnings
warnings.filterwarnings('ignore')

# Base directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(BASE_DIR)

# Paths
DATA_PATH = os.path.join(PARENT_DIR, 'enrollment_data.txt')
MODEL_PATH = os.path.join(PARENT_DIR, 'saved_model')
MODEL_PATH_V2 = os.path.join(PARENT_DIR, 'saved_models')

# Create model directories if not exists
os.makedirs(MODEL_PATH, exist_ok=True)
os.makedirs(MODEL_PATH_V2, exist_ok=True)

# Grade columns
GRADE_COLUMNS = ['Nursery 1', 'Nursery 2', 'Kinder', 'Grade 1', 'Grade 2', 
                 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'TotalOverall']

print("=" * 50)
print("Retraining Prophet Models")
print("=" * 50)

# Load data
df = pd.read_csv(DATA_PATH)
print(f"Loaded data: {len(df)} rows")

# Train and save model for each grade
for grade in GRADE_COLUMNS:
    print(f"\nTraining model for: {grade}...")
    
    # Prepare data
    prophet_df = pd.DataFrame({
        'ds': pd.to_datetime(df['Year'], format='%Y'),
        'y': df[grade].values
    })
    
    # Train model
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode='additive'
    )
    model.fit(prophet_df)
    
    # Save model (both naming conventions)
    safe_name = grade.lower().replace(' ', '_')
    
    # Format 1: for retrain script location
    filepath1 = os.path.join(MODEL_PATH, f'{safe_name}_prophet_model.pkl')
    joblib.dump(model, filepath1)
    print(f"  ✓ Saved: {filepath1}")
    
    # Format 2: for predictor.py expected format
    filepath2 = os.path.join(MODEL_PATH_V2, f'prophet_enrollment_{safe_name}.pkl')
    joblib.dump(model, filepath2)
    print(f"  ✓ Saved: {filepath2}")

# Train payment model
print(f"\nTraining model for: Total_Payment...")
if 'Total_Payment' in df.columns:
    prophet_df = pd.DataFrame({
        'ds': pd.to_datetime(df['Year'], format='%Y'),
        'y': df['Total_Payment'].values
    })
    
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode='additive'
    )
    model.fit(prophet_df)
    
    # Save payment model
    filepath = os.path.join(MODEL_PATH_V2, 'prophet_payment.pkl')
    joblib.dump(model, filepath)
    print(f"  ✓ Saved: {filepath}")

print("\n" + "=" * 50)
print("All models retrained and saved!")
print("=" * 50)
