require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { auth, requiresAuth } = require('express-openid-connect');
const ExcelProcessor = require('./services/ExcelProcessor');

const app = express();
const PORT = process.env.PORT || 3000;

// Validate Auth0 configuration
if (!process.env.AUTH0_SECRET || !process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_ISSUER_BASE_URL) {
  console.error('❌ Missing Auth0 configuration. Please check your .env file.');
  console.log('Required variables: AUTH0_SECRET, AUTH0_CLIENT_ID, AUTH0_ISSUER_BASE_URL');
  process.exit(1);
}

const auth0Config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.BASE_URL || `http://localhost:${PORT}`,
  clientID: process.env.AUTH0_CLIENT_ID,   
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  routes: {
    login: '/login',
    logout: '/logout',
    callback: '/callback'
  }
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(auth(auth0Config));
app.use(express.static('public'));

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
    }
  }
});

const processor = new ExcelProcessor();

// Serve main page with auth info
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Inject user info into HTML
  if (req.oidc.isAuthenticated()) {
    const userInfo = `
      <div class="user-info">
        <p>Welcome, ${req.oidc.user.name || req.oidc.user.email}!</p>
        <a href="/logout" class="logout-btn">Logout</a>
      </div>
    `;
    html = html.replace('<div class="header">', `<div class="header">${userInfo}`);
  } else {
    const loginInfo = `
      <div class="login-required">
        <p>Please login to use the translator</p>
        <a href="/login" class="login-btn">Login</a>
      </div>
    `;
    html = html.replace('<div class="main-content">', `<div class="main-content">${loginInfo}`);
  }
  
  res.send(html);
});

// Protected translation endpoint - requires authentication
app.post('/api/translate', requiresAuth(), upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file was uploaded' });
    }
    
    // Process the file
    const result = await processor.processExcelFile(req.file.path);
    
    // Delete uploaded file
    fs.removeSync(req.file.path);
    
    res.json({
      success: true,
      message: 'Translation completed successfully!',
      downloadUrl: `/api/download/${result.filename}`,
      stats: result.stats,
      user: req.oidc.user.email 
    });

  } catch (error) {
    // Delete uploaded file in case of error
    if (req.file) {
      try {
        fs.removeSync(req.file.path);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    res.status(500).json({ 
      error: 'Error processing file',
      details: error.message 
    });
  }
});

// Protected download endpoint
app.get('/api/download/:filename', requiresAuth(), (req, res) => {
  const filePath = path.join(__dirname, '../output', req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Download error' });
      } else {
        // Delete file after 5 minutes
        setTimeout(() => {
          fs.remove(filePath).catch(() => {
            // Ignore cleanup errors
          });
        }, 5 * 60 * 1000);
      }
    });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  try {
    await processor.testConfiguration();
    res.json({ 
      success: true, 
      message: 'Configuration is OK!',
      authenticated: req.oidc.isAuthenticated(),
      user: req.oidc.isAuthenticated() ? req.oidc.user.email : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API to check auth status
app.get('/api/auth/user', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        name: req.oidc.user.name,
        email: req.oidc.user.email,
        picture: req.oidc.user.picture
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Excel AI Translator with Auth0 running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});