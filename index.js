const express = require('express');
const cors = require('cors');
const { auth } = require('express-openid-connect');
const { getAuth0Config } = require('./src/config/auth');

const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const pageRoutes = require('./src/routes/pages');

const app = express();
const PORT = process.env.PORT || 3000;

try {
  const auth0Config = getAuth0Config(PORT);
  
  app.use(cors());
  app.use(express.json());
  app.use(auth(auth0Config));
  app.use(express.static('public'));

  app.use('/', pageRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);

  app.listen(PORT, () => {
    console.log(`Excel AI Translator running on port ${PORT}`);
    console.log(`Open: http://localhost:${PORT}`);
  });

} catch (error) {
  process.exit(1);
}