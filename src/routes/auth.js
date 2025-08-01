const express = require('express');
const { checkCredentials, loginRateLimit } = require('../middleware/auth');
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
router.post('/login', loginRateLimit, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const isValid = await checkCredentials(email, password);
    
    if (isValid) {
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
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Authentication system error' 
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