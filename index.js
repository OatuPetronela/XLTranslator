const express = require('express');
const cors = require('cors');
const { auth } = require('express-openid-connect');
const { getAuth0Config } = require('./src/config/auth');

const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const pageRoutes = require('./src/routes/pages');

const app = express();
const PORT = process.env.PORT || 3000;

const auth0Config = getAuth0Config(PORT);

app.use(cors());
app.use(express.json());

// Only use Auth0 if configuration is available
if (auth0Config) {
  app.use(auth(auth0Config));
  console.log('✅ Auth0 authentication enabled');
} else {
  console.log('⚠️ Auth0 authentication disabled - missing configuration');
  // Add a mock req.oidc object for when Auth0 is disabled
  app.use((req, res, next) => {
    req.oidc = {
      isAuthenticated: () => true, // Always authenticated when Auth0 is disabled
      user: { email: 'demo@example.com', name: 'Demo User' }
    };
    next();
  });
}

app.use(express.static('public'));

app.use('/', pageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Excel AI Translator running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
});