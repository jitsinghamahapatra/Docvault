const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['file', 'url'],
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileData: {
        type: Buffer
    },
    originalName: {
        type: String
    },
    mimeType: {
        type: String
    },
    size: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Document', DocumentSchema);
