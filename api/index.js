const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');
const multer = require('multer');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// In-memory stores
const sessions = new Map();
const sharedData = new Map();
const sessionTimeouts = new Map();

// Session timeout (5 minutes)
const SESSION_TIMEOUT = 5 * 60 * 1000;

// Clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [sid, timestamp] of sessionTimeouts.entries()) {
    if (now - timestamp > SESSION_TIMEOUT) {
      sessions.delete(sid);
      sharedData.delete(sid);
      sessionTimeouts.delete(sid);
    }
  }
}, 60000);

// Helper functions
function createSession(sid, data) {
  sessions.set(sid, data);
  sessionTimeouts.set(sid, Date.now());
}

function getSession(sid) {
  const timestamp = sessionTimeouts.get(sid);
  if (!timestamp) return null;
  
  const now = Date.now();
  if (now - timestamp > SESSION_TIMEOUT) {
    sessions.delete(sid);
    sharedData.delete(sid);
    sessionTimeouts.delete(sid);
    return null;
  }
  
  return sessions.get(sid);
}

function createSharedData(sid, data) {
  sharedData.set(sid, data);
  sessionTimeouts.set(sid, Date.now());
}

function getSharedData(sid) {
  const timestamp = sessionTimeouts.get(sid);
  if (!timestamp) return null;
  
  const now = Date.now();
  if (now - timestamp > SESSION_TIMEOUT) {
    sessions.delete(sid);
    sharedData.delete(sid);
    sessionTimeouts.delete(sid);
    return null;
  }
  
  return sharedData.get(sid);
}

