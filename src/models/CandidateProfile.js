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
  }],
  // Premium subscription fields
  isPremium: {
    type: Boolean,
    default: false,
    index: true
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  // Job application tracking (for monthly limit)
  monthlyApplications: [{
    month: String, // Format: YYYY-MM
    count: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

// Method to check if candidate has active premium subscription
candidateProfileSchema.methods.hasActivePremium = function() {
  return this.isPremium && this.subscriptionExpiresAt && this.subscriptionExpiresAt > new Date();
};

// Method to get current month's application count
candidateProfileSchema.methods.getCurrentMonthApplicationCount = function() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthData = this.monthlyApplications.find(m => m.month === currentMonth);
  return monthData ? monthData.count : 0;
};

// Method to increment monthly application count
candidateProfileSchema.methods.incrementApplicationCount = async function() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthData = this.monthlyApplications.find(m => m.month === currentMonth);
  
  if (monthData) {
    monthData.count += 1;
  } else {
    this.monthlyApplications.push({ month: currentMonth, count: 1 });
  }
  
  // Keep only last 3 months of data
  if (this.monthlyApplications.length > 3) {
    this.monthlyApplications.sort((a, b) => b.month.localeCompare(a.month));
    this.monthlyApplications = this.monthlyApplications.slice(0, 3);
  }
  
  await this.save();
};

module.exports = mongoose.model('CandidateProfile', candidateProfileSchema);
