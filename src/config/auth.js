require('dotenv').config();

const validateAuth0Config = () => {
  const requiredVars = ['AUTH0_SECRET', 'AUTH0_CLIENT_ID', 'AUTH0_ISSUER_BASE_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.warn(`⚠️ Missing Auth0 configuration: ${missing.join(', ')}`);
    console.warn('Authentication will be disabled. Set these environment variables to enable Auth0.');
    return false;
  }
  return true;
};

const getAuth0Config = (port) => {
  const isValid = validateAuth0Config();
  
  if (!isValid) {
    return null; // Return null when Auth0 is not configured
  }
  
  return {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.BASE_URL || `http://localhost:${port}`,
    clientID: process.env.AUTH0_CLIENT_ID,   
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
    routes: {
      login: '/login',
      logout: '/logout',
      callback: '/callback'
    }
  };
};

module.exports = {
  getAuth0Config,
  validateAuth0Config
};