// Landing page with QR code
app.get('/', (req, res) => {
  const sid = Math.random().toString(36).substring(2, 15);
  const shareUrl = `${req.protocol}://${req.get('host')}/share?sid=${sid}`;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZapKey - Secure Data Sharing</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #333;
            }
            
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                text-align: center;
                max-width: 500px;
                width: 90%;
            }
            
            .logo {
                font-size: 2.5rem;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
            }
            
            .tagline {
                color: #666;
                margin-bottom: 30px;
                font-size: 1.1rem;
            }
            
            .qr-container {
                background: #f8f9fa;
                border-radius: 15px;
                padding: 30px;
                margin-bottom: 30px;
                border: 2px dashed #dee2e6;
            }
            
            .qr-code {
                width: 200px;
                height: 200px;
                margin: 0 auto 20px;
                background: white;
                border-radius: 10px;
                padding: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .instructions {
                color: #666;
                font-size: 0.9rem;
                line-height: 1.5;
            }
            
            .features {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-top: 30px;
            }
            
            .feature {
                text-align: center;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 10px;
            }
            
            .feature-icon {
                font-size: 2rem;
                margin-bottom: 10px;
            }
            
            .feature-title {
                font-weight: 600;
                margin-bottom: 5px;
            }
            
            .feature-desc {
                font-size: 0.8rem;
                color: #666;
            }
            
            /* Shared data styles */
            .shared-data {
                background: #f8f9fa;
                border-radius: 15px;
                padding: 30px;
                margin-top: 30px;
                border: 2px solid #28a745;
            }
            
            .shared-data h3 {
                color: #28a745;
                margin-bottom: 20px;
                font-size: 1.3rem;
            }
            
            .url-link {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                margin: 10px 0;
                word-break: break-all;
                transition: transform 0.2s;
            }
            
            .url-link:hover {
                transform: translateY(-2px);
            }
            
            .file-image {
                max-width: 100%;
                max-height: 300px;
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                margin: 15px 0;
            }
            
            .download-btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                margin: 10px 0;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .download-btn:hover {
                transform: translateY(-2px);
            }
            
            .loading-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                color: #666;
                margin-top: 20px;
            }
            
            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .hidden {
                display: none;
            }
            
            .reload-btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                color: white;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 1rem;
                cursor: pointer;
                transition: transform 0.2s;
                margin-top: 10px;
            }
            
            .reload-btn:hover {
                transform: translateY(-2px);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">ZapKey</div>
            <div class="tagline">Secure data sharing made simple</div>
            
            <div class="qr-container" id="qr-container">
                <div class="qr-code" id="qr-code">
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">
                        Loading QR Code...
                    </div>
                </div>
                <div class="instructions">
                    Scan this QR code with any device to share files, images, or URLs securely
                </div>
            </div>
            
            <!-- Loading indicator for shared data -->
            <div class="loading-indicator" id="loading-indicator">
                <div class="spinner"></div>
                <span>Waiting for shared data...</span>
            </div>
            
            <!-- Shared data container -->
            <div class="shared-data hidden" id="shared-data"></div>
            
            <div class="features" id="features">
                <div class="feature">
                    <div class="feature-icon">📱</div>
                    <div class="feature-title">Any Device</div>
                    <div class="feature-desc">Works on phones, tablets, computers</div>
                </div>
                <div class="feature">
                    <div class="feature-icon">🔒</div>
                    <div class="feature-title">Secure</div>
                    <div class="feature-desc">End-to-end encrypted sharing</div>
                </div>
            </div>
        </div>
        
        <script>
            const sid = '${sid}';
            const shareUrl = '${shareUrl}';
            const qrContainer = document.getElementById('qr-code');
            const loadingIndicator = document.getElementById('loading-indicator');
            const sharedData = document.getElementById('shared-data');
            const features = document.getElementById('features');
            
            // Generate QR code
            const qrImage = new Image();
            qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(shareUrl);
            qrImage.style.width = '100%';
            qrImage.style.height = '100%';
            qrImage.style.borderRadius = '8px';
            
            qrContainer.innerHTML = '';
            qrContainer.appendChild(qrImage);
            
            // Store session
            fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sid: sid, url: window.location.href })
            });
            
            // Poll for shared data
            function pollForData() {
                fetch('/poll?sid=' + sid)
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'ready') {
                            // Hide loading indicator and QR container
                            loadingIndicator.classList.add('hidden');
                            qrContainer.classList.add('hidden');
                            
                            // Show shared data
                            sharedData.classList.remove('hidden');
                            
                            if (data.data.url) {
                                sharedData.innerHTML = \`
                                    <h3>📎 Shared URL Received!</h3>
                                    <a href="\${data.data.url}" target="_blank" class="url-link">
                                        \${data.data.url}
                                    </a>
                                    <br>
                                    <a href="\${data.data.url}" target="_blank" class="download-btn">
                                        🔗 Open Link
                                    </a>
                                    <br><br>
                                    <button onclick="location.reload()" class="reload-btn">
                                        🔄 Reload to receive more
                                    </button>
                                \`;
                            } else if (data.data.file) {
                                const fileData = data.data.file;
                                const dataUrl = \`data:\${fileData.type};base64,\${fileData.data}\`;
                                
                                if (fileData.type.startsWith('image/')) {
                                    sharedData.innerHTML = \`
                                        <h3>🖼️ Shared Image Received!</h3>
                                        <img src="\${dataUrl}" alt="Shared Image" class="file-image">
                                        <br>
                                        <a href="\${dataUrl}" download="\${fileData.name}" class="download-btn">
                                            💾 Download Image
                                        </a>
                                        <br><br>
                                        <button onclick="location.reload()" class="reload-btn">
                                            🔄 Reload to receive more
                                        </button>
                                    \`;
                                } else {
                                    sharedData.innerHTML = \`
                                        <h3>📁 Shared File Received!</h3>
                                        <p><strong>File:</strong> \${fileData.name}</p>
                                        <a href="\${dataUrl}" download="\${fileData.name}" class="download-btn">
                                            💾 Download File
                                        </a>
                                        <br><br>
                                        <button onclick="location.reload()" class="reload-btn">
                                            🔄 Reload to receive more
                                        </button>
                                    \`;
                                }
                            }
                            
                            // Hide features when data is received
                            features.classList.add('hidden');
                            
                        } else {
                            // Continue polling
                            setTimeout(pollForData, 2000);
                        }
                    })
                    .catch(error => {
                        console.error('Polling error:', error);
                        setTimeout(pollForData, 2000);
                    });
            }
            
            // Start polling after a short delay
            setTimeout(pollForData, 1000);
        </script>
    </body>
    </html>
  `);
});

