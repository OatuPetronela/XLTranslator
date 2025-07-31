require('dotenv').config();

const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    return res.status(401).json({ error: 'Authentication required', authenticated: false });
  }
};

const checkCredentials = (email, password) => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@xltranslator.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'SecurePassword123!';
  
  return email === adminEmail && password === adminPassword;
};

module.exports = {
  requireAuth,
  checkCredentials
};