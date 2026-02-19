const express = require('express');
const router = express.Router();

// You can import other routes here later
// const authRoutes = require('./auth');
// router.use('/auth', authRoutes);

router.get('/', (req, res) => {
  res.send('API is working');
});

module.exports = router;