// Share page
app.get('/share', (req, res) => {
  const { sid } = req.query;
  
  if (!sid) {
    return res.status(400).send('Missing session ID');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZapKey - Share Data</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #333;
            }
            
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                max-width: 500px;
                width: 90%;
            }
            
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            
            .logo {
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
            }
            
            .subtitle {
                color: #666;
                font-size: 1rem;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            .form-label {
                display: block;
                margin-bottom: 8px;
                font-weight: 600;
                color: #333;
            }
            
            .form-input {
                width: 100%;
                padding: 12px 16px;
                border: 2px solid #e1e5e9;
                border-radius: 10px;
                font-size: 1rem;
                transition: border-color 0.3s;
            }
            
            .form-input:focus {
                outline: none;
                border-color: #667eea;
            }
            
            .file-input {
                display: none;
            }
            
            .file-label {
                display: block;
                padding: 12px 16px;
                border: 2px dashed #e1e5e9;
                border-radius: 10px;
                text-align: center;
                cursor: pointer;
                transition: border-color 0.3s;
                color: #666;
            }
            
            .file-label:hover {
                border-color: #667eea;
                color: #667eea;
            }
            
            .submit-btn {
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s;
            }
            
            .submit-btn:hover {
                transform: translateY(-2px);
            }
            
            .submit-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .success-message {
                background: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .error-message {
                background: #f8d7da;
                color: #721c24;
                padding: 15px;
                border-radius: 10px;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .or-divider {
                text-align: center;
                margin: 20px 0;
                color: #666;
                position: relative;
            }
            
            .or-divider::before,
            .or-divider::after {
                content: '';
                position: absolute;
                top: 50%;
                width: 45%;
                height: 1px;
                background: #e1e5e9;
            }
            
            .or-divider::before {
                left: 0;
            }
            
            .or-divider::after {
                right: 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">ZapKey</div>
                <div class="subtitle">Share your data securely</div>
            </div>
            
            <form id="share-form" enctype="multipart/form-data">
                <input type="hidden" name="sid" value="${sid}">
                
                <div class="form-group">
                    <label class="form-label">Share a URL</label>
                    <input type="url" name="url" class="form-input" placeholder="https://example.com">
                </div>
                
                <div class="or-divider">OR</div>
                
                <div class="form-group">
                    <label class="form-label">Upload Image/File</label>
                    <input type="file" name="file" class="file-input" id="file-input" accept="image/*">
                    <label for="file-input" class="file-label" id="file-label">
                        📁 Choose a file or drag it here
                    </label>
                </div>
                
                <button type="submit" class="submit-btn" id="submit-btn">
                    Share Data
                </button>
            </form>
        </div>
        
        <script>
            const form = document.getElementById('share-form');
            const fileInput = document.getElementById('file-input');
            const fileLabel = document.getElementById('file-label');
            const submitBtn = document.getElementById('submit-btn');
            
            // File input handling
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    fileLabel.textContent = \`📁 \${file.name}\`;
                } else {
                    fileLabel.textContent = '📁 Choose a file or drag it here';
                }
            });
            
            // Form submission
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const formData = new FormData(form);
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sharing...';
                
                try {
                    const response = await fetch('/share', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.ok) {
                        form.innerHTML = '<div class="success-message">✅ Data shared successfully! The recipient will receive it shortly.</div>';
                    } else {
                        const error = await response.text();
                        form.innerHTML = '<div class="error-message">❌ Error: ' + error + '</div>';
                    }
                } catch (error) {
                    form.innerHTML = '<div class="error-message">❌ Network error. Please try again.</div>';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Receiver page
app.get('/receive', (req, res) => {
  const { sid } = req.query;
  
  if (!sid) {
    return res.status(400).send('Missing session ID');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ZapKey - Receive Data</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Inter', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #333;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                max-width: 500px;
                width: 90%;
                text-align: center;
            }
            .logo {
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 10px;
            }
            .spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .content { margin-top: 20px; }
            .url-link {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                margin: 10px 0;
                word-break: break-all;
            }
            .file-image {
                max-width: 100%;
                max-height: 300px;
                border-radius: 10px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .download-btn {
                display: inline-block;
                padding: 12px 24px;
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                text-decoration: none;
                border-radius: 10px;
                font-weight: 600;
                margin: 10px 0;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">ZapKey</div>
            <div id="loading">
                <div class="spinner"></div>
                <p>Waiting for shared data...</p>
            </div>
            <div id="content" class="content" style="display: none;"></div>
        </div>
        
        <script>
            const sid = '${sid}';
            const loading = document.getElementById('loading');
            const content = document.getElementById('content');
            
            function pollForData() {
                fetch('/poll?sid=' + sid)
                    .then(response => response.json())
                    .then(data => {
                        if (data.status === 'ready') {
                            loading.style.display = 'none';
                            content.style.display = 'block';
                            
                            if (data.data.url) {
                                content.innerHTML = \`
                                    <h3>Shared URL</h3>
                                    <a href="\${data.data.url}" target="_blank" class="url-link">
                                        \${data.data.url}
                                    </a>
                                    <br>
                                    <a href="\${data.data.url}" target="_blank" class="download-btn">
                                        Open Link
                                    </a>
                                \`;
                            } else if (data.data.file) {
                                const fileData = data.data.file;
                                const dataUrl = \`data:\${fileData.type};base64,\${fileData.data}\`;
                                
                                if (fileData.type.startsWith('image/')) {
                                    content.innerHTML = \`
                                        <h3>Shared Image</h3>
                                        <img src="\${dataUrl}" alt="Shared Image" class="file-image">
                                        <br>
                                        <a href="\${dataUrl}" download="\${fileData.name}" class="download-btn">
                                            Download Image
                                        </a>
                                    \`;
                                } else {
                                    content.innerHTML = \`
                                        <h3>Shared File</h3>
                                        <p>File: \${fileData.name}</p>
                                        <a href="\${dataUrl}" download="\${fileData.name}" class="download-btn">
                                            Download File
                                        </a>
                                    \`;
                                }
                            }
                        } else {
                            setTimeout(pollForData, 2000);
                        }
                    })
                    .catch(error => {
                        console.error('Polling error:', error);
                        setTimeout(pollForData, 2000);
                    });
            }
            
            pollForData();
        </script>
    </body>
    </html>
  `);
});

// API endpoints
app.post('/api/sessions', (req, res) => {
  const { sid, url } = req.body;
  if (!sid || !url) {
    return res.status(400).json({ error: 'Missing sid or url' });
  }
  
  createSession(sid, { url, timestamp: Date.now() });
  res.json({ success: true });
});

app.post('/share', upload.single('file'), (req, res) => {
  const { sid, url } = req.body;
  
  if (!sid) {
    return res.status(400).send('Missing session ID');
  }
  
  let sharedData = {};
  
  if (url && url.startsWith('http')) {
    sharedData.url = url;
  }
  
  if (req.file) {
    sharedData.file = {
      name: req.file.originalname,
      type: req.file.mimetype,
      data: req.file.buffer.toString('base64')
    };
  }
  
  if (!sharedData.url && !sharedData.file) {
    return res.status(400).send('Please provide a URL or upload a file');
  }
  
  createSharedData(sid, sharedData);
  res.send('Data shared successfully');
});

app.get('/poll', (req, res) => {
  const { sid } = req.query;
  
  if (!sid) {
    return res.status(400).json({ error: 'Missing sid' });
  }
  
  const data = getSharedData(sid);
  
  if (!data) {
    return res.json({ status: 'waiting' });
  }
  
  // Clear the data after sending (one-time use)
  sharedData.delete(sid);
  
  res.json({ status: 'ready', data });
});

module.exports = app; 
