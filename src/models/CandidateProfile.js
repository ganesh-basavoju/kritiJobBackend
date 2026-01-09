const mongoose = require('mongoose');

const candidateProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    trim: true,
    maxlength: 100
  },
  location: String,
  about: {
    type: String,
    maxlength: 1000
  },
  skills: {
    type: [String],
    index: true
  },
  phone: String,
  avatarUrl: String,
  resumes: [{
    name: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  defaultResumeUrl: String,
  savedJobs: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Job'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('CandidateProfile', candidateProfileSchema);
