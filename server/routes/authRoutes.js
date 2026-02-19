const express = require('express');
const router = express.Router();

// Safe Route to prevent crashes
router.get('/status', (req, res) => {
    res.json({ message: "Auth routes are active." });
});

// NOTE: Add your actual auth controllers back here one by one
// Make sure the paths (like '../controllers/authController') are 100% correct!

module.exports = router;