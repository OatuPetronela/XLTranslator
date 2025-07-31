const express = require('express');
const path = require('path');
const fs = require('fs-extra');

const router = express.Router();

router.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '../../public/index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  
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

module.exports = router;