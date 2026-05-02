# Sentiment Analysis API Configuration

## Overview

The sentiment analysis system supports two modes:
1. **Local Mode**: Uses your own Python CNN+BiLSTM model (port 5000)
2. **External Mode**: Uses Hugging Face multilingual sentiment API
3. **Auto Mode**: Tries local first, falls back to external if local is unavailable

The PHP backend acts as a **proxy** to avoid CORS issues and securely manage API tokens.

---

## Configuration

### Backend (PHP)

Edit `LavaLust/app/config/config.php`:

```php
// Sentiment API Mode: 'local' | 'external' | 'auto'
$config['sentiment_api_mode'] = 'local';

// Local Python API URL
$config['sentiment_local_url'] = 'http://localhost:5000';

// Hugging Face API Token (set as environment variable for security)
$config['sentiment_hf_token'] = getenv('HF_API_TOKEN') ?: '';

// Hugging Face API URL
$config['sentiment_hf_url'] = 'https://router.huggingface.co/hf-inference/models/tabularisai/multilingual-sentiment-analysis';
```

### Setting Hugging Face Token

**Option 1: Environment Variable (Recommended)**
```bash
# Windows (PowerShell)
$env:HF_API_TOKEN="hf_your_token_here"

# Linux/Mac
export HF_API_TOKEN="hf_your_token_here"
```

**Option 2: Hardcode in config.php (Development Only)**
```php
$config['sentiment_hf_token'] = 'hf_your_token_here';
```

---

## API Modes

### Local Mode (Development/Demo)
```php
$config['sentiment_api_mode'] = 'local';
```
- Uses your Python CNN+BiLSTM model
- Requires Python sentiment API running on port 5000
- Perfect for capstone demo
- Shows your ML expertise

**Start Local API:**
```bash
cd saved_models
python sentiment_api.py
```

### External Mode (Production)
```php
$config['sentiment_api_mode'] = 'external';
```
- Uses Hugging Face multilingual model
- No local Python server needed
- Supports 23 languages including Tagalog
- Reliable for production deployment
- Requires HF API token

### Auto Mode (Best of Both)
```php
$config['sentiment_api_mode'] = 'auto';
```
- Tries local Python API first
- Falls back to Hugging Face if local is down
- Perfect for development with production fallback

---

## API Endpoints

All sentiment requests go through PHP backend at `http://localhost:3000/api/sentiment`

### Health Check
```
GET /api/sentiment/health
```
Response:
```json
{
  "success": true,
  "message": "Sentiment service online",
  "status": {
    "mode": "local",
    "local": "online",
    "external": "configured",
    "active": "local"
  }
}
```

### Single Text Prediction
```
POST /api/sentiment/predict
Content-Type: application/json

{
  "text": "I love this system!"
}
```
Response:
```json
{
  "success": true,
  "sentiment": "positive",
  "confidence": 0.95,
  "probabilities": {
    "positive": 0.95,
    "neutral": 0.03,
    "negative": 0.02
  }
}
```

### Batch Prediction
```
POST /api/sentiment/predict/batch
Content-Type: application/json

{
  "texts": ["Great service!", "Could be better", "Terrible experience"]
}
```
Response:
```json
{
  "success": true,
  "results": [
    {
      "sentiment": "positive",
      "confidence": 0.92,
      "probabilities": {"positive": 0.92, "neutral": 0.06, "negative": 0.02}
    },
    {
      "sentiment": "neutral",
      "confidence": 0.78,
      "probabilities": {"positive": 0.15, "neutral": 0.78, "negative": 0.07}
    },
    {
      "sentiment": "negative",
      "confidence": 0.88,
      "probabilities": {"positive": 0.03, "neutral": 0.09, "negative": 0.88}
    }
  ]
}
```

---

## Frontend Usage

The frontend automatically uses the PHP proxy. No additional configuration needed!

```typescript
// Health check
fetch('/api/sentiment/health')

// Single prediction
fetch('/api/sentiment/predict', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Hello world' })
})

// Batch prediction
fetch('/api/sentiment/predict/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ texts: ['text1', 'text2'] })
})
```

---

## Troubleshooting

### "Model Offline" Error

**For Local Mode:**
1. Check Python API is running: `python sentiment_api.py`
2. Verify it's accessible: `curl http://localhost:5000/health`
3. Check firewall/antivirus isn't blocking port 5000

**For External Mode:**
1. Verify HF token is set: `echo $env:HF_API_TOKEN`
2. Check token is valid at https://huggingface.co/settings/tokens
3. Ensure server can reach router.huggingface.co

**For Auto Mode:**
- System will automatically fallback to external if local fails

### CORS Errors

✅ **Resolved!** PHP backend handles all API calls - no direct browser → external API calls.

### Slow Predictions

- **Local**: Python model may need GPU acceleration
- **External**: HF API can be slow on first request (cold start)
- **Solution**: Use 'auto' mode for best performance

---

## Deployment Checklist

### Development
- [x] Set mode to `'local'` or `'auto'`
- [x] Start Python sentiment API
- [x] Start PHP backend
- [x] Start React frontend

### Production
- [x] Set mode to `'external'` or `'auto'`
- [x] Set `HF_API_TOKEN` environment variable
- [x] Remove hardcoded tokens from code
- [x] Test health endpoint
- [x] Deploy PHP backend
- [x] Deploy React frontend

---

## Security Notes

⚠️ **Never commit API tokens to Git!**

✅ **Best Practices:**
- Use environment variables for tokens
- Set `HF_API_TOKEN` on server
- Keep `config.php` token line as `getenv('HF_API_TOKEN')`
- Add `.env` files to `.gitignore`

---

## Model Comparison

| Feature | Local (CNN+BiLSTM) | External (Hugging Face) |
|---------|-------------------|------------------------|
| Languages | English | 23 languages (including Tagalog) |
| Classes | 3 (pos/neu/neg) | 5 mapped to 3 |
| Speed | Fast (local) | Slower (API call) |
| Cost | Free | Free tier available |
| Reliability | Depends on server | High (cloud-hosted) |
| Setup | Requires Python | Just API token |
| Best For | Demo/Development | Production |

---

## Support

For issues:
1. Check PHP server is running
2. Check API mode configuration
3. Test health endpoint
4. Check logs in browser console
5. Verify network connectivity

