require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const connectDB = require('./config/db');
const path = require('path');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const Admin = require('./models/Admin');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(compression());  // gzip compress all responses
app.use(helmet({ contentSecurityPolicy: false }));

// Rate Limiting — raised limit so normal browsing isn't throttled
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Static folders — no cache for JS/CSS so changes take effect immediately
app.use(express.static(path.join(__dirname, 'public'), {
    etag: true,
    setHeaders(res, filePath) {
        // Only cache images long-term; never cache JS/CSS
        if (/\.(png|jpg|jpeg|gif|webp|ico|svg)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day for images
        } else {
            res.setHeader('Cache-Control', 'no-cache'); // always fresh for JS/CSS/HTML
        }
    }
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
    maxAge: '7d',
    etag: true
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Fallback HTML routing
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Initialize Admin
const initAdmin = async () => {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('1234', salt);
            const newAdmin = new Admin({
                username: 'admin',
                password: hashedPassword
            });
            await newAdmin.save();
        }
    } catch (err) {
        console.error('Error initializing admin', err);
    }
};
initAdmin();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
