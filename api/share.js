const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// In-memory store for shared data (for demo, not persistent)
const sessions = global._shareSessions = global._shareSessions || new Map();

// Multer setup for file uploads (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Serve the share page with new UI
app.get('/', (req, res) => {
  const { sid } = req.query;
  if (!sid) {
    return res.status(400).send('Missing session ID (sid)');
  }

  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Share with ZapKey</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&family=Manrope:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&family=Inter:wght@400;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Poppins', 'Segoe UI', Arial, sans-serif;
      background: #f7f8fa;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 440px;
      margin: 0 auto;
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
      padding: 8px 18px 28px 18px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
    h2 {
      background: linear-gradient(90deg, #2563eb, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      font-size: 3.5rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
      text-align: left;
      width: 100%;
    }
    .label {
      font-size: 1rem;
      color: #222;
      font-weight: 600;
      margin-top: 20px;
      display: block;
    }
    input[type="url"], input[type="file"] {
      width: 100%;
      padding: 14px 16px;
      font-size: 1rem;
      border: 1.5px solid #d1d5db;
      border-radius: 10px;
      background-color: #f9fafb;
      color: #111827;
      box-sizing: border-box;
      margin-top: 6px;
    }
    .upload-area {
      width: 100%;
      height: 160px;
      border: 2.5px dashed #2563eb55;
      border-radius: 16px;
      background: #f1f5fd;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 18px 0 10px 0;
      cursor: pointer;
    }
    .upload-icon {
      font-size: 3.2rem;
      color: #2563eb;
      margin-bottom: 10px;
    }
    .upload-text {
      color: #6b7280;
      font-size: 1rem;
      font-weight: 400;
      text-align: center;
    }
    .share-btn {
      width: 100%;
      padding: 15px 0;
      border-radius: 10px;
      border: none;
      background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%);
      color: #fff;
      font-size: 1.18rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-top: 18px;
      box-shadow: 0 2px 12px #2563eb22;
      cursor: pointer;
    }
    @media (max-width: 500px) {
      .container { max-width: 98vw; padding: 18px 4vw; }
      h2 { font-size: 2.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h2 style="font-size: 1.4rem; font-weight: 500; color: #111827; text-align: left;">Share everything with</h2>
    <h2>ZapKey</h2>
    <form method="POST" enctype="multipart/form-data" style="width: 100%;">
      <input type="hidden" name="sid" value="${sid}" />
      <label class="label">Share a URL:</label>
      <input type="url" name="url" placeholder="https://example.com" />
      <label class="label">Or upload a file:</label>
      <div class="upload-area" onclick="document.getElementById('file').click();">
        <div class="upload-icon">⬆️</div>
        <div class="upload-text">
          Click or drag file here<br>
          <span style="font-size: 0.8rem;">(PDF, JPG, PNG, WEBP, GIF, up to 10MB)</span>
        </div>
        <input type="file" name="image" id="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" style="display: none;" />
      </div>
      <button type="submit" class="share-btn">Share</button>
    </form>
  </div>
</body>
</html>
  `);
});

// Handle form submission
app.post('/', upload.single('image'), (req, res) => {
  const { sid, url } = req.body;
  if (!sid) return res.status(400).send('Missing session ID (sid)');

  let shared = {};
  if (url && url.startsWith('http')) {
    shared.url = url;
  }
  if (req.file) {
    shared.image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  }

  if (!shared.url && !shared.image) {
    return res.status(400).send('Please provide a URL or upload an image.');
  }

  sessions.set(sid, shared);
  res.send('<h3>Shared successfully! You can close this page.</h3>');
});

// API to poll the data
app.get('/poll', (req, res) => {
  const { sid } = req.query;
  if (!sid) return res.status(400).json({ error: 'Missing sid' });

  const shared = sessions.get(sid);
  if (!shared) return res.json({ status: 'waiting' });

  sessions.delete(sid); // one-time use
  res.json({ status: 'ready', shared });
});

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`ZapKey Share running at http://localhost:${PORT}`);
  });
}

module.exports = app;
