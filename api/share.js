const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// In-memory store for shared data (for demo, not persistent)
const sessions = global._shareSessions = global._shareSessions || new Map();
// In-memory counter for total files shared
const totalFilesShared = global._totalFilesShared = global._totalFilesShared || { count: 0 };

// Multer setup for file uploads (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

function renderSharePage({ sid, message, messageType, urlValue, filesShared }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ZapKey Dark Glass UI</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @font-face {
          font-family: 'SF Pro Display';
          src: url('https://fonts.cdnfonts.com/s/59163/SFProDisplay-Regular.woff') format('woff');
          font-weight: 100 900;
        }
        body {
          font-family: 'SF Pro Display', sans-serif;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #0f0f0f, #1e1e1e);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          width: 95%;
          max-width: 460px;
          background: rgba(30, 30, 30, 0.6);
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          color: #f1f1f1;
          position: relative;
        }
        h2.intro-text {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 300;
          color: #ccc;
        }
        h2.brand-text {
          margin-top: 4px;
          font-size: 3.5rem;
          font-weight: 700;
          background: linear-gradient(90deg, #0072ff, #002561);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .files-shared {
          width: 100%;
          text-align: center;
          font-size: 1.08rem;
          color: #3b82f6;
          margin-bottom: 10px;
          font-weight: 500;
          letter-spacing: 0.01em;
        }
        .msg {
          width: 100%;
          margin-bottom: 18px;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 1.05rem;
          font-weight: 500;
          text-align: center;
        }
        .msg.error {
          background: rgba(255, 0, 60, 0.13);
          color: #ff4b6b;
          border: 1px solid #ff4b6b;
        }
        .msg.success {
          background: rgba(0, 180, 90, 0.13);
          color: #00e07a;
          border: 1px solid #00e07a;
        }
        input[type="url"] {
          width: -webkit-fill-available;
          padding: 12px 16px;
          font-size: 1rem;
          border: 1px solid #444;
          border-radius: 10px;
          background-color: rgba(255, 255, 255, 0.05);
          color: #eee;
          margin: 18px 0 10px;
        }
        input[type="url"]::placeholder {
          color: #888;
          font-weight: 200;
        }
        #paste-btn {
          width: 100%;
          padding: 12px;
          font-size: 1rem;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          border: 1px solid #3b82f6;
          margin-bottom: 16px;
          cursor: pointer;
        }
        .upload-area {
          width: 100%;
          min-height: 160px;
          border: 2px dashed #3b82f6;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          margin-bottom: 16px;
          transition: min-height 0.2s;
          padding-bottom: 10px;
        }
        .upload-area.dragover {
          border-color: #0072ff;
        }
        .upload-icon svg {
          fill: #3b82f6;
          height: 48px;
          margin-bottom: 8px;
        }
        .upload-text {
          text-align: center;
          font-size: 0.95rem;
          color: #ccc;
        }
        .upload-text small {
          font-size: 0.8rem;
          color: #666;
        }
        .file-input {
          display: none;
        }
        .preview-list {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
          justify-content: flex-start;
        }
        .preview-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(40,40,40,0.7);
          border-radius: 8px;
          padding: 8px 8px 4px 8px;
          position: relative;
          min-width: 90px;
          max-width: 120px;
        }
        .preview-item img {
          max-width: 90px;
          max-height: 70px;
          border-radius: 6px;
          margin-bottom: 4px;
        }
        .preview-item .file-name {
          color: #ccc;
          font-size: 0.93rem;
          margin-bottom: 2px;
          word-break: break-all;
          text-align: center;
        }
        .preview-item .remove-btn {
          background: #222;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 3px 10px;
          cursor: pointer;
          font-size: 0.9rem;
          margin-top: 2px;
        }
        .share-btn {
          width: 100%;
          padding: 14px;
          font-size: 1.1rem;
          border: none;
          border-radius: 10px;
          background: linear-gradient(to right, #0036af, #004dd0, #003c9e);
          color: white;
          font-weight: 500;
          cursor: pointer;
          margin-top: 12px;
        }
        .footer {
          width: 100%;
          text-align: center;
          font-size: 0.98rem;
          color: #888;
          margin-top: 22px;
          letter-spacing: 0.01em;
          opacity: 0.85;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="intro-text">Share everything with</h2>
        <h2 class="brand-text">ZapKey</h2>
        <div class="files-shared">${filesShared.toLocaleString()} files shared</div>
        ${message ? `<div class="msg ${messageType}">${message}</div>` : ''}
        <form method="POST" enctype="multipart/form-data" id="shareForm">
          <input type="hidden" name="sid" value="${sid}" />
          <input type="url" name="url" placeholder="Share a URL: https://example.com" id="urlInput" value="${urlValue ? urlValue.replace(/"/g, '&quot;') : ''}" />
          <button type="button" id="paste-btn">Paste Last Copied</button>
          <label class="upload-area" id="uploadArea">
            <div class="upload-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
                <path fill="currentColor" d="M12 16a1 1 0 01-1-1V8.41l-2.3 2.3a1 1 0 01-1.4-1.42l4-4a1 1 0 011.4 0l4 4a1 1 0 01-1.4 1.42L13 8.41V15a1 1 0 01-1 1z" />
                <path fill="currentColor" d="M5 18a1 1 0 100 2h14a1 1 0 100-2H5z"/>
              </svg>
            </div>
            <div class="upload-text">
              Click to upload file<br>
              <small>(PDF, JPG, PNG, JPEG, WEBP, GIF, up to 10MB)</small>
            </div>
            <input type="file" name="image" class="file-input" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" id="fileInput" multiple />
            <div class="preview-list" id="previewList"></div>
          </label>
          <button type="submit" class="share-btn">Share</button>
        </form>
        <div class="footer">Made with ❤️. Do it with love.</div>
      </div>
      <script>
        // Paste Last Copied
        document.getElementById('paste-btn').onclick = async function(e) {
          e.preventDefault();
          if (navigator.clipboard) {
            try {
              const text = await navigator.clipboard.readText();
              document.getElementById('urlInput').value = text;
            } catch (err) {
              alert('Could not read clipboard.');
            }
          } else {
            alert('Clipboard API not supported.');
          }
        };
        // Drag and drop/click upload, multiple files
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const previewList = document.getElementById('previewList');
        let filesArr = [];
        function updatePreviews() {
          previewList.innerHTML = '';
          if (filesArr.length === 0) {
            uploadArea.querySelector('.upload-text').style.display = '';
            uploadArea.style.minHeight = '160px';
          } else {
            uploadArea.querySelector('.upload-text').style.display = 'none';
            uploadArea.style.minHeight = '';
          }
          filesArr.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            if (file.type && file.type.startsWith('image/')) {
              const img = document.createElement('img');
              const reader = new FileReader();
              reader.onload = e => { img.src = e.target.result; };
              reader.readAsDataURL(file);
              img.alt = file.name;
              item.appendChild(img);
            }
            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.textContent = file.name;
            item.appendChild(nameDiv);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.type = 'button';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => {
              filesArr.splice(idx, 1);
              updatePreviews();
              // Update file input
              const dt = new DataTransfer();
              filesArr.forEach(f => dt.items.add(f));
              fileInput.files = dt.files;
            };
            item.appendChild(removeBtn);
            previewList.appendChild(item);
          });
        }
        fileInput.addEventListener('change', (e) => {
          filesArr = Array.from(fileInput.files);
          updatePreviews();
        });
        uploadArea.addEventListener('click', (e) => {
          if (e.target === uploadArea || e.target.classList.contains('upload-icon') || e.target.classList.contains('upload-text')) {
            fileInput.click();
          }
        });
        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            filesArr = Array.from(e.dataTransfer.files);
            updatePreviews();
            // Update file input
            const dt = new DataTransfer();
            filesArr.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Serve the share page (GET)
