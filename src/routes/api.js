const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { requireAuth } = require('../middleware/auth');
const ExcelProcessor = require('../services/ExcelProcessor');
const { configureMulter } = require('../middleware/multer');

const router = express.Router();
const upload = configureMulter();
const processor = new ExcelProcessor();

router.post('/translate', requireAuth, upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file was uploaded' });
    }
    
    const result = await processor.processExcelFile(req.file.path);
    
    fs.removeSync(req.file.path);
    
    res.json({
      success: true,
      message: 'Translation completed successfully!',
      downloadUrl: `/api/download/${result.filename}`,
      stats: result.stats,
      user: req.session.userEmail 
    });

  } catch (error) {
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

router.get('/download/:filename', requireAuth, (req, res) => {
  const filePath = path.join(__dirname, '../../output', req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Download error' });
      } else {
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

router.get('/test', async (req, res) => {
  try {
    await processor.testConfiguration();
    res.json({ 
      success: true, 
      message: 'Configuration is OK!',
      authenticated: req.session && req.session.authenticated,
      user: req.session && req.session.authenticated ? req.session.userEmail : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;