const express = require('express');
const path = require('path');
const fs = require('fs-extra');

const router = express.Router();

router.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../../public/index.html');
  res.sendFile(indexPath);
});

module.exports = router;