app.get('/', (req, res) => {
  const { sid, msg, type, url } = req.query;
  if (!sid) {
    return res.status(400).send(renderSharePage({ sid: '', message: 'Missing session ID (sid)', messageType: 'error', filesShared: totalFilesShared.count }));
  }
  res.send(renderSharePage({ sid, message: msg, messageType: type, urlValue: url, filesShared: totalFilesShared.count }));
});

// Handle form submission (POST)
app.post('/', upload.array('image'), (req, res) => {
  const { sid, url } = req.body;
  if (!sid) {
    return res.status(400).send(renderSharePage({ sid: '', message: 'Missing session ID (sid)', messageType: 'error', urlValue: url, filesShared: totalFilesShared.count }));
  }
  let shared = {};
  if (url && url.startsWith('http')) {
    shared.url = url;
  }
  if (req.files && req.files.length > 0) {
    // Store images as base64 (for demo, not for production)
    shared.images = req.files.map(f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
    totalFilesShared.count += req.files.length;
  }
  if (!shared.url && (!shared.images || shared.images.length === 0)) {
    return res.status(400).send(renderSharePage({ sid, message: 'Please provide a valid URL or upload an image.', messageType: 'error', urlValue: url, filesShared: totalFilesShared.count }));
  }
  sessions.set(sid, shared);
  // Show success message on same page
const express = require('express');
const multer = require('multer');
const path = require('path');
const app = express();

// In-memory store for shared data (for demo, not persistent)
const sessions = global._shareSessions = global._shareSessions || new Map();

// Multer setup for file uploads (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

function renderSharePage({ sid, message, messageType, urlValue }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ZapKey Dark Glass UI</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @font-face {
          font-family: 'SF Pro Display';
          src: url('https://fonts.cdnfonts.com/s/59163/SFProDisplay-Regular.woff') format('woff');
          font-weight: 100 900;
        }
        body {
          font-family: 'SF Pro Display', sans-serif;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #0f0f0f, #1e1e1e);
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          width: 95%;
          max-width: 460px;
          background: rgba(30, 30, 30, 0.6);
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          color: #f1f1f1;
        }
        h2.intro-text {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 300;
          color: #ccc;
        }
        h2.brand-text {
          margin-top: 4px;
          font-size: 3.5rem;
          font-weight: 700;
          background: linear-gradient(90deg, #0072ff, #002561);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .msg {
          width: 100%;
          margin-bottom: 18px;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 1.05rem;
          font-weight: 500;
          text-align: center;
        }
        .msg.error {
          background: rgba(255, 0, 60, 0.13);
          color: #ff4b6b;
          border: 1px solid #ff4b6b;
        }
        .msg.success {
          background: rgba(0, 180, 90, 0.13);
          color: #00e07a;
          border: 1px solid #00e07a;
        }
        input[type="url"] {
          width: -webkit-fill-available;
          padding: 12px 16px;
          font-size: 1rem;
          border: 1px solid #444;
          border-radius: 10px;
          background-color: rgba(255, 255, 255, 0.05);
          color: #eee;
          margin: 18px 0 10px;
        }
        input[type="url"]::placeholder {
          color: #888;
          font-weight: 200;
        }
        #paste-btn {
          width: 100%;
          padding: 12px;
          font-size: 1rem;
          border-radius: 10px;
          background: rgba(59, 130, 246, 0.2);
          color: #3b82f6;
          border: 1px solid #3b82f6;
          margin-bottom: 16px;
          cursor: pointer;
        }
        .upload-area {
          width: 100%;
          min-height: 160px;
          border: 2px dashed #3b82f6;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          margin-bottom: 16px;
          transition: min-height 0.2s;
          padding-bottom: 10px;
        }
        .upload-area.dragover {
          border-color: #0072ff;
        }
        .upload-icon svg {
          fill: #3b82f6;
          height: 48px;
          margin-bottom: 8px;
        }
        .upload-text {
          text-align: center;
          font-size: 0.95rem;
          color: #ccc;
        }
        .upload-text small {
          font-size: 0.8rem;
          color: #666;
        }
        .file-input {
          display: none;
        }
        .preview-list {
          width: 100%;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 10px;
          justify-content: flex-start;
        }
        .preview-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(40,40,40,0.7);
          border-radius: 8px;
          padding: 8px 8px 4px 8px;
          position: relative;
          min-width: 90px;
          max-width: 120px;
        }
        .preview-item img {
          max-width: 90px;
          max-height: 70px;
          border-radius: 6px;
          margin-bottom: 4px;
        }
        .preview-item .file-name {
          color: #ccc;
          font-size: 0.93rem;
          margin-bottom: 2px;
          word-break: break-all;
          text-align: center;
        }
        .preview-item .remove-btn {
          background: #222;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 3px 10px;
          cursor: pointer;
          font-size: 0.9rem;
          margin-top: 2px;
        }
        .share-btn {
          width: 100%;
          padding: 14px;
          font-size: 1.1rem;
          border: none;
          border-radius: 10px;
          background: linear-gradient(to right, #0036af, #004dd0, #003c9e);
          color: white;
          font-weight: 500;
          cursor: pointer;
          margin-top: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="intro-text">Share everything with</h2>
        <h2 class="brand-text">ZapKey</h2>
        ${message ? `<div class="msg ${messageType}">${message}</div>` : ''}
        <form method="POST" enctype="multipart/form-data" id="shareForm">
          <input type="hidden" name="sid" value="${sid}" />
          <input type="url" name="url" placeholder="Share a URL: https://example.com" id="urlInput" value="${urlValue ? urlValue.replace(/"/g, '&quot;') : ''}" />
          <button type="button" id="paste-btn">Paste Last Copied</button>
          <label class="upload-area" id="uploadArea">
            <div class="upload-icon">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40">
                <path fill="currentColor" d="M12 16a1 1 0 01-1-1V8.41l-2.3 2.3a1 1 0 01-1.4-1.42l4-4a1 1 0 011.4 0l4 4a1 1 0 01-1.4 1.42L13 8.41V15a1 1 0 01-1 1z" />
                <path fill="currentColor" d="M5 18a1 1 0 100 2h14a1 1 0 100-2H5z"/>
              </svg>
            </div>
            <div class="upload-text">
              Click to upload file<br>
              <small>(PDF, JPG, PNG, JPEG, WEBP, GIF, up to 10MB)</small>
            </div>
            <input type="file" name="image" class="file-input" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" id="fileInput" multiple />
            <div class="preview-list" id="previewList"></div>
          </label>
          <button type="submit" class="share-btn">Share</button>
        </form>
      </div>
      <script>
        // Paste Last Copied
        document.getElementById('paste-btn').onclick = async function(e) {
          e.preventDefault();
          if (navigator.clipboard) {
            try {
              const text = await navigator.clipboard.readText();
              document.getElementById('urlInput').value = text;
            } catch (err) {
              alert('Could not read clipboard.');
            }
          } else {
            alert('Clipboard API not supported.');
          }
        };
        // Drag and drop/click upload, multiple files
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const previewList = document.getElementById('previewList');
        let filesArr = [];
        function updatePreviews() {
          previewList.innerHTML = '';
          if (filesArr.length === 0) {
            uploadArea.querySelector('.upload-text').style.display = '';
            uploadArea.style.minHeight = '160px';
          } else {
            uploadArea.querySelector('.upload-text').style.display = 'none';
            uploadArea.style.minHeight = '';
          }
          filesArr.forEach((file, idx) => {
            const item = document.createElement('div');
            item.className = 'preview-item';
            if (file.type && file.type.startsWith('image/')) {
              const img = document.createElement('img');
              const reader = new FileReader();
              reader.onload = e => { img.src = e.target.result; };
              reader.readAsDataURL(file);
              img.alt = file.name;
              item.appendChild(img);
            }
            const nameDiv = document.createElement('div');
            nameDiv.className = 'file-name';
            nameDiv.textContent = file.name;
            item.appendChild(nameDiv);
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.type = 'button';
            removeBtn.textContent = 'Remove';
            removeBtn.onclick = () => {
              filesArr.splice(idx, 1);
              updatePreviews();
              // Update file input
              const dt = new DataTransfer();
              filesArr.forEach(f => dt.items.add(f));
              fileInput.files = dt.files;
            };
            item.appendChild(removeBtn);
            previewList.appendChild(item);
          });
        }
        fileInput.addEventListener('change', (e) => {
          filesArr = Array.from(fileInput.files);
          updatePreviews();
        });
        uploadArea.addEventListener('click', (e) => {
          if (e.target === uploadArea || e.target.classList.contains('upload-icon') || e.target.classList.contains('upload-text')) {
            fileInput.click();
          }
        });
        uploadArea.addEventListener('dragover', (e) => {
          e.preventDefault();
          uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
        uploadArea.addEventListener('drop', (e) => {
          e.preventDefault();
          uploadArea.classList.remove('dragover');
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            filesArr = Array.from(e.dataTransfer.files);
            updatePreviews();
            // Update file input
            const dt = new DataTransfer();
            filesArr.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Serve the share page (GET)
app.get('/', (req, res) => {
  const { sid, msg, type, url } = req.query;
  if (!sid) {
    return res.status(400).send(renderSharePage({ sid: '', message: 'Missing session ID (sid)', messageType: 'error' }));
  }
  res.send(renderSharePage({ sid, message: msg, messageType: type, urlValue: url }));
});

// Handle form submission (POST)
app.post('/', upload.array('image'), (req, res) => {
  const { sid, url } = req.body;
  if (!sid) {
    return res.status(400).send(renderSharePage({ sid: '', message: 'Missing session ID (sid)', messageType: 'error', urlValue: url }));
  }
  let shared = {};
  if (url && url.startsWith('http')) {
    shared.url = url;
  }
  if (req.files && req.files.length > 0) {
    // Store images as base64 (for demo, not for production)
    shared.images = req.files.map(f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);
  }
  if (!shared.url && (!shared.images || shared.images.length === 0)) {
    return res.status(400).send(renderSharePage({ sid, message: 'Please provide a valid URL or upload an image.', messageType: 'error', urlValue: url }));
  }
  sessions.set(sid, shared);
  // Show success message on same page
  res.send(renderSharePage({ sid, message: 'Shared successfully! You can close this page.', messageType: 'success', urlValue: '' }));
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
