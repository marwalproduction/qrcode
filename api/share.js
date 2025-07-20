const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// In-memory store for shared data (for demo, not persistent)
const sessions = global._shareSessions = global._shareSessions || new Map();

// Multer setup for file uploads (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 2MB limit

// Serve the share page (GET)
app.get('/', (req, res) => {
  const { sid } = req.query;
  if (!sid) {
    return res.status(400).send('Missing session ID (sid)');
  }
  res.send(`
    <html><head><title>Share with ZapKey</title></head><body style="font-family:sans-serif;max-width:400px;margin:40px auto;">
      <h2>Share with ZapKey</h2>
      <form method="POST" enctype="multipart/form-data">
        <input type="hidden" name="sid" value="${sid}" />
        <div style="margin-bottom:12px;">
          <label>Share a URL:</label><br/>
          <input type="url" name="url" style="width:100%;padding:8px;" placeholder="https://example.com" />
        </div>
        <div style="margin-bottom:12px;">
          <label>Or upload an image:</label><br/>
          <input type="file" name="image" accept="image/*" />
        </div>
        <button type="submit" style="padding:10px 18px;">Share</button>
      </form>
    </body></html>
  `);
});

// Handle form submission (POST)
app.post('/', upload.single('image'), (req, res) => {
  const { sid, url } = req.body;
  if (!sid) return res.status(400).send('Missing session ID (sid)');

  let shared = {};
  if (url && url.startsWith('http')) {
    shared.url = url;
  }
  if (req.file) {
    // Store image as base64 (for demo, not for production)
    shared.image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }
  if (!shared.url && !shared.image) {
    return res.status(400).send('Please provide a URL or upload an image.');
  }
  sessions.set(sid, shared);
  res.send('<h3>Shared successfully! You can close this page.</h3>');
});

// API for extension to poll for shared data
app.get('/poll', (req, res) => {
  const { sid } = req.query;
  if (!sid) return res.status(400).json({ error: 'Missing sid' });
  const shared = sessions.get(sid);
  if (!shared) return res.json({ status: 'waiting' });
  // One-time use: clear after sending
  sessions.delete(sid);
  res.json({ status: 'ready', shared });
});

module.exports = app; 
