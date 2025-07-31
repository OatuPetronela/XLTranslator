const express = require('express');
const { checkCredentials } = require('../middleware/auth');
const router = express.Router();

// Check authentication status
router.get('/user', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.json({
      authenticated: true,
      user: {
        name: 'Admin',
        email: req.session.userEmail
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Login endpoint
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  if (checkCredentials(email, password)) {
    req.session.authenticated = true;
    req.session.userEmail = email;
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: { name: 'Admin', email: email }
    });
  } else {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid email or password' 
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

module.exports = router;