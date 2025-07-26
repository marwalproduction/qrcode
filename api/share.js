const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// In-memory store for shared data (for demo, not persistent)
const sessions = global._shareSessions = global._shareSessions || new Map();

// Multer setup for file uploads (in memory)
const storage = multer.memoryStorage();
// Update multer config for 10MB and more formats
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

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
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Poppins', 'Segoe UI', Arial, sans-serif; background: #f7f8fa; margin: 0; padding: 0; }
        .container { max-width: 440px; margin: 32px auto; background: #fff; border-radius: 18px; box-shadow: 0 4px 24px rgba(0,0,0,0.10); padding: 32px 18px 28px 18px; display: flex; flex-direction: column; align-items: center; }
        h2 { color: #2563eb; margin-bottom: 18px; font-size: 2rem; font-weight: 800; letter-spacing: 0.04em; }
        label { font-size: 1.1rem; color: #222; margin-bottom: 6px; display: block; font-weight: 600; }
        .input-row { width: 100%; margin-bottom: 10px; position: relative; }
        .last-link-tab { display: inline-block; background: #e0e7ff; color: #2563eb; border-radius: 8px; padding: 6px 14px; font-size: 0.98rem; font-weight: 600; margin-bottom: 10px; margin-left: 2px; cursor: pointer; transition: background 0.2s; border: 1.5px solid #2563eb22; }
        .last-link-tab:hover { background: #dbeafe; }
        input[type="url"] { width: 100%; margin-bottom: 0; padding: 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 1.07rem; font-family: inherit; transition: border 0.2s; }
        input[type="url"]:focus { border: 1.5px solid #2563eb; outline: none; }
        .upload-area { width: 100%; height: 160px; border: 2.5px dashed #2563eb55; border-radius: 16px; background: #f1f5fd; display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 18px 0 10px 0; cursor: pointer; position: relative; transition: border 0.2s, background 0.2s; }
        .upload-area.dragover { background: #e0e7ff; border-color: #2563eb; }
        .upload-icon { font-size: 3.2rem; color: #2563eb; margin-bottom: 10px; }
        .upload-text { color: #2563eb; font-size: 1.08rem; font-weight: 600; }
        .file-info { margin-top: 8px; color: #444; font-size: 0.98rem; }
        .file-remove { color: #e11d48; font-size: 0.95rem; margin-left: 10px; cursor: pointer; text-decoration: underline; }
        .file-remove:hover { color: #be123c; }
        .share-btn { width: 100%; padding: 15px 0; border-radius: 10px; border: none; background: linear-gradient(90deg, #2563eb 0%, #3b82f6 100%); color: #fff; font-size: 1.18rem; font-weight: 700; letter-spacing: 0.04em; margin-top: 18px; box-shadow: 0 2px 12px #2563eb22; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s, background 0.2s; position: relative; overflow: hidden; }
        .share-btn:active { transform: scale(0.97); box-shadow: 0 1px 4px #2563eb22; }
        .share-btn .wave { position: absolute; left: 50%; top: 50%; width: 200%; height: 200%; background: radial-gradient(circle, #fff5 0%, #2563eb00 80%); transform: translate(-50%, -50%) scale(0); opacity: 0.7; pointer-events: none; transition: transform 0.5s cubic-bezier(.4,2,.6,1); z-index: 1; }
        .share-btn.clicked .wave { transform: translate(-50%, -50%) scale(1); transition: transform 0.5s cubic-bezier(.4,2,.6,1); }
        @media (max-width: 500px) {
          .container { max-width: 98vw; padding: 18px 4vw; }
          h2 { font-size: 1.3rem; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Share with ZapKey</h2>
        <form id="share-form" method="POST" enctype="multipart/form-data">
          <input type="hidden" name="sid" value="${sid}" />
          <label>Share a URL:</label>
          <div class="input-row">
            <input type="url" name="url" id="url-input" placeholder="https://example.com" autocomplete="off" />
            <span class="last-link-tab" id="last-link-tab" style="display:none;"></span>
            <button type="button" id="paste-btn" style="margin-left:8px;padding:6px 12px;font-size:0.98rem;border-radius:7px;border:1.5px solid #2563eb22;background:#e0e7ff;color:#2563eb;font-weight:600;cursor:pointer;">Paste</button>
          </div>
          <label>Or upload a file:</label>
          <div class="upload-area" id="upload-area">
            <span class="upload-icon">&#8682;</span>
            <span class="upload-text">Click or drag file here (PDF, JPG, PNG, JPEG, WEBP, GIF, up to 10MB)</span>
            <input type="file" name="file" id="file-input" accept=".pdf,image/jpeg,image/png,image/webp,image/gif" style="display:none;" />
            <div class="file-info" id="file-info"></div>
          </div>
          <button type="submit" class="share-btn" id="share-btn">
            <span>Share</span>
            <span class="wave"></span>
          </button>
        </form>
      </div>
      <script>
        // Show last copied link if available
        document.addEventListener('DOMContentLoaded', () => {
          // Try to get last copied link from clipboard (if allowed)
          if (navigator.clipboard) {
            navigator.clipboard.readText().then(text => {
              if (text && /^https?:\/\//.test(text)) {
                const tab = document.getElementById('last-link-tab');
                tab.textContent = text.length > 40 ? text.slice(0, 37) + '...' : text;
                tab.style.display = 'inline-block';
                tab.onclick = () => {
                  document.getElementById('url-input').value = text;
                };
              }
            }).catch(() => {});
          }
        });
        // Upload area logic
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const fileInfo = document.getElementById('file-info');
        let selectedFile = null;
        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', e => {
          e.preventDefault();
          uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', e => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', e => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            fileInput.files = e.dataTransfer.files;
            handleFileChange();
          }
        });
        fileInput.addEventListener('change', handleFileChange);
        function handleFileChange() {
          const file = fileInput.files[0];
          if (!file) return;
          if (file.size > 10 * 1024 * 1024) {
            fileInfo.innerHTML = '<span style="color:#e11d48">File too large (max 10MB)</span>';
            fileInput.value = '';
            selectedFile = null;
            return;
          }
          fileInfo.innerHTML = file.name + ' (' + (file.size/1024/1024).toFixed(2) + ' MB)' +
            ' <span class="file-remove" id="remove-file">Remove</span>';
          selectedFile = file;
          document.getElementById('remove-file').onclick = () => {
            fileInput.value = '';
            fileInfo.innerHTML = '';
            selectedFile = null;
          };
        }
        // Animated share button
        const shareBtn = document.getElementById('share-btn');
        shareBtn.addEventListener('click', function(e) {
          const wave = this.querySelector('.wave');
          wave.classList.remove('clicked');
          void wave.offsetWidth;
          wave.classList.add('clicked');
        });
        // Prevent double submit
        document.getElementById('share-form').onsubmit = function() {
          shareBtn.disabled = true;
          shareBtn.style.opacity = 0.7;
        };
        // Paste from clipboard button fallback
        document.getElementById('paste-btn').onclick = async function() {
          if (navigator.clipboard) {
            try {
              const text = await navigator.clipboard.readText();
              if (text) document.getElementById('url-input').value = text;
            } catch (e) {
              alert('Clipboard access denied.');
            }
          } else {
            alert('Clipboard API not supported.');
          }
        };
      </script>
    </body></html>
  `);
});

// Handle form submission (POST)
app.post('/', upload.single('file'), (req, res) => {
  const { sid, url } = req.body;
  if (!sid) return res.status(400).send('Missing session ID (sid)');

  let shared = {};
  if (url && url.startsWith('http')) {
    shared.url = url;
  }
  if (req.file) {
    // Store file as base64 (for demo, not for production)
    shared.file = {
      name: req.file.originalname,
      mimetype: req.file.mimetype,
      data: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
    };
  }
  if (!shared.url && !shared.file) {
    return res.status(400).send('Please provide a URL or upload a file.');
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
