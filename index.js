require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const authRoutes = require('./src/routes/auth');
const apiRoutes = require('./src/routes/api');
const pageRoutes = require('./src/routes/pages');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Railway deployment
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validate required environment variables
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD_HASH || !process.env.SESSION_SECRET) {
  console.error('❌ Missing authentication configuration. Please check your environment variables.');
  console.error('Required variables: ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SESSION_SECRET');
  process.exit(1);
}

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.static('public'));

app.use('/', pageRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});