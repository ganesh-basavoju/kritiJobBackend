const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  employerId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Please add a job title'],
    trim: true,
    maxlength: [100, 'Title can not be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: 5000
  },
  location: {
    type: String,
    required: [true, 'Please add a location'],
    index: true
  },
  type: {
    type: String,
    enum: ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Freelance'],
    required: true,
    index: true
  },
  experienceLevel: {
    type: String,
    enum: ['Entry Level', 'Intermediate', 'Expert'],
    required: true,
    index: true
  },
  salaryRange: {
    type: String,
    required: [true, 'Please add a salary range']
  },
  skillsRequired: {
    type: [String],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'Draft', 'Archived'],
    default: 'Open',
    index: true
  },
  postedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
jobSchema.index({ title: 'text', description: 'text', skillsRequired: 'text' });
jobSchema.index({ status: 1, type: 1, location: 1 });

module.exports = mongoose.model('Job', jobSchema);
