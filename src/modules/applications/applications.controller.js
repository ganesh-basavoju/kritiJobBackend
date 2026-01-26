const Application = require('../../models/Application');
const Job = require('../../models/Job');
const User = require('../../models/User');

// @desc    Apply for a job
// @route   POST /api/applications
// @access  Private (Candidate)
exports.applyForJob = async (req, res, next) => {
  try {
    const { jobId, resumeUrl } = req.body;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    if (job.status !== 'Open') {
      return res.status(400).json({ success: false, message: 'Job is not open for applications' });
    }

    // Check if already applied
    const alreadyApplied = await Application.findOne({
      jobId,
      candidateId: req.user.id
    });

    if (alreadyApplied) {
      return res.status(400).json({ success: false, message: 'You have already applied to this job' });
    }

    const application = await Application.create({
      jobId,
      candidateId: req.user.id,
      employerId: job.employerId,
      resumeUrl
    });

    // Remove job from savedJobs if it was saved
    const CandidateProfile = require('../../models/CandidateProfile');
    await CandidateProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $pull: { savedJobs: jobId } }
    );

    res.status(201).json({
      success: true,
      data: application
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if user has applied to a specific job
// @route   GET /api/applications/check/:jobId
// @access  Private (Candidate)
exports.checkApplicationStatus = async (req, res, next) => {
  try {
    const application = await Application.findOne({
      jobId: req.params.jobId,
      candidateId: req.user.id
    });

    res.status(200).json({
      success: true,
      applied: !!application,
      application: application || null
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current candidate's applications
// @route   GET /api/applications/my-applications
// @access  Private (Candidate)
exports.getMyApplications = async (req, res, next) => {
  try {
    // Get total count
    const total = await Application.countDocuments({ candidateId: req.user.id });

    // Pagination
    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 20;
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);

    const applications = await Application.find({ candidateId: req.user.id })
      .populate({
        path: 'jobId',
        select: 'title companyId location type salaryRange experienceLevel skillsRequired deadline status postedAt',
        populate: {
          path: 'companyId',
          select: 'name logoUrl location'
        }
      })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications,
      page,
      totalPages,
      total
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get applications for a job (Employer)
// @route   GET /api/jobs/:jobId/applications
// @access  Private (Employer)
// Note: Route defined in Jobs module or Applications module? RD puts it under Applications or Jobs.
// It's cleaner to handle here but route might be mounted differently.
// Let's assume standard REST: GET /api/applications?jobId=... or custom.
// The RD has: GET /api/jobs/:jobId/applications. I will implement logic here and export, usually mounted on job router or app router.
// For strict MVC, I will place this logic in Application controller and call it from Job Route or make Application route handle query.
// RD: GET /api/jobs/:jobId/applications. Since that's a sub-resource of jobs, I'll probably need to mount application router onto job router or just handle it here with query param if I used /api/applications.
// BUT RD specifies `/api/jobs/:jobId/applications`. I will implement `getJobApplications` here and add route in `applications.routes.js` as `/job/:jobId` OR add it to `jobs.routes.js`
exports.getJobApplications = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    // Check ownership
    if (job.employerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const applications = await Application.find({ jobId: req.params.jobId })
      .populate('candidateId', 'name email avatarUrl'); 
      // In real app, might want to populate CandidateProfile logic to get title/skills too.

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all applications for current employer (across all jobs)
// @route   GET /api/applications/employer/all
// @access  Private (Employer)
exports.getCompanyApplications = async (req, res, next) => {
  try {
    // 1. Find all jobs by this employer
    const jobs = await Job.find({ employerId: req.user.id }).select('_id');
    const jobIds = jobs.map(job => job._id);

    // 2. Find applications for these jobs
    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId', 'title') // Populate Job Title
      .populate('candidateId', 'name email avatarUrl') // Populate Candidate
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: applications.length,
      data: applications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update application status
// @route   PUT /api/applications/:id/status
// @access  Private (Employer)
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    let application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    // Check ownership (via EmployerId stored on Application or via Job)
    if (application.employerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    application.status = status;
    await application.save();

    res.status(200).json({
      success: true,
      data: application
    });
  } catch (error) {
    next(error);
  }
};
