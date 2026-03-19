const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please add a company name'],
    trim: true,
    unique: true,
    maxlength: [100, 'Name limited to 100 chars']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [10000, 'Description limited to 10000 chars']
  },
  logoUrl: {
    type: String,
    default: 'no-photo.jpg'
  },
  website: {
    type: String,
    match: [
      /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/,
      'Please use a valid URL with HTTP or HTTPS'
    ]
  },
  location: {
    type: String,
    required: [true, 'Please add a location'],
    index: true
  },
  employeesCount: {
    type: String,
    enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
    default: '1-10'
  },
  // Employer subscription fields
  isPremiumEmployer: {
    type: Boolean,
    default: false,
    index: true
  },
  subscriptionExpiresAt: {
    type: Date,
    default: null
  },
  // Monthly job posting tracking for free tier
  monthlyJobPosts: [{
    month: String, // Format: YYYY-MM
    count: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});
companySchema.methods.hasActivePremiumEmployer = function() {
  return this.isPremiumEmployer && this.subscriptionExpiresAt && this.subscriptionExpiresAt > new Date();
};

companySchema.methods.getCurrentMonthJobPostCount = function() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthData = this.monthlyJobPosts.find(m => m.month === currentMonth);
  return monthData ? monthData.count : 0;
};

companySchema.methods.incrementMonthlyJobPostCount = async function() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthData = this.monthlyJobPosts.find(m => m.month === currentMonth);

  if (monthData) {
    monthData.count += 1;
  } else {
    this.monthlyJobPosts.push({ month: currentMonth, count: 1 });
  }

  // Keep only last 3 months of data
  if (this.monthlyJobPosts.length > 3) {
    this.monthlyJobPosts.sort((a, b) => b.month.localeCompare(a.month));
    this.monthlyJobPosts = this.monthlyJobPosts.slice(0, 3);
  }

  await this.save();
};

module.exports = mongoose.model('Company', companySchema);
