require('dotenv').config();

const validateAuth0Config = () => {
  const requiredVars = ['AUTH0_SECRET', 'AUTH0_CLIENT_ID', 'AUTH0_ISSUER_BASE_URL'];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(`Missing Auth0 configuration: ${missing.join(', ')}`);
  }
};

const getAuth0Config = (port) => {
  validateAuth0Config();
  
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