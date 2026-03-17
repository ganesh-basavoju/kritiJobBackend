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
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
