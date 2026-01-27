const Job = require('../../models/Job');
const Company = require('../../models/Company');
const Application = require('../../models/Application');
const APIFeatures = require('../../utils/apiFeatures');
const notificationService = require('../../services/notification.service');

// @desc    Get job feed (Open jobs, not applied by current user)
// @route   GET /api/jobs/feed
// @access  Private (Candidate)
exports.getJobFeed = async (req, res, next) => {
  try {
    // Get all job IDs user has applied to
    const appliedJobIds = await Application.find({ candidateId: req.user.id })
      .distinct('jobId');

    // Build base query for Open jobs that user hasn't applied to
    const baseFilter = {
      status: 'Open',
      _id: { $nin: appliedJobIds }
    };

    // Get total count for pagination
    const total = await Job.countDocuments(baseFilter);

    // Build query with features
    const baseQuery = Job.find(baseFilter)
      .populate('companyId', 'name logoUrl location')
      .populate('applicationsCount');

    const features = new APIFeatures(baseQuery, req.query)
      .search()
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const jobs = await features.query;

    // Calculate pagination
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
      page,
      totalPages,
      total
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all jobs (Public - for browsing without login)
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res, next) => {
  try {
    const features = new APIFeatures(Job.find().populate('companyId', 'name logoUrl location').populate('applicationsCount'), req.query)
      .search()
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const jobs = await features.query;

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single job
// @route   GET /api/jobs/:id
// @access  Public
exports.getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('companyId')
      .populate('applicationsCount');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new job
// @route   POST /api/jobs
// @access  Private (Employer)
exports.createJob = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.employerId = req.user.id;

    // Check for company (Employer must have a company profile to post a job)
    // Assuming 1 company per employer for simplicity as per RD inference or passing companyId
    // If Admin posts, they might select company.
    
    // For MVP/RD: Employer posts job. Needs companyId.
    // If not provided in body, find company owned by user.
    if (!req.body.companyId) {
        const company = await Company.findOne({ ownerId: req.user.id });
        if (!company) {
             return res.status(400).json({ success: false, message: 'Please create a company profile first' });
        }
        req.body.companyId = company._id;
    }

    const job = await Job.create(req.body);

    // Populate company data for notification
    await job.populate('companyId', 'name logoUrl location');

    // Send push notification to candidates (async, don't wait)
    if (job.status === 'Open') {
      notificationService.sendNewJobAlert(job).catch(err => {
        console.error('Failed to send job alert notification:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private (Employer/Admin)
exports.updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Make sure user is job owner OR admin
    if (job.employerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private (Employer/Admin)
exports.deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Make sure user is job owner or admin
    if (job.employerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this job' });
    }

    await job.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get jobs posted by current employer
// @route   GET /api/jobs/my-jobs
// @access  Private (Employer)
exports.getMyJobs = async (req, res, next) => {
    try {
        const jobs = await Job.find({ employerId: req.user.id });

        res.status(200).json({
            success: true,
            count: jobs.length,
            data: jobs
        });
    } catch (error) {
        next(error);
    }
};
