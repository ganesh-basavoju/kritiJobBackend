const User = require('../../models/User');
const CandidateProfile = require('../../models/CandidateProfile');

// @desc    Search Candidates
// @route   GET /api/employer/candidates
// @access  Private (Employer)
exports.searchCandidates = async (req, res, next) => {
  try {
    const { keyword, location, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const pipeline = [
      // 1. Join with User to get name and email
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      // 2. Unwind user array
      { $unwind: '$user' },
      // 3. Filter for active candidates only
      {
        $match: {
          'user.role': 'candidate',
          'user.status': 'active'
        }
      }
    ];

    // 4. Apply Dynamic filters
    if (keyword) {
      const regex = new RegExp(keyword, 'i');
      pipeline.push({
        $match: {
          $or: [
            { 'user.name': regex },
            { title: regex },
            { skills: regex },
            { about: regex }
          ]
        }
      });
    }

    if (location) {
      pipeline.push({
        $match: {
          location: { $regex: location, $options: 'i' }
        }
      });
    }

    // 5. Projection (only public info)
    pipeline.push({
      $project: {
        _id: 1,
        userId: '$user._id',
        name: '$user.name',
        avatarUrl: '$user.avatarUrl', // Assuming avatar is on User based on recent changes
        title: 1,
        location: 1,
        skills: 1,
        about: 1,
        createdAt: 1
      }
    });

    // 6. Pagination & Count
    // We need two facets: one for data, one for count
    const facetPipeline = [
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }]
        }
      }
    ];
    
    // Combine pipelines
    const finalPipeline = [...pipeline, ...facetPipeline];

    const result = await CandidateProfile.aggregate(finalPipeline);
    
    const data = result[0].data;
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

    res.status(200).json({
      success: true,
      count: data.length,
      total,
      hasMore: (parseInt(page) * parseInt(limit)) < total,
      data
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get Candidate Public Profile
// @route   GET /api/employer/candidates/:id
// @access  Private (Employer)
exports.getCandidateById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // We search by Profile ID or User ID? 
    // Usually frontend will pass Profile ID from the list.
    // Let's support Profile ID lookup.
    
    let profile;
    
    // 1. Try finding by Profile ID
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
        profile = await CandidateProfile.findById(id)
            .populate('userId', 'name role email avatarUrl createdAt status');
    }

    // 2. If not found, try finding by User ID
    if (!profile && id.match(/^[0-9a-fA-F]{24}$/)) {
        profile = await CandidateProfile.findOne({ userId: id })
             .populate('userId', 'name role email avatarUrl createdAt status');
    }

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (profile.userId.role !== 'candidate' || profile.userId.status !== 'active') {
        return res.status(404).json({ success: false, message: 'Candidate not available' });
    }

    // Return public data including resume
    res.status(200).json({
      success: true,
      data: {
        _id: profile._id,
        user: {
            _id: profile.userId._id,
            name: profile.userId.name,
            avatarUrl: profile.userId.avatarUrl,
            email: profile.userId.email // Maybe expose email for direct contact? Or keep it private? Spec says "Message" action. Let's keep email if needed or just use ID for chat.
        },
        title: profile.title,
        location: profile.location,
        about: profile.about,
        skills: profile.skills,
        experience: profile.experience, // If exists in schema
        education: profile.education, // If exists
        resumes: profile.resumes, // Allow viewing resume
        defaultResumeUrl: profile.defaultResumeUrl,
        socialLinks: profile.socialLinks // If exists
      }
    });

  } catch (error) {
    next(error);
  }
};
