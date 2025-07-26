// Vercel-compatible API for QR-login autofill
// Adapted from the original server.js

// Polyfill for Object.hasOwn on older Node.js versions
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = (obj, prop) =>
    Object.prototype.hasOwnProperty.call(obj, prop);
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const shareRouter = require('./share');
app.use('/share', shareRouter);

// In-memory store: sid -> { qrData }
// Note: In serverless, this will reset on each cold start
const sessions = new Map();

// POST /api/sessions
// Expects JSON body: { sid: string, url: string }
// Returns { qrData: "data:image/..." }
app.post('/api/sessions', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Expected JSON body with { sid, url }' });
  }
  const { sid, url } = req.body;
  if (!sid || !url) {
    return res.status(400).json({ error: 'Missing required fields sid or url' });
  }

  // Generate share URL for QR
  const host = req.get('host');       // e.g. "qrcode-yktu.vercel.app"
  const proto = req.protocol;          // "https"
  const shareUrl = `${proto}://${host}/share?sid=${sid}`;
  try {
    const qrData = await QRCode.toDataURL(shareUrl);
    sessions.set(sid, { qrData });
    res.json({ qrData });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// POST /api/sessions/:sid/credentials
// Expects JSON body: { username: string, password: string, url: string }
app.post('/api/sessions/:sid/credentials', (req, res) => {
  const { sid } = req.params;
  const { username, password, url } = req.body || {};
  const session = sessions.get(sid);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!username || !password || !url) {
    return res.status(400).json({ error: 'Missing username, password, or url' });
  }

  // In serverless, we can't use WebSockets directly
  // Instead, we'll store the credentials and the extension can poll
  session.credentials = { username, password, url };
  session.timestamp = new Date().toISOString();
  
  res.json({ status: 'ok', message: 'Credentials stored successfully' });
});

// GET /api/verify?sid=...&url=...
app.get('/api/verify', (req, res) => {
  const { sid, url } = req.query;
  res.send(`
    <html>
    <head>
      <title>QR Login Verification</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .container { max-width: 500px; margin: 0 auto; }
        .success { color: green; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="success">✅ Scan received!</h1>
        <p><strong>Session ID:</strong> ${sid}</p>
        <p><strong>URL:</strong> ${url}</p>
        <p>Your credentials will be sent to the browser extension.</p>
      </div>
    </body>
    </html>
  `);
});

// GET /api/sessions/:sid/credentials
// For the extension to poll for credentials
app.get('/api/sessions/:sid/credentials', (req, res) => {
  const { sid } = req.params;
  const session = sessions.get(sid);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  if (!session.credentials) {
    return res.json({ status: 'waiting' });
  }
  
  // Return credentials and clear them (one-time use)
  const credentials = session.credentials;
  delete session.credentials;
  
  res.json({
    status: 'ready',
    credentials: credentials
  });
});


// For Vercel deployment
module.exports = app; 
