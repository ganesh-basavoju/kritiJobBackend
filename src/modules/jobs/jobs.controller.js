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

    // Build base query for Open jobs that user hasn't applied to AND are not expired
    const baseFilter = {
      status: 'Open',
      _id: { $nin: appliedJobIds },
      applicationDeadline: { $gte: new Date() } // Filter expired jobs
    };

    // Build query with features
    const baseQuery = Job.find(baseFilter)
      .populate('companyId', 'name logoUrl location')
      .populate('applicationsCount');

    const features = new APIFeatures(baseQuery, req.query)
      .search()
      .filter();
      
    // Get total count of matched docs before pagination
    const total = await features.query.clone().countDocuments();

    // Apply pagination and sort
    features.sort()
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
    // Filter out expired jobs for public browsing
    const initialQuery = Job.find({ 
        status: 'Open',
        applicationDeadline: { $gte: new Date() } 
    }).populate('companyId', 'name logoUrl location').populate('applicationsCount');

    const features = new APIFeatures(initialQuery, req.query)
      .search()
      .filter();

    // Get total count of matched docs before pagination
    const total = await features.query.clone().countDocuments();

    // Apply pagination and sort
    features.sort()
      .limitFields()
      .paginate();

    const jobs = await features.query;

    // Calculate pagination
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10; // Default limit 10 if not specified
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

    const isExpired = new Date(job.applicationDeadline) < new Date();
    const canApply = job.status === 'Open' && !isExpired;

    res.status(200).json({
      success: true,
      data: {
          ...job.toObject(),
          isExpired,
          canApply
      }
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

    // Validate Status Logic
    // Automatically set status = Open on creation
    req.body.status = 'Open';

    // Validate Deadline
    if (!req.body.applicationDeadline) {
         return res.status(400).json({ success: false, message: 'Application deadline is required' });
    }
    const deadline = new Date(req.body.applicationDeadline);
    const now = new Date();
    if (deadline <= now) {
         return res.status(400).json({ success: false, message: 'Application deadline must be a future date' });
    }

    // Check for company (Employer must have a company profile to post a job)
    if (!req.body.companyId) {
        const company = await Company.findOne({ ownerId: req.user.id });
        if (!company) {
             return res.status(400).json({ success: false, message: 'Please create a company profile first' });
        }
        req.body.companyId = company._id;
    }

    // Parse salaryRange if provided but min/max are missing
    if (req.body.salaryRange && (!req.body.minSalary || !req.body.maxSalary)) {
      const parts = req.body.salaryRange.match(/(\d+)/g);
      if (parts && parts.length >= 2) {
        req.body.minSalary = Number(parts[0]);
        req.body.maxSalary = Number(parts[1]);
      } else if (parts && parts.length === 1) {
         req.body.minSalary = Number(parts[0]);
      }
    }

    const job = await Job.create(req.body);

    // Populate company data for notification
    await job.populate('companyId', 'name logoUrl location');

    // Notify Admin of new job
    await notificationService.sendToAdmin({
        type: 'JOB_POSTED',
        title: 'New Job Posted',
        message: `${req.user.name} posted a new job: ${job.title}`,
        entityType: 'job',
        entityId: job._id
    });

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
    let job = await Job.findById(req.params.id).populate('applicationsCount');

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.employerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this job' });
    }

    // DEADLINE UPDATE VALIDATION
    if (req.body.applicationDeadline) {
        const newDeadline = new Date(req.body.applicationDeadline);
        const now = new Date();

         // Check 1: Must be future date
         if (newDeadline <= now) {
             return res.status(400).json({ success: false, message: 'Application deadline must be a future date' });
         }

         // Check 2: Allow deadline edit ONLY if No applications exist (SKIP for Admin)
         if (req.user.role !== 'admin' && job.applicationsCount > 0) {
              // Ensure deadline is not changing (compare dates or strings)
              const currentDeadline = new Date(job.applicationDeadline).toISOString();
              const proposedDeadline = newDeadline.toISOString();
              
               if (currentDeadline.split('T')[0] !== proposedDeadline.split('T')[0]) { // Check date part mostly or exact
                   // Or simplified: if they try to touch deadline field at all
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Cannot edit deadline because applications have already been received.' 
                    });
               }
         }
    }

    // Parse salaryRange on update if provided
    if (req.body.salaryRange && (!req.body.minSalary || !req.body.maxSalary)) {
      const parts = req.body.salaryRange.match(/(\d+)/g);
      if (parts && parts.length >= 2) {
        req.body.minSalary = Number(parts[0]);
        req.body.maxSalary = Number(parts[1]);
      } else if (parts && parts.length === 1) {
         req.body.minSalary = Number(parts[0]);
      }
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
