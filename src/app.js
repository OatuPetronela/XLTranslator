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

// Configurare multer pentru upload
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
      cb(new Error('Doar fișiere Excel (.xlsx, .xls) sunt permise!'), false);
    }
  }
});

const processor = new ExcelProcessor();

// Servește pagina principală
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Endpoint principal pentru traducere
app.post('/api/translate', upload.single('excelFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nu a fost uplodat niciun fișier Excel' });
    }

    console.log(`📁 Procesare fișier: ${req.file.originalname}`);
    
    // Procesează fișierul
    const result = await processor.processExcelFile(req.file.path);
    
    // Șterge fișierul uploadat
    fs.removeSync(req.file.path);
    
    res.json({
      success: true,
      message: 'Traducerea a fost completată cu succes!',
      downloadUrl: `/api/download/${result.filename}`,
      stats: result.stats
    });

  } catch (error) {
    console.error('❌ Eroare:', error);
    
    // Șterge fișierul uploadat în caz de eroare
    if (req.file) {
      fs.removeSync(req.file.path).catch(() => {});
    }
    
    res.status(500).json({ 
      error: 'Eroare în procesarea fișierului',
      details: error.message 
    });
  }
});

// Download fișier tradus
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../output', req.params.filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).json({ error: 'Eroare în download' });
      } else {
        // Șterge fișierul după 5 minute
        setTimeout(() => {
          fs.remove(filePath).catch(console.error);
        }, 5 * 60 * 1000);
      }
    });
  } else {
    res.status(404).json({ error: 'Fișierul nu a fost găsit' });
  }
});

// Test endpoint
app.get('/api/test', async (req, res) => {
  try {
    await processor.testConfiguration();
    res.json({ success: true, message: 'Configurația este OK!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Excel AI Translator pornit pe portul ${PORT}`);
  console.log(`🌐 Deschide: http://localhost:${PORT}`);
});