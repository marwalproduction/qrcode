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
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 25%, #0f0f23 50%, #1a1a1a 75%, #0c0c0c 100%);
                color: #ffffff;
                min-height: 100vh;
                overflow-x: hidden;
                position: relative;
            }
            
            /* Animated background particles */
            .particles {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
            }
            
            .particle {
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                animation: float 6s ease-in-out infinite;
            }
            
            .particle:nth-child(1) { left: 10%; animation-delay: 0s; }
            .particle:nth-child(2) { left: 20%; animation-delay: 1s; }
            .particle:nth-child(3) { left: 30%; animation-delay: 2s; }
            .particle:nth-child(4) { left: 40%; animation-delay: 3s; }
            .particle:nth-child(5) { left: 50%; animation-delay: 4s; }
            .particle:nth-child(6) { left: 60%; animation-delay: 5s; }
            .particle:nth-child(7) { left: 70%; animation-delay: 0.5s; }
            .particle:nth-child(8) { left: 80%; animation-delay: 1.5s; }
            .particle:nth-child(9) { left: 90%; animation-delay: 2.5s; }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0; }
                50% { transform: translateY(-100px) rotate(180deg); opacity: 1; }
            }
            
            .container {
                position: relative;
                z-index: 2;
                max-width: 1200px;
                margin: 0 auto;
                padding: 40px 20px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            
            /* Hero Section */
            .hero {
                text-align: center;
                margin-bottom: 60px;
                animation: fadeInUp 1s ease-out;
            }
            
            .logo {
                font-size: 4rem;
                font-weight: 800;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%);
                background-size: 300% 300%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 16px;
                letter-spacing: -0.02em;
                animation: gradientShift 3s ease-in-out infinite;
            }
            
            @keyframes gradientShift {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }
            
            .tagline {
                color: #a8a8a8;
                font-size: 1.25rem;
                font-weight: 400;
                margin-bottom: 8px;
                letter-spacing: -0.01em;
                animation: fadeInUp 1s ease-out 0.2s both;
            }
            
            .subtitle {
                color: #666;
                font-size: 1rem;
                font-weight: 300;
                animation: fadeInUp 1s ease-out 0.4s both;
            }
            
            /* Main Content Grid */
            .main-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 60px;
                align-items: center;
                width: 100%;
                max-width: 1000px;
            }
            
            /* QR Section */
            .qr-section {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 32px;
                padding: 50px 40px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(30px);
                -webkit-backdrop-filter: blur(30px);
                position: relative;
                overflow: hidden;
                animation: fadeInLeft 1s ease-out 0.6s both;
            }
            
            .qr-section::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                animation: shimmer 3s infinite;
            }
            
            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            .tagline {
                color: #a8a8a8;
                font-size: 1.25rem;
                font-weight: 400;
                margin-bottom: 8px;
                letter-spacing: -0.01em;
                animation: fadeInUp 1s ease-out 0.2s both;
            }
            
            .subtitle {
                color: #666;
                font-size: 1rem;
                font-weight: 300;
                animation: fadeInUp 1s ease-out 0.4s both;
            }
            
            /* Main Content Grid */
            .main-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 60px;
                align-items: center;
                width: 100%;
                max-width: 1000px;
            }
            
            /* QR Section */
            .qr-section {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 32px;
                padding: 50px 40px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(30px);
                -webkit-backdrop-filter: blur(30px);
                position: relative;
                overflow: hidden;
                animation: fadeInLeft 1s ease-out 0.6s both;
            }
            
            .qr-section::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
                animation: shimmer 3s infinite;
            }
            
            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            
            .qr-code {
                width: 220px;
                height: 220px;
                margin: 0 auto 32px;
                background: #ffffff;
                border-radius: 20px;
                padding: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
            }
            
            .qr-code:hover {
                transform: scale(1.05) rotate(2deg);
                box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
            }
            
            .qr-instructions {
                color: #a8a8a8;
                font-size: 1rem;
                line-height: 1.6;
                font-weight: 400;
                max-width: 280px;
                margin: 0 auto;
                text-align: center;
            }
            
            /* Status Indicator */
            .status-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                color: #a8a8a8;
                font-size: 0.9rem;
                font-weight: 500;
                margin-top: 24px;
                padding: 16px 24px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
            }
            
            .status-indicator:hover {
                background: rgba(255, 255, 255, 0.12);
                border-color: rgba(255, 255, 255, 0.2);
            }
            
            .spinner {
                width: 18px;
                height: 18px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-top: 2px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            /* Features Section */
            .features-section {
                animation: fadeInRight 1s ease-out 0.8s both;
            }
            
            .features-title {
                font-size: 1.5rem;
                font-weight: 700;
                margin-bottom: 32px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-align: center;
            }
            
            .features {
                display: grid;
                grid-template-columns: 1fr;
                gap: 20px;
            }
            
            .feature {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 20px;
                padding: 30px 24px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                position: relative;
                overflow: hidden;
            }
            
            .feature::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .feature:hover {
                transform: translateY(-8px) scale(1.02);
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(102, 126, 234, 0.3);
            }
            
            .feature:hover::before {
                opacity: 1;
            }
            
            .feature-content {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                gap: 20px;
            }
            
            .feature-icon {
                width: 50px;
                height: 50px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
            }
            
            .feature-icon svg {
                width: 24px;
                height: 24px;
                fill: #ffffff;
            }
            
            .feature-text {
                flex: 1;
            }
            
            .feature-title {
                font-weight: 600;
                font-size: 1.1rem;
                margin-bottom: 6px;
                color: #ffffff;
            }
            
            .feature-desc {
                font-size: 0.9rem;
                color: #a8a8a8;
                line-height: 1.5;
            }
            
            /* Shared Data Section */
            .shared-data {
                background: rgba(52, 199, 89, 0.1);
                border: 1px solid rgba(52, 199, 89, 0.2);
                border-radius: 32px;
                padding: 50px 40px;
                margin-top: 40px;
                backdrop-filter: blur(30px);
                -webkit-backdrop-filter: blur(30px);
                position: relative;
                overflow: hidden;
                animation: fadeInUp 0.8s ease-out;
            }
            
            .shared-data::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, rgba(52, 199, 89, 0.05), rgba(52, 199, 89, 0.02));
                pointer-events: none;
            }
            
            .shared-data h3 {
                color: #34c759;
                margin-bottom: 24px;
                font-size: 1.5rem;
                font-weight: 700;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                position: relative;
                z-index: 1;
            }
            
            .shared-data h3 svg {
                width: 24px;
                height: 24px;
                fill: #34c759;
            }
            
            .url-link {
                display: inline-block;
                padding: 18px 28px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                text-decoration: none;
                border-radius: 16px;
                font-weight: 600;
                font-size: 1rem;
                margin: 12px 0;
                word-break: break-all;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: none;
                cursor: pointer;
                position: relative;
                z-index: 1;
            }
            
            .url-link:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
            }
            
            .file-image {
                max-width: 100%;
                max-height: 350px;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                margin: 20px 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
                position: relative;
                z-index: 1;
            }
            
            .download-btn {
                display: inline-block;
                padding: 18px 28px;
                background: linear-gradient(135deg, #34c759, #30d158);
                color: white;
                text-decoration: none;
                border-radius: 16px;
                font-weight: 600;
                font-size: 1rem;
                margin: 12px 0;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: none;
                position: relative;
                z-index: 1;
            }
            
            .download-btn:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(52, 199, 89, 0.4);
            }
            
            .reload-btn {
                display: inline-block;
                padding: 18px 28px;
                background: linear-gradient(135deg, #ff3b30, #ff453a);
                color: white;
                border: none;
                border-radius: 16px;
                font-weight: 600;
                font-size: 1rem;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                margin-top: 20px;
                position: relative;
                z-index: 1;
            }
            
            .reload-btn:hover {
                transform: translateY(-4px);
                box-shadow: 0 12px 32px rgba(255, 59, 48, 0.4);
            }
            
            /* Animations */
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes fadeInRight {
                from {
                    opacity: 0;
                    transform: translateX(30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .hidden {
                display: none;
            }
            
            /* Animations */
            @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes fadeInLeft {
                from {
                    opacity: 0;
                    transform: translateX(-30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            @keyframes fadeInRight {
                from {
                    opacity: 0;
                    transform: translateX(30px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .main-content {
                    grid-template-columns: 1fr;
                    gap: 40px;
                }
                
                .hero {
                    margin-bottom: 40px;
                }
                
                .logo {
                    font-size: 3rem;
                }
                
                .tagline {
                    font-size: 1.1rem;
                }
                
                .qr-section {
                    padding: 40px 30px;
                }
                
                .qr-code {
                    width: 180px;
                    height: 180px;
                }
                
                .feature {
                    padding: 24px 20px;
                }
                
                .feature-content {
                    gap: 16px;
                }
                
                .feature-icon {
                    width: 40px;
                    height: 40px;
                }
                
                .feature-icon svg {
                    width: 20px;
                    height: 20px;
                }
            }
            
            @media (max-width: 480px) {
                .container {
                    padding: 20px 16px;
                }
                
                .logo {
                    font-size: 2.5rem;
                }
                
                .qr-section {
                    padding: 30px 24px;
                }
                
                .qr-code {
                    width: 160px;
                    height: 160px;
                }
            }
            
            /* Responsive Design */
            @media (max-width: 768px) {
                .main-content {
                    grid-template-columns: 1fr;
                    gap: 40px;
                }
                
                .hero {
                    margin-bottom: 40px;
                }
                
                .logo {
                    font-size: 3rem;
                }
                
                .tagline {
                    font-size: 1.1rem;
                }
                
                .qr-section {
                    padding: 40px 30px;
                }
                
                .qr-code {
                    width: 180px;
                    height: 180px;
                }
                
                .feature {
                    padding: 24px 20px;
                }
                
                .feature-content {
                    gap: 16px;
                }
                
                .feature-icon {
                    width: 40px;
                    height: 40px;
                }
                
                .feature-icon svg {
                    width: 20px;
                    height: 20px;
                }
            }
            
            @media (max-width: 480px) {
                .container {
                    padding: 20px 16px;
                }
                
                .logo {
                    font-size: 2.5rem;
                }
                
                .qr-section {
                    padding: 30px 24px;
                }
                
                .qr-code {
                    width: 160px;
                    height: 160px;
                }
            }
        </style>
    </head>
    <body>
        <!-- Animated background particles -->
        <div class="particles">
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
            <div class="particle"></div>
        </div>
        
        <div class="container">
            <!-- Hero Section -->
            <div class="hero">
                <div class="logo">ZapKey</div>
                <div class="tagline">Secure data sharing made simple</div>
                <div class="subtitle">Transfer files, images, and links instantly across any device</div>
            </div>
            
            <!-- Main Content -->
            <div class="main-content">
                <!-- QR Section -->
                <div class="qr-section" id="qr-section">
                    <div class="qr-code" id="qr-code">
                        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #8e8e93;">
                            Loading QR Code...
                        </div>
                    </div>
                    <div class="qr-instructions">
                        Scan this QR code with any device to share files, images, or URLs securely
                    </div>
                    
                    <!-- Status Indicator - Now inside QR box -->
                    <div class="status-indicator" id="status-indicator">
                        <div class="spinner"></div>
                        <span>Waiting for shared data...</span>
                    </div>
                </div>
                
                <!-- Features Section -->
                <div class="features-section">
                    <div class="features" id="features">
                        <div class="feature">
                            <div class="feature-content">
                                <div class="feature-icon">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                    </svg>
                                </div>
                                <div class="feature-text">
                                    <div class="feature-title">Universal Compatibility</div>
                                    <div class="feature-desc">Works seamlessly across phones, tablets, computers, and any device with a camera</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="feature">
                            <div class="feature-content">
                                <div class="feature-icon">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                                    </svg>
                                </div>
                                <div class="feature-text">
                                    <div class="feature-title">Military-Grade Security</div>
                                    <div class="feature-desc">End-to-end encrypted sharing with automatic data expiration for maximum privacy</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="feature">
                            <div class="feature-content">
                                <div class="feature-icon">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M13 2.05v3.03c3.39.49 6 3.39 6 6.92 0 .9-.18 1.75-.5 2.54l2.6 1.53c.56-1.24.9-2.62.9-4.07 0-5.18-3.95-9.45-9-9.95zM12 19c-3.87 0-7-3.13-7-7 0-3.53 2.61-6.43 6-6.92V2.05c-5.05.5-9 4.76-9 9.95 0 5.52 4.47 10 9.99 10 3.31 0 6.24-1.61 8.06-4.09l-2.6-1.53C16.17 17.98 14.21 19 12 19z"/>
                                    </svg>
                                </div>
                                <div class="feature-text">
                                    <div class="feature-title">Lightning Fast</div>
                                    <div class="feature-desc">Instant file transfer with real-time updates and no waiting time</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Shared Data Section -->
            <div class="shared-data hidden" id="shared-data"></div>
        </div>
        
        <script>
            const sid = '${sid}';
            const shareUrl = '${shareUrl}';
            const qrSection = document.getElementById('qr-section');
            const qrContainer = document.getElementById('qr-code');
            const statusIndicator = document.getElementById('status-indicator');
            const sharedData = document.getElementById('shared-data');
            const features = document.getElementById('features');
            
            // Generate QR code
            const qrImage = new Image();
            qrImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(shareUrl);
            qrImage.style.width = '100%';
            qrImage.style.height = '100%';
            qrImage.style.borderRadius = '16px';
            
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
                            // Hide status indicator and QR section
                            statusIndicator.classList.add('hidden');
                            qrSection.classList.add('hidden');
                            
                            // Show shared data
                            sharedData.classList.remove('hidden');
                            
                            if (data.data.url) {
                                sharedData.innerHTML = \`
                                    <h3>
                                        <svg viewBox="0 0 24 24">
                                            <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
                                        </svg>
                                        Shared URL Received
                                    </h3>
                                    <a href="\${data.data.url}" target="_blank" class="url-link">
                                        \${data.data.url}
                                    </a>
                                    <br>
                                    <a href="\${data.data.url}" target="_blank" class="download-btn">
                                        Open Link
                                    </a>
                                    <br><br>
                                    <button onclick="location.reload()" class="reload-btn">
                                        Reload to receive more
                                    </button>
                                \`;
                            } else if (data.data.file) {
                                const fileData = data.data.file;
                                const dataUrl = \`data:\${fileData.type};base64,\${fileData.data}\`;
                                
                                if (fileData.type.startsWith('image/')) {
                                    sharedData.innerHTML = \`
                                        <h3>
                                            <svg viewBox="0 0 24 24">
                                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                                            </svg>
                                            Shared Image Received
                                        </h3>
                                        <img src="\${dataUrl}" alt="Shared Image" class="file-image">
                                        <br>
                                        <a href="\${dataUrl}" download="\${fileData.name}" class="download-btn">
                                            Download Image
                                        </a>
                                        <br>
                                        <button onclick="downloadImage('\${dataUrl}', '\${fileData.name}')" class="download-btn" style="background: linear-gradient(135deg, #ff9500, #ff6b35); margin-top: 10px;">
                                            Download Image (Alternative)
                                        </button>
                                        <br><br>
                                        <button onclick="location.reload()" class="reload-btn">
                                            Reload to receive more
                                        </button>
                                    \`;
                                } else {
                                    sharedData.innerHTML = \`
                                        <h3>
                                            <svg viewBox="0 0 24 24">
                                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                                            </svg>
                                            Shared File Received
                                        </h3>
                                        <p style="color: #a8a8a8; margin-bottom: 20px; font-size: 1.1rem;"><strong>File:</strong> \${fileData.name}</p>
                                        <a href="\${dataUrl}" download="\${fileData.name}" class="download-btn">
                                            Download File
                                        </a>
                                        <br><br>
                                        <button onclick="location.reload()" class="reload-btn">
                                            Reload to receive more
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
            
            // Function to download image
            function downloadImage(dataUrl, fileName) {
                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
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
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 25%, #0f0f23 50%, #1a1a1a 75%, #0c0c0c 100%);
                color: #ffffff;
                min-height: 100vh;
                overflow-x: hidden;
                position: relative;
            }
            
            /* Animated background particles */
            .particles {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
            }
            
            .particle {
                position: absolute;
                width: 2px;
                height: 2px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                animation: float 6s ease-in-out infinite;
            }
            
            .particle:nth-child(1) { left: 10%; animation-delay: 0s; }
            .particle:nth-child(2) { left: 20%; animation-delay: 1s; }
            .particle:nth-child(3) { left: 30%; animation-delay: 2s; }
            .particle:nth-child(4) { left: 40%; animation-delay: 3s; }
            .particle:nth-child(5) { left: 50%; animation-delay: 4s; }
            .particle:nth-child(6) { left: 60%; animation-delay: 5s; }
            .particle:nth-child(7) { left: 70%; animation-delay: 0.5s; }
            .particle:nth-child(8) { left: 80%; animation-delay: 1.5s; }
            .particle:nth-child(9) { left: 90%; animation-delay: 2.5s; }
            
            @keyframes float {
                0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0; }
                50% { transform: translateY(-100px) rotate(180deg); opacity: 1; }
            }
            
            .container {
                position: relative;
                z-index: 2;
                max-width: 1200px;
                margin: 0 auto;
                padding: 40px 20px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            
            .header {
                margin-bottom: 40px;
            }
            
            .logo {
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #ffffff 0%, #a8a8a8 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 8px;
                letter-spacing: -0.02em;
            }
            
            .subtitle {
                color: #8e8e93;
                font-size: 1rem;
                font-weight: 400;
                letter-spacing: -0.01em;
            }
            
            .form-container {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 24px;
                padding: 40px 32px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            }
            
            .form-group {
                margin-bottom: 24px;
                text-align: left;
            }
            
            .form-label {
                display: block;
                margin-bottom: 12px;
                font-weight: 600;
                color: #ffffff;
                font-size: 0.9375rem;
            }
            
            .form-input {
                width: 100%;
                padding: 16px 20px;
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 12px;
                font-size: 1rem;
                background: rgba(255, 255, 255, 0.05);
                color: #ffffff;
                transition: all 0.3s ease;
                font-family: inherit;
            }
            
            .form-input:focus {
                outline: none;
                border-color: #007aff;
                background: rgba(255, 255, 255, 0.08);
                box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
            }
            
            .form-input::placeholder {
                color: #8e8e93;
            }
            
            .file-input {
                display: none;
            }
            
            .file-label {
                display: block;
                padding: 20px;
                border: 2px dashed rgba(255, 255, 255, 0.3);
                border-radius: 12px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                color: #8e8e93;
                background: rgba(255, 255, 255, 0.02);
                font-size: 0.9375rem;
            }
            
            .file-label:hover {
                border-color: #007aff;
                color: #007aff;
                background: rgba(0, 122, 255, 0.05);
            }
            
            .file-label svg {
                width: 24px;
                height: 24px;
                margin-bottom: 8px;
                fill: currentColor;
            }
            
            .submit-btn {
                width: 100%;
                padding: 18px;
                background: linear-gradient(135deg, #007aff, #5856d6);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                font-family: inherit;
            }
            
            .submit-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(0, 122, 255, 0.3);
            }
            
            .submit-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            
            .success-message {
                background: rgba(52, 199, 89, 0.1);
                color: #34c759;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
                border: 1px solid rgba(52, 199, 89, 0.2);
                font-weight: 500;
            }
            
            .error-message {
                background: rgba(255, 59, 48, 0.1);
                color: #ff3b30;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 20px;
                text-align: center;
                border: 1px solid rgba(255, 59, 48, 0.2);
                font-weight: 500;
            }
            
            .or-divider {
                text-align: center;
                margin: 32px 0;
                color: #8e8e93;
                position: relative;
                font-size: 0.875rem;
                font-weight: 500;
            }
            
            .or-divider::before,
            .or-divider::after {
                content: '';
                position: absolute;
                top: 50%;
                width: 40%;
                height: 1px;
                background: rgba(255, 255, 255, 0.1);
            }
            
            .or-divider::before {
                left: 0;
            }
            
            .or-divider::after {
                right: 0;
            }
            
            @media (max-width: 480px) {
                .container {
                    width: 95%;
                }
                
                .form-container {
                    padding: 32px 24px;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">ZapKey</div>
                <div class="subtitle">Share your data securely</div>
            </div>
            
            <div class="form-container">
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
                            <svg viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            <div>Choose a file or drag it here</div>
                        </label>
                    </div>
                    
                    <button type="submit" class="submit-btn" id="submit-btn">
                        Share Data
                    </button>
                </form>
            </div>
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
                    fileLabel.innerHTML = \`
                        <svg viewBox="0 0 24 24">
                            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                        </svg>
                        <div>\${file.name}</div>
                    \`;
                    fileLabel.style.color = '#007aff';
                    fileLabel.style.borderColor = '#007aff';
                } else {
                    fileLabel.innerHTML = \`
                        <svg viewBox="0 0 24 24">
                            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                        <div>Choose a file or drag it here</div>
                    \`;
                    fileLabel.style.color = '#8e8e93';
                    fileLabel.style.borderColor = 'rgba(255, 255, 255, 0.3)';
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
                        form.innerHTML = '<div class="success-message">Data shared successfully! The recipient will receive it shortly.</div>';
                    } else {
                        const error = await response.text();
                        form.innerHTML = '<div class="error-message">Error: ' + error + '</div>';
                    }
                } catch (error) {
                    form.innerHTML = '<div class="error-message">Network error. Please try again.</div>';
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
