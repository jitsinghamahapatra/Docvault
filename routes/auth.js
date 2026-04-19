const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');

// Login
router.post('/login', async (req, res) => {
    try {
        const { password } = req.body;
        const admin = await Admin.findOne({ username: 'admin' });
        if (!admin) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        
        res.cookie('adminToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.json({ success: true, message: 'Logged in successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.clearCookie('adminToken');
    res.json({ success: true, message: 'Logged out successfully' });
});

// Reset Password (must be logged in)
router.post('/reset-password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const admin = await Admin.findById(req.admin.id);
        
        const isMatch = await bcrypt.compare(currentPassword, admin.password);
        if (!isMatch) return res.status(400).json({ error: 'Incorrect current password' });

        const salt = await bcrypt.genSalt(10);
        admin.password = await bcrypt.hash(newPassword, salt);
        await admin.save();

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Check Auth Status
router.get('/status', (req, res) => {
    const token = req.cookies.adminToken;
    if (!token) return res.status(401).json({ isAuthenticated: false });
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        res.json({ isAuthenticated: true });
    } catch (err) {
        res.status(401).json({ isAuthenticated: false });
    }
});

module.exports = router;
