const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const authMiddleware = require('../middleware/authMiddleware');
const Admin = require('../models/Admin');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get all documents — EXCLUDE fileData (binary) so the list loads fast
router.get('/', async (req, res) => {
    try {
        const docs = await Document.find()
            .select('-fileData')   // ← KEY FIX: never send binary blob in the list
            .sort({ createdAt: -1 })
            .lean();               // plain JS objects, faster than Mongoose docs
        
        // Mask URL type document fileUrls to go through our gate redirect
        const sanitizedDocs = docs.map(doc => {
            if (doc.type === 'url') {
                return {
                    ...doc,
                    fileUrl: `/api/documents/view-url/${doc._id}`
                };
            }
            return doc;
        });

        res.json(sanitizedDocs);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload File
router.post('/upload-file', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const newDoc = new Document({
            title: req.body.title || req.file.originalname,
            type: 'file',
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            fileData: req.file.buffer
        });
        
        newDoc.fileUrl = `/api/documents/file/${newDoc._id}`;

        await newDoc.save();
        res.json({ success: true, document: newDoc });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Serve File from DB — with browser caching headers
router.get('/file/:id', async (req, res) => {
    try {
        const { pin } = req.query;
        let isAdmin = false;
        const token = req.cookies.adminToken;
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
                isAdmin = true;
            } catch (err) {
                // ignore
            }
        }

        if (!isAdmin) {
            if (!pin) {
                return res.status(401).send('Unauthorized. PIN is required.');
            }
            const admin = await Admin.findOne({ username: 'admin' });
            if (!admin) {
                return res.status(500).send('Server configuration error.');
            }
            const isMatch = await bcrypt.compare(pin, admin.documentPin);
            if (!isMatch) {
                return res.status(401).send('Unauthorized. Incorrect PIN.');
            }
        }

        const doc = await Document.findById(req.params.id).select('fileData mimeType originalName type');
        if (!doc || doc.type !== 'file' || !doc.fileData) {
            return res.status(404).send('File not found');
        }
        // Tell the browser to cache the file for 7 days
        res.set('Cache-Control', 'public, max-age=604800, immutable');
        res.set('Content-Type', doc.mimeType);
        res.set('Content-Disposition', `inline; filename="${doc.originalName || 'file'}"`);
        res.set('Content-Length', doc.fileData.length);
        res.send(doc.fileData);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Serve/Redirect URL with PIN protection
router.get('/view-url/:id', async (req, res) => {
    try {
        const { pin } = req.query;
        let isAdmin = false;
        const token = req.cookies.adminToken;
        if (token) {
            try {
                jwt.verify(token, process.env.JWT_SECRET);
                isAdmin = true;
            } catch (err) {
                // ignore
            }
        }

        if (!isAdmin) {
            if (!pin) {
                return res.status(401).send('Unauthorized. PIN is required.');
            }
            const admin = await Admin.findOne({ username: 'admin' });
            if (!admin) {
                return res.status(500).send('Server configuration error.');
            }
            const isMatch = await bcrypt.compare(pin, admin.documentPin);
            if (!isMatch) {
                return res.status(401).send('Unauthorized. Incorrect PIN.');
            }
        }

        const doc = await Document.findById(req.params.id).select('fileUrl type');
        if (!doc || doc.type !== 'url' || !doc.fileUrl) {
            return res.status(404).send('URL not found');
        }
        
        res.redirect(doc.fileUrl);
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Upload URL
router.post('/upload-url', authMiddleware, async (req, res) => {
    try {
        const { title, url } = req.body;
        if (!url) return res.status(400).json({ error: 'No URL provided' });

        const newDoc = new Document({
            title: title || url,
            type: 'url',
            fileUrl: url
        });

        await newDoc.save();
        res.json({ success: true, document: newDoc });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete Document
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Not found' });

        if (doc.type === 'file' && doc.fileUrl && doc.fileUrl.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', doc.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await Document.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get Storage Status (Admin Only)
router.get('/storage', authMiddleware, async (req, res) => {
    try {
        const result = await Document.aggregate([
            { $match: { type: 'file' } },
            { $group: { _id: null, totalSize: { $sum: '$size' } } }
        ]);
        const usedBytes = result.length > 0 ? result[0].totalSize : 0;
        const totalBytes = 512 * 1024 * 1024; // 512 MB
        res.json({
            usedBytes,
            totalBytes,
            percentUsed: Number(((usedBytes / totalBytes) * 100).toFixed(2))
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
