require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const ExcelProcessor = require('./services/ExcelProcessor');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
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

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Main translation endpoint
app.post('/api/translate', upload.single('excelFile'), async (req, res) => {
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
      stats: result.stats
    });

  } catch (error) {
    // Delete uploaded file in case of error
    if (req.file) {
      fs.removeSync(req.file.path).catch(() => {});
    }
    
    res.status(500).json({ 
      error: 'Error processing file',
      details: error.message 
    });
  }
});

// Download translated file
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../output', req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Download error' });
      } else {
        // Delete file after 5 minutes
        setTimeout(() => {
          fs.remove(filePath).catch(() => {});
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
    res.json({ success: true, message: 'Configuration is OK!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  // Application started successfully
});