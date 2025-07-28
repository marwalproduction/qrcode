// Vercel-compatible API for QR-login autofill
// Adapted from the original server.js

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const shareRouter = require('./share');
app.use('/share', shareRouter);

// Root route handler
app.get('/', (req, res) => {
  console.log('Root endpoint hit');
  res.send(`
    <html>
    <head>
      <title>Zapkey - QR Code Sharing</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          margin: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        h1 { 
          font-size: 3em; 
          margin-bottom: 20px;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        p { 
          font-size: 1.2em; 
          margin-bottom: 30px;
          line-height: 1.6;
        }
        .btn {
          display: inline-block;
          background: rgba(255,255,255,0.2);
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 50px;
          font-size: 1.1em;
          transition: all 0.3s ease;
          border: 2px solid rgba(255,255,255,0.3);
        }
        .btn:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔑 Zapkey</h1>
        <p>Share files, URLs, and credentials instantly via QR codes. Scan the QR code with your mobile device to receive shared content.</p>
        <a href="/share" class="btn">Start Sharing</a>
      </div>
    </body>
    </html>
  `);
});

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

// GET /api/share/poll - Alternative endpoint for shared data polling
app.get('/api/share/poll', (req, res) => {
  console.log('API share poll endpoint hit with sid:', req.query.sid);
  const { sid } = req.query;
  if (!sid) return res.status(400).json({ error: 'Missing sid' });
  
  // Import the share router's session management
  const shareSessions = global._shareSessions || new Map();
  const sessionTimeouts = global._sessionTimeouts || new Map();
  
  const timestamp = sessionTimeouts.get(sid);
  if (!timestamp) {
    console.log('No session timeout found for sid:', sid);
    return res.json({ status: 'waiting' });
  }
  
  const now = Date.now();
  const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  if (now - timestamp > SESSION_TIMEOUT) {
    // Session expired, clean up
    console.log('Session expired for sid:', sid);
    shareSessions.delete(sid);
    sessionTimeouts.delete(sid);
    return res.json({ status: 'waiting' });
  }
  
  const shared = shareSessions.get(sid);
  if (!shared) {
    console.log('No shared data found for sid:', sid);
    return res.json({ status: 'waiting' });
  }
  
  console.log('Found shared data for sid:', sid, 'type:', shared.url ? 'url' : 'image');
  // One-time use: clear after sending
  shareSessions.delete(sid);
  sessionTimeouts.delete(sid);
  
  res.json({ status: 'ready', shared });
});


// For Vercel deployment
module.exports = app; 
