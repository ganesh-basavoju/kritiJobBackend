const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    index: true
  },
  targetEntity: {
    type: String,
    required: true,
    index: true
  },
  targetId: {
    type: mongoose.Schema.ObjectId
  },
  details: {
    type: Object
  },
  ipAddress: String
}, {
  timestamps: true
});

// Auto-delete after 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
