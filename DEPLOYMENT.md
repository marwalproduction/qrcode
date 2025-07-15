# ZapKey QR Login Backend - Vercel Deployment

## 🚀 Quick Deploy to Vercel

Your backend is now configured for Vercel deployment at `https://qrcode-yktu.vercel.app/`

### Steps to Deploy:

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy the project**:
   ```bash
   vercel --prod
   ```

4. **Or deploy to your existing project**:
   ```bash
   vercel --prod --name qrcode-yktu
   ```

## 🔧 API Endpoints

### Health Check
- `GET https://qrcode-yktu.vercel.app/`
- Returns server status

### Create Session & Generate QR
- `POST https://qrcode-yktu.vercel.app/api/sessions`
- Body: `{ "sid": "session-id", "url": "https://example.com" }`
- Returns: `{ "qrData": "data:image/png;base64,..." }`

### Submit Credentials (Mobile App)
- `POST https://qrcode-yktu.vercel.app/api/sessions/:sid/credentials`
- Body: `{ "username": "user", "password": "pass", "url": "https://example.com" }`

### Poll for Credentials (Extension)
- `GET https://qrcode-yktu.vercel.app/api/sessions/:sid/credentials`
- Returns: `{ "status": "waiting" }` or `{ "status": "ready", "credentials": {...} }`

### QR Verification Page
- `GET https://qrcode-yktu.vercel.app/api/verify?sid=...&url=...`
- Shows verification page when QR is scanned

## 🧪 Testing the API

### Test QR Generation:
```bash
curl -X POST https://qrcode-yktu.vercel.app/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"sid": "test-session", "url": "https://example.com"}'
```

### Test Credential Submission:
```bash
curl -X POST https://qrcode-yktu.vercel.app/api/sessions/test-session/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass", "url": "https://example.com"}'
```

### Test Credential Polling:
```bash
curl https://qrcode-yktu.vercel.app/api/sessions/test-session/credentials
```

## 🔄 How It Works

1. **Extension** creates a session and gets QR code
2. **User** scans QR code with mobile app
3. **Mobile app** submits credentials to `/api/sessions/:sid/credentials`
4. **Extension** polls `/api/sessions/:sid/credentials` every 2 seconds
5. **Extension** receives credentials and auto-fills the form

## ⚠️ Important Notes

- **No WebSockets**: Vercel serverless functions don't support WebSockets, so we use polling instead
- **Session Storage**: Sessions are stored in memory and will reset on cold starts
- **Polling**: Extension polls every 2 seconds for credentials
- **One-time Use**: Credentials are cleared after being retrieved

## 🛠️ Troubleshooting

### 404 Error:
- Make sure all files are committed
- Check that `api/index.js` exists
- Verify `vercel.json` configuration

### CORS Issues:
- CORS is enabled for all origins
- Check browser console for CORS errors

### Polling Not Working:
- Check network tab for failed requests
- Verify the session ID is correct
- Check server logs in Vercel dashboard

## 📱 Mobile App Integration

Your mobile app should:
1. Scan the QR code
2. Extract the verification URL
3. Submit credentials to `/api/sessions/:sid/credentials`

Example mobile app request:
```javascript
fetch(`https://qrcode-yktu.vercel.app/api/sessions/${sessionId}/credentials`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'user@example.com',
    password: 'password123',
    url: 'https://example.com/login'
  })
});
``` 