const express = require('express');
const router = express.Router();

router.get('/user', (req, res) => {
  if (req.oidc.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        name: req.oidc.user.name,
        email: req.oidc.user.email,
        picture: req.oidc.user.picture
      }
    });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;