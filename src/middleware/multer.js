const multer = require('multer');
const fs = require('fs-extra');

const configureMulter = () => {
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

  return multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (file.originalname.match(/\.(xlsx|xls)$/)) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
      }
    }
  });
};

module.exports = { configureMulter };