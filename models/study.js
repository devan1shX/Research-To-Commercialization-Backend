const mongoose = require('mongoose');

const questionAnswerSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        required: true,
        trim: true
    }
}, { _id: false });

const documentSchema = new mongoose.Schema({
    file_location: {
        type: String,
        required: true
    },
    display_name: {
        type: String,
        required: false
    },
    uploaded_at: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const studySchema = new mongoose.Schema({
    researcher_id: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    abstract: {
        type: String,
        required: true,
        trim: true
    },
    brief_description: {
        type: String,
        required: true,
        trim: true
    },
    genres: {
        type: [String],
        default: [],
        index: true
    },
    documents: {
        type: [documentSchema],
        validate: [val => val.length <= 5, 'Cannot exceed 5 documents.']
    },
    patent_status: {
        type: String,
        enum: ['Patented', 'Unpatented', 'Patent Pending', null],
        default: null
    },
    questions: {
        type: [questionAnswerSchema],
        default: []
    },
    additional_info: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    approved: { 
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

studySchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

studySchema.pre('findOneAndUpdate', function(next) {
    this.set({ updated_at: new Date() });
    next();
});

module.exports = mongoose.model('Study', studySchema);