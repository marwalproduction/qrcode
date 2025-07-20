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
    <html>
    <head>
      <title>Share with ZapKey</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f7f8fa; margin: 0; padding: 0; }
        .container { max-width: 420px; margin: 32px auto; background: #fff; border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); padding: 28px 18px 22px 18px; display: flex; flex-direction: column; align-items: center; }
        h2 { color: #007bff; margin-bottom: 18px; font-size: 2rem; }
        label { font-size: 1.1rem; color: #222; margin-bottom: 6px; display: block; }
        input[type="url"], input[type="file"] { width: 100%; margin-bottom: 18px; padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 1rem; }
        input[type="file"] { padding: 6px; }
        button { padding: 12px 28px; border-radius: 8px; border: none; background: #007bff; color: #fff; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-top: 10px; }
        button:active { background: #0056b3; }
        @media (max-width: 500px) {
          .container { max-width: 98vw; padding: 18px 4vw; }
          h2 { font-size: 1.3rem; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Share with ZapKey</h2>
        <form method="POST" enctype="multipart/form-data">
          <input type="hidden" name="sid" value="${sid}" />
          <label>Share a URL:</label>
          <input type="url" name="url" placeholder="https://example.com" autocomplete="off" />
          <label>Or upload an image:</label>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" />
          <button type="submit">Share</button>
        </form>
      </div>
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
