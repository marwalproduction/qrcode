const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const QRCode = require('qrcode');

// In-memory store for shared data (for demo, not persistent)
const sessions = global._shareSessions = global._shareSessions || new Map();
// In-memory counter for total files shared
const totalFilesShared = global._totalFilesShared = global._totalFilesShared || { count: 0 };

// Session timeout management (5 minutes)
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
const sessionTimeouts = global._sessionTimeouts = global._sessionTimeouts || new Map();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [sid, timestamp] of sessionTimeouts.entries()) {
    if (now - timestamp > SESSION_TIMEOUT) {
      sessions.delete(sid);
      sessionTimeouts.delete(sid);
    }
  }
}, 60000); // Check every minute

// Helper function to create session with timeout
function createSession(sid, data) {
  sessions.set(sid, data);
  sessionTimeouts.set(sid, Date.now());
}

// Helper function to get session and check if expired
function getSession(sid) {
  const timestamp = sessionTimeouts.get(sid);
  if (!timestamp) return null;
  
  const now = Date.now();
  if (now - timestamp > SESSION_TIMEOUT) {
    // Session expired, clean up
    sessions.delete(sid);
    sessionTimeouts.delete(sid);
    return null;
  }
  
  return sessions.get(sid);
}

// Multer setup for file uploads (in memory)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 2 * 1024 * 1024 } }); // 2MB limit

