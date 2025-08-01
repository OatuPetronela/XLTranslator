require('dotenv').config();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required', authenticated: false });
  }
};

const checkCredentials = async (email, password) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  
  if (!adminEmail || !adminPasswordHash) {
    throw new Error('Authentication configuration missing');
  }
  
  if (email !== adminEmail) {
    return false;
  }
  
  try {
    return await bcrypt.compare(password, adminPasswordHash);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  requireAuth,
  checkCredentials,
  loginRateLimit
};