// server.js
// Express + WebSocket backend for QR-login autofill

// Polyfill for Object.hasOwn on older Node.js versions
if (typeof Object.hasOwn !== 'function') {
  Object.hasOwn = (obj, prop) =>
    Object.prototype.hasOwnProperty.call(obj, prop);
}

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory store: sid -> { qrData, wsClients[] }
const sessions = new Map();

// POST /sessions
// Expects JSON body: { sid: string, url: string }
// Returns { qrData: "data:image/..." }
app.post('/sessions', async (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({ error: 'Expected JSON body with { sid, url }' });
  }
  const { sid, url } = req.body;
  if (!sid || !url) {
    return res.status(400).json({ error: 'Missing required fields sid or url' });
  }

  // Generate verify URL for QR
  const host = req.get('host');       // e.g. "project.glitch.me"
  const proto = req.protocol;          // "https"
  const verifyUrl = `${proto}://${host}/verify?sid=${sid}&url=${encodeURIComponent(url)}`;
  try {
    const qrData = await QRCode.toDataURL(verifyUrl);
    sessions.set(sid, { qrData, wsClients: [] });
    res.json({ qrData });
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// POST /sessions/:sid/credentials
// Expects JSON body: { username: string, password: string, url: string }
app.post('/sessions/:sid/credentials', (req, res) => {
  const { sid } = req.params;
  const { username, password, url } = req.body || {};
  const session = sessions.get(sid);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!username || !password || !url) {
    return res.status(400).json({ error: 'Missing username, password, or url' });
  }

  // Broadcast to connected WebSocket clients (the extension)
  session.wsClients.forEach(ws => {
    ws.send(JSON.stringify({
      action: 'fillCredentials',
      sid,
      username,
      password,
      url
    }));
  });
  res.json({ status: 'ok' });
});

// GET /verify?sid=...&url=...
app.get('/verify', (req, res) => {
  const { sid, url } = req.query;
  res.send(`
    <html><body>
      <h1>Scan received!</h1>
      <p>sid = ${sid}</p>
      <p>url = ${url}</p>
    </body></html>
  `);
});

// Start HTTP server & WebSocket on same port
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

// WebSocket server at /ws
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', ws => {
  ws.on('message', msg => {
    try {
      const { sid } = JSON.parse(msg);
      const session = sessions.get(sid);
      if (session) session.wsClients.push(ws);
    } catch (e) {
      console.warn('Bad WS message:', e);
    }
  });
});