function renderSharePage({ sid, message, messageType, urlValue }) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>ZapKey – Share</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        body {
          min-height: 100vh;
          height: 100vh;
          box-sizing: border-box;
          font-family: 'Inter', 'SF Pro Display', sans-serif;
          background: #101114;
          color: #fff;
          display: flex;
          flex-direction: column;
        }
        .main-content {
          flex: 1 0 auto;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-direction: column;
        }
        .hero-section {
          width: 100vw;
          max-width: 460px;
          margin: 0 auto 18px auto;
          padding: 0 18px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .hero-headline {
          font-size: 2.1rem;
          font-weight: 700;
          margin-bottom: 10px;
          background: linear-gradient(90deg, #00ffe7, #00ff85);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hero-subheadline {
          color: #b0b6be;
          font-size: 1.04rem;
          margin-bottom: 28px;
          font-weight: 400;
        }
        .container {
          width: 100vw;
          max-width: 460px;
          background: rgba(30, 30, 30, 0.7);
          border-radius: 20px;
          padding: 28px 18px 24px 18px;
          backdrop-filter: blur(14px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          color: #f1f1f1;
          position: relative;
        }
        h2.brand-text {
          margin: 0 0 12px 0;
          font-size: 2.2rem;
          font-weight: 700;
          background: linear-gradient(90deg, #00ffe7, #00ff85);
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
          background: rgba(0,255,180,0.07);
          color: #00ff85;
          border: 1.5px solid #00ff85;
          font-weight: 600;
          margin-bottom: 16px;
          cursor: pointer;
          transition: background 0.2s, border 0.2s;
        }
        #paste-btn:hover {
          background: rgba(0,255,180,0.18);
          border-color: #00ffe7;
        }
        .upload-area {
          width: 100%;
          min-height: 160px;
          border: 2px dashed #00ff85;
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
          border-color: #00ffe7;
        }
        .upload-icon svg {
          fill: #00ff85;
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
          background: linear-gradient(90deg, #00ffe7, #00ff85);
          color: #101114;
          font-weight: 600;
          cursor: pointer;
          margin-top: 12px;
          box-shadow: 0 2px 12px rgba(0,255,180,0.08);
          transition: background 0.2s;
        }
        .share-btn:hover {
          background: linear-gradient(90deg, #00ff85, #00ffe7);
        }
        .footer {
          width: 100vw;
          text-align: center;
          font-size: 1.08rem;
          color: #7a7f87;
          letter-spacing: 0.01em;
          opacity: 0.95;
          padding: 18px 0 12px 0;
          background: transparent;
          flex-shrink: 0;
        }
      </style>
    </head>
    <body>
      <div class="main-content">
        <div class="hero-section">
          <div class="brand-text">ZapKey</div>
          <div class="hero-headline">Share Instantly. No Signups. No Hassle.</div>
          <div class="hero-subheadline">Securely share files and links across devices with a simple QR scan.</div>
        </div>
        <div class="container">
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
      </div>
      <div class="footer">
        Built for privacy. Designed for speed.
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
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        const errorMsgId = 'fileErrorMsg';
        function showFileError(msg) {
          let err = document.getElementById(errorMsgId);
          if (!err) {
            err = document.createElement('div');
            err.id = errorMsgId;
            err.style.color = '#ff4b6b';
            err.style.background = 'rgba(255,0,60,0.13)';
            err.style.border = '1px solid #ff4b6b';
            err.style.borderRadius = '8px';
            err.style.padding = '8px 12px';
            err.style.margin = '10px 0';
            err.style.textAlign = 'center';
            previewList.parentNode.insertBefore(err, previewList);
          }
          err.textContent = msg;
        }
        function clearFileError() {
          const err = document.getElementById(errorMsgId);
          if (err) err.remove();
        }
        function updatePreviews() {
          previewList.innerHTML = '';
          clearFileError();
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
            // const nameDiv = document.createElement('div');
            // nameDiv.className = 'file-name';
            // nameDiv.textContent = file.name;
            // item.appendChild(nameDiv);
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
          clearFileError();
          const newFiles = Array.from(fileInput.files);
          let valid = true;
          newFiles.forEach(f => {
            if (f.size > MAX_FILE_SIZE) {
              showFileError('File "' + f.name + '" is too large (max 10MB per file).');
              valid = false;
            }
          });
          if (!valid) {
            fileInput.value = '';
            return;
          }
          // Additive selection: add new files that aren't already in filesArr
          newFiles.forEach(f => {
            if (!filesArr.some(existing => existing.name === f.name && existing.size === f.size && existing.lastModified === f.lastModified)) {
              filesArr.push(f);
            }
          });
          updatePreviews();
          // Reset file input so same file can be selected again
          fileInput.value = '';
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
          clearFileError();
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            let valid = true;
            droppedFiles.forEach(f => {
              if (f.size > MAX_FILE_SIZE) {
                showFileError('File "' + f.name + '" is too large (max 10MB per file).');
                valid = false;
              }
            });
            if (!valid) return;
            // Additive selection: add new files that aren't already in filesArr
            droppedFiles.forEach(f => {
              if (!filesArr.some(existing => existing.name === f.name && existing.size === f.size && existing.lastModified === f.lastModified)) {
                filesArr.push(f);
              }
            });
            updatePreviews();
            // Reset file input so same file can be selected again
            fileInput.value = '';
          }
        });
      </script>
    </body>
    </html>
  `;
}

// Landing page with hero, about, and live QR code
router.get('/', async (req, res) => {
  // Generate a random session ID
  const sid = Math.random().toString(36).slice(2);
  // The QR code should point to the /share page for this session
  const host = req.get('host');
  const proto = req.protocol;
  const shareUrl = `${proto}://${host}/share?sid=${sid}`;
  const qrData = await QRCode.toDataURL(shareUrl);
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ZapKey – Secure QR Login & Sharing</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        body {
          min-height: 100vh;
          height: 100vh;
          box-sizing: border-box;
          font-family: 'Inter', 'SF Pro Display', sans-serif;
          background: #101114;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
        }
        .container {
          width: 100vw;
          max-width: 420px;
          margin: 0 auto;
          padding: 0 18px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .brand {
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 32px;
          margin-bottom: 18px;
          letter-spacing: 0.01em;
        }
        .headline {
          font-size: 2.1rem;
          font-weight: 700;
          margin-bottom: 10px;
          background: linear-gradient(90deg, #00ffe7, #00ff85);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .subheadline {
          color: #b0b6be;
          font-size: 1.04rem;
          margin-bottom: 28px;
          font-weight: 400;
        }
        .features {
          margin-bottom: 32px;
        }
        .feature {
          display: flex;
          align-items: center;
          font-size: 1.05rem;
          color: #e0f7ef;
          margin-bottom: 10px;
        }
        .feature svg {
          margin-right: 12px;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
        }
        .qr-card {
          width: 100%;
          background: rgba(24, 26, 32, 0.92);
          border-radius: 16px;
          box-shadow: 0 2px 16px rgba(0,255,180,0.04);
          padding: 22px 0 18px 0;
          margin-bottom: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          border: 1px solid #23272f;
        }
        .qr-title {
          color: #e0f7ef;
          font-size: 1.13rem;
          font-weight: 600;
          margin-bottom: 16px;
        }
        .qr-img {
          background: #fff;
          border-radius: 12px;
          padding: 10px;
          width: 160px;
          height: 160px;
          margin-bottom: 18px;
        }
        .qr-stats {
          display: flex;
          align-items: center;
          color: #00ff85;
          font-size: 1.04rem;
          font-weight: 500;
          margin-bottom: 2px;
        }
        .qr-stats svg {
          margin-right: 7px;
          width: 18px;
          height: 18px;
        }
        .qr-desc {
          color: #7a7f87;
          font-size: 0.98rem;
          margin-bottom: 0;
        }
        .scan-btn {
          width: 100%;
          margin: 24px 0 0 0;
          padding: 15px 0;
          font-size: 1.13rem;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          background: linear-gradient(90deg, #00ffe7, #00ff85);
          color: #101114;
          cursor: pointer;
          box-shadow: 0 2px 12px rgba(0,255,180,0.08);
          transition: background 0.2s;
        }
        .scan-btn:hover {
          background: linear-gradient(90deg, #00ff85, #00ffe7);
        }
        .footer {
          width: 100vw;
          text-align: center;
          font-size: 1.01rem;
          color: #7a7f87;
          letter-spacing: 0.01em;
          opacity: 0.95;
          padding: 32px 0 18px 0;
          background: transparent;
          flex-shrink: 0;
        }
        .footer-social {
          margin-top: 10px;
        }
        .footer-social a {
          color: #b0b6be;
          margin: 0 8px;
          text-decoration: none;
          font-size: 1.3rem;
          vertical-align: middle;
        }
        @media (max-width: 600px) {
          .container, .hero-section {
            padding: 0 4vw;
            max-width: 99vw;
          }
          .main-content {
            padding: 0;
          }
          .hero-headline {
            font-size: 1.4rem;
          }
          .hero-subheadline {
            font-size: 0.98rem;
          }
          .preview-item img {
            max-width: 70vw;
            max-height: 60vw;
          }
          .upload-icon svg {
            height: 36px;
          }
          .footer {
            font-size: 0.98rem;
            padding: 18px 0 10px 0;
          }
          .qr-img {
            width: 180px !important;
            height: 180px !important;
            min-width: 120px;
            min-height: 120px;
            max-width: 90vw;
            max-height: 90vw;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="brand">ZapKey</div>
        <div class="headline">Share Instantly. No Signups. No Hassle.</div>
        <div class="subheadline">Securely share files and links across devices with a simple QR scan.</div>
        <div class="features">
          <div class="feature">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Instant File & Link Transfer
          </div>
          <div class="feature">
            <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            No App or Signup Needed
          </div>
        </div>
        <div class="qr-card">
          <div class="qr-title">Scan QR to Share</div>
          <img class="qr-img" src="${qrData}" alt="ZapKey QR Code" id="qrImage" />
          <div id="sharedDataSection">
            <div class="qr-stats">
              <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 6.293a1 1 0 00-1.414 0L9 12.586l-2.293-2.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z" clip-rule="evenodd"/></svg>
              20,000+ files shared securely
            </div>
            <div class="qr-desc">No account needed - just scan & go</div>
          </div>
          <div id="scanAgainSection" style="display: none;">
            <button onclick="window.location.reload()" style="background: linear-gradient(90deg, #00ffe7, #00ff85); color: #101114; border: none; border-radius: 10px; padding: 12px 24px; font-weight: 600; cursor: pointer; margin-top: 16px;">Scan Again to Receive More</button>
          </div>
        </div>
      </div>
      <div class="footer">
        Built for privacy. Designed for speed.
        <div class="footer-social">
          <a href="#" title="GitHub" aria-label="GitHub"><svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.184 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .267.18.578.688.48C19.138 20.2 22 16.447 22 12.021 22 6.484 17.523 2 12 2z"/></svg></a>
          <a href="#" title="Twitter" aria-label="Twitter"><svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M22.46 5.924c-.793.352-1.645.59-2.54.698a4.48 4.48 0 001.963-2.475 8.94 8.94 0 01-2.828 1.082 4.48 4.48 0 00-7.635 4.086A12.72 12.72 0 013.11 4.86a4.48 4.48 0 001.39 5.976 4.48 4.48 0 01-2.03-.56v.057a4.48 4.48 0 003.6 4.393 4.48 4.48 0 01-2.025.077 4.48 4.48 0 004.18 3.11A8.98 8.98 0 012 19.54a12.7 12.7 0 006.88 2.02c8.26 0 12.78-6.84 12.78-12.78 0-.195-.004-.39-.013-.583A9.14 9.14 0 0024 4.59a8.94 8.94 0 01-2.54.698z"/></svg></a>
          <a href="#" title="Discord" aria-label="Discord"><svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24"><path d="M20.317 4.369A19.791 19.791 0 0016.885 3.2a.117.117 0 00-.125.06c-.556.98-1.176 2.267-1.617 3.287a18.524 18.524 0 00-5.034 0c-.441-1.02-1.061-2.307-1.617-3.287a.117.117 0 00-.125-.06A19.736 19.736 0 003.683 4.369a.105.105 0 00-.047.043C.533 9.045-.32 13.579.099 18.057a.12.12 0 00.045.083c2.052 1.507 4.042 2.422 5.992 3.029a.117.117 0 00.128-.043c.461-.63.873-1.295 1.226-1.994a.112.112 0 00-.065-.158c-.652-.247-1.27-.549-1.872-.892a.117.117 0 01-.012-.194c.126-.094.252-.192.371-.291a.112.112 0 01.114-.01c3.927 1.793 8.18 1.793 12.061 0a.112.112 0 01.115.01c.12.099.245.197.371.291a.117.117 0 01-.011.194 12.298 12.298 0 01-1.873.892.112.112 0 00-.064.158c.36.699.772 1.364 1.226 1.994a.117.117 0 00.128.043c1.95-.607 3.94-1.522 5.992-3.029a.115.115 0 00.045-.083c.5-5.177-.838-9.673-3.573-13.645a.093.093 0 00-.047-.043zM8.02 15.331c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.174 1.094 2.156 2.418 0 1.334-.955 2.419-2.156 2.419zm7.974 0c-1.183 0-2.156-1.085-2.156-2.419 0-1.333.955-2.418 2.156-2.418 1.21 0 2.174 1.094 2.156 2.418 0 1.334-.946 2.419-2.156 2.419z"/></svg></a>
        </div>
      </div>
      <script>
        // Poll for shared data for this session and show under QR
        const sid = "${sid}";
        const sharedDataSection = document.getElementById('sharedDataSection');
        const scanAgainSection = document.getElementById('scanAgainSection');
        const qrImage = document.getElementById('qrImage');

        function createDownloadLink(href, text, filename, isDownload) {
          const a = document.createElement('a');
          a.href = href;
          a.textContent = text;
          if (isDownload && filename) a.download = filename;
          a.className = 'shared-download-link';
          a.style.display = 'inline-block';
          a.style.margin = '8px 0 0 0';
          a.style.color = '#00ff85';
          a.style.fontWeight = '600';
          a.style.textDecoration = 'underline';
          return a;
        }

        function showSharedData(shared) {
          sharedDataSection.innerHTML = '';
          let hasData = false;
          
          if (shared.url) {
            const link = createDownloadLink(shared.url, 'Open Shared Link', null, false);
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            sharedDataSection.appendChild(link);
            hasData = true;
          }
          
          if (shared.images && Array.isArray(shared.images) && shared.images.length > 0) {
            // Create responsive image grid
            const imageGrid = document.createElement('div');
            imageGrid.style.display = 'grid';
            imageGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(100px, 1fr))';
            imageGrid.style.gap = '12px';
            imageGrid.style.marginTop = '16px';
            imageGrid.style.width = '100%';
            
            shared.images.forEach(function(imgSrc, idx) {
              const imageContainer = document.createElement('div');
              imageContainer.style.position = 'relative';
              imageContainer.style.display = 'flex';
              imageContainer.style.flexDirection = 'column';
              imageContainer.style.alignItems = 'center';
              
              const img = document.createElement('img');
              img.src = imgSrc;
              img.alt = 'Shared Image ' + (idx + 1);
              img.style.width = '100%';
              img.style.height = '100px';
              img.style.objectFit = 'cover';
              img.style.borderRadius = '8px';
              img.style.marginBottom = '8px';
              
              const downloadBtn = document.createElement('button');
              downloadBtn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="margin-right: 6px;"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4h12v-2H5v2z"/></svg>Download';
              downloadBtn.style.background = 'linear-gradient(90deg, #00ffe7, #00ff85)';
              downloadBtn.style.color = '#101114';
              downloadBtn.style.border = 'none';
              downloadBtn.style.borderRadius = '6px';
              downloadBtn.style.padding = '6px 12px';
              downloadBtn.style.fontSize = '0.9rem';
              downloadBtn.style.fontWeight = '600';
              downloadBtn.style.cursor = 'pointer';
              downloadBtn.style.width = '100%';
              downloadBtn.style.display = 'flex';
              downloadBtn.style.alignItems = 'center';
              downloadBtn.style.justifyContent = 'center';
              downloadBtn.onclick = function() {
                const a = createDownloadLink(imgSrc, '', 'shared-image-' + (idx+1) + '.png', true);
                a.click();
              };
              
              imageContainer.appendChild(img);
              imageContainer.appendChild(downloadBtn);
              imageGrid.appendChild(imageContainer);
            });
            
            sharedDataSection.appendChild(imageGrid);
            hasData = true;
          }
          
          if (shared.image && (!shared.images || shared.images.length === 0)) {
            const imageContainer = document.createElement('div');
            imageContainer.style.display = 'flex';
            imageContainer.style.flexDirection = 'column';
            imageContainer.style.alignItems = 'center';
            imageContainer.style.marginTop = '16px';
            
            const img = document.createElement('img');
            img.src = shared.image;
            img.alt = 'Shared Image';
            img.style.maxWidth = '120px';
            img.style.maxHeight = '120px';
            img.style.borderRadius = '8px';
            img.style.marginBottom = '12px';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" style="margin-right: 6px;"><path d="M12 16l-5-5h3V4h4v7h3l-5 5zm-7 4h12v-2H5v2z"/></svg>Download Image';
            downloadBtn.style.background = 'linear-gradient(90deg, #00ffe7, #00ff85)';
            downloadBtn.style.color = '#101114';
            downloadBtn.style.border = 'none';
            downloadBtn.style.borderRadius = '8px';
            downloadBtn.style.padding = '8px 16px';
            downloadBtn.style.fontWeight = '600';
            downloadBtn.style.cursor = 'pointer';
            downloadBtn.style.display = 'flex';
            downloadBtn.style.alignItems = 'center';
            downloadBtn.style.justifyContent = 'center';
            downloadBtn.onclick = function() {
              const a = createDownloadLink(shared.image, '', 'shared-image.png', true);
              a.click();
            };
            
            imageContainer.appendChild(img);
            imageContainer.appendChild(downloadBtn);
            sharedDataSection.appendChild(imageContainer);
            hasData = true;
          }
          
          if (!hasData) {
            sharedDataSection.innerHTML = '<div class="qr-stats"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 6.293a1 1 0 00-1.414 0L9 12.586l-2.293-2.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l7-7a1 1 0 000-1.414z" clip-rule="evenodd"/></svg>20,000+ files shared securely</div><div class="qr-desc">No account needed - just scan & go</div>';
          }
          
          // Hide QR code and show scan again button when content is received
          if (hasData) {
            qrImage.style.display = 'none';
            scanAgainSection.style.display = 'block';
          }
        }
        function pollShared() {
          fetch('/share/poll?sid=' + sid)
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (data.status === 'ready') {
                showSharedData(data.shared);
              } else {
                setTimeout(pollShared, 2000);
              }
            })
            .catch(function() { setTimeout(pollShared, 2000); });
        }
        pollShared();
      </script>
    </body>
    </html>
  `);
});

// Serve the share page (GET)
router.get('/share', (req, res) => {
  const { sid, msg, type, url } = req.query;
  if (!sid) {
    return res.status(400).send(renderSharePage({ sid: '', message: 'Missing session ID (sid)', messageType: 'error' }));
  }
  res.send(renderSharePage({ sid, message: msg, messageType: type, urlValue: url }));
});

// Handle form submission (POST)
router.post('/share', upload.array('image'), (req, res) => {
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
    totalFilesShared.count += req.files.length;
  }
  if (!shared.url && (!shared.images || shared.images.length === 0)) {
    return res.status(400).send(renderSharePage({ sid, message: 'Please provide a valid URL or upload an image.', messageType: 'error', urlValue: url }));
  }
  createSession(sid, shared);
  // Show success message on same page
  res.send(renderSharePage({ sid, message: 'Shared successfully! You can close this page.', messageType: 'success', urlValue: '' }));
});

// API for extension to poll for shared data
router.get('/poll', (req, res) => {
  const { sid } = req.query;
  if (!sid) return res.status(400).json({ error: 'Missing sid' });
  const shared = getSession(sid);
  if (!shared) return res.json({ status: 'waiting' });
  // One-time use: clear after sending
  // The session will be cleaned up by the periodic cleanup
  res.json({ status: 'ready', shared });
});

module.exports = router; 

