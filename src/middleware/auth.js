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
    console.error('Authentication configuration missing');
    throw new Error('Authentication configuration missing');
  }
  
  if (email !== adminEmail) {
    return false;
  }
  
  try {
    const isPasswordValid = await bcrypt.compare(password, adminPasswordHash);
    return isPasswordValid;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: process.env.NODE_ENV === 'production',
});

module.exports = {
  requireAuth,
  checkCredentials,
  loginRateLimit
};