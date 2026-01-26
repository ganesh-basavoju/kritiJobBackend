const CandidateProfile = require('../../models/CandidateProfile');
const Job = require('../../models/Job');
const User = require('../../models/User');

// @desc    Get current candidate profile
// @route   GET /api/candidate/profile
// @access  Private (Candidate)
exports.getProfile = async (req, res, next) => {
  try {
    let profile = await CandidateProfile.findOne({ userId: req.user.id })
      .populate('userId', 'name email avatarUrl phone')
      .populate('savedJobs', 'title companyId location type salaryRange postedAt')
      .populate({
        path: 'savedJobs',
        populate: {
            path: 'companyId',
            select: 'name logoUrl'
        }
      });

    if (!profile) {
      return res.status(200).json({ success: true, data: null });
    }

    // Merge user data into profile response for convenience
    const profileData = profile.toObject();
    if (profile.userId) {
      profileData.avatarUrl = profile.userId.avatarUrl || profile.avatarUrl;
      profileData.name = profile.userId.name;
      profileData.email = profile.userId.email;
      profileData.phone = profile.phone || profile.userId.phone;
    }

    res.status(200).json({
      success: true,
      data: profileData
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create or Update profile
// @route   PUT /api/candidate/profile
// @access  Private (Candidate)
exports.updateProfile = async (req, res, next) => {
  try {
    const fields = { ...req.body, userId: req.user.id };
    
    // Upsert
    const profile = await CandidateProfile.findOneAndUpdate(
      { userId: req.user.id },
      { $set: fields },
      { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload Resume
// @route   POST /api/candidate/resume
// @access  Private (Candidate)
exports.uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    // Pass buffer to Upload Service (Cloudinary)
    const { uploadToCloudinary } = require('../../services/upload.service');
    const result = await uploadToCloudinary(req.file.buffer, 'resumes');

    const profile = await CandidateProfile.findOne({ userId: req.user.id });
    
    if (!profile) {
         await CandidateProfile.create({
             userId: req.user.id,
             resumes: [{ name: req.file.originalname, url: result.secure_url }],
             defaultResumeUrl: result.secure_url
         });
    } else {
        profile.resumes.push({ name: req.file.originalname, url: result.secure_url });
        if (!profile.defaultResumeUrl) profile.defaultResumeUrl = result.secure_url;
        await profile.save();
    }

    res.status(200).json({
      success: true,
      data: result.secure_url
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete Resume
// @route   DELETE /api/candidate/resume/:resumeId
// @access  Private (Candidate)
exports.deleteResume = async (req, res, next) => {
    try {
        const profile = await CandidateProfile.findOne({ userId: req.user.id });
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        // Filter out resume
        profile.resumes = profile.resumes.filter(r => r._id.toString() !== req.params.resumeId);
        
        // If default deleted, set new default if exists
        if (profile.resumes.length > 0 && !profile.resumes.find(r => r.url === profile.defaultResumeUrl)) {
             profile.defaultResumeUrl = profile.resumes[0].url;
        } else if (profile.resumes.length === 0) {
             profile.defaultResumeUrl = undefined;
        }

        await profile.save();

        res.status(200).json({ success: true, data: profile.resumes });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload Avatar
// @route   POST /api/candidate/avatar
// @access  Private (Candidate)
exports.uploadAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        const { uploadToCloudinary } = require('../../services/upload.service');
        const result = await uploadToCloudinary(req.file.buffer, 'avatars');

        // Update both User and CandidateProfile with the new avatar URL
        await User.findByIdAndUpdate(req.user.id, { avatarUrl: result.secure_url });
        
        // Update or create CandidateProfile with avatar
        await CandidateProfile.findOneAndUpdate(
            { userId: req.user.id },
            { avatarUrl: result.secure_url },
            { upsert: true }
        );
        
        res.status(200).json({
            success: true,
            data: result.secure_url
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get Saved Jobs (Only Open jobs, not applied by user)
// @route   GET /api/candidate/saved-jobs
// @access  Private (Candidate)
exports.getSavedJobs = async (req, res, next) => {
    try {
        const Application = require('../../models/Application');
        
        // Get all job IDs user has applied to
        const appliedJobIds = await Application.find({ candidateId: req.user.id })
            .distinct('jobId');

        const profile = await CandidateProfile.findOne({ userId: req.user.id })
            .populate({
                path: 'savedJobs',
                match: { 
                    status: 'Open',
                    _id: { $nin: appliedJobIds }
                },
                populate: { path: 'companyId', select: 'name logoUrl location' }
            });

        if (!profile) {
             return res.status(200).json({ success: true, data: [] });
        }

        // Filter out null entries (jobs that didn't match the criteria)
        const filteredJobs = profile.savedJobs.filter(job => job !== null);

        res.status(200).json({
            success: true,
            count: filteredJobs.length,
            data: filteredJobs
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Save a Job
// @route   POST /api/candidate/saved-jobs
// @access  Private (Candidate)
exports.saveJob = async (req, res, next) => {
    try {
        const { jobId } = req.body;
        
        let profile = await CandidateProfile.findOne({ userId: req.user.id });
        
        if (!profile) {
             profile = await CandidateProfile.create({ userId: req.user.id, savedJobs: [] });
        }

        // Check availability
        if (profile.savedJobs.includes(jobId)) {
            return res.status(400).json({ success: false, message: 'Job already saved' });
        }

        profile.savedJobs.push(jobId);
        await profile.save();

        res.status(200).json({ success: true, data: profile.savedJobs });
    } catch (error) {
        next(error);
    }
};

// @desc    Remove Saved Job
// @route   DELETE /api/candidate/saved-jobs/:jobId
// @access  Private (Candidate)
exports.removeSavedJob = async (req, res, next) => {
    try {
        const profile = await CandidateProfile.findOne({ userId: req.user.id });
        
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        profile.savedJobs = profile.savedJobs.filter(id => id.toString() !== req.params.jobId);
        await profile.save();

        res.status(200).json({ success: true, data: profile.savedJobs });
    } catch (error) {
        next(error);
    }
};
