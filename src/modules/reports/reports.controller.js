const User = require('../../models/User');
const Job = require('../../models/Job');
const Application = require('../../models/Application');

// @desc    Get system statistics
// @route   GET /api/reports/stats
// @access  Private (Admin)
exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const totalJobs = await Job.countDocuments();
    const activeJobs = await Job.countDocuments({ status: 'Open' });
    const totalApplications = await Application.countDocuments();

    // Group users by role
    const usersByRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // Group jobs by category/type
    const jobsByType = await Job.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
            total: totalUsers,
            active: activeUsers,
            byRole: usersByRole
        },
        jobs: {
            total: totalJobs,
            active: activeJobs,
            byType: jobsByType
        },
        applications: {
            total: totalApplications
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recent activity
// @route   GET /api/reports/activity
// @access  Private (Admin)
exports.getRecentActivity = async (req, res, next) => {
    try {
        // Fetch recent 5 items from each collection
        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name role createdAt');
        const recentJobs = await Job.find().sort({ createdAt: -1 }).limit(5).select('title companyId createdAt').populate('companyId', 'name');
        const recentApps = await Application.find().sort({ createdAt: -1 }).limit(5).select('jobId createdAt').populate('jobId', 'title');

        // Normalize and merge
        const activities = [
            ...recentUsers.map(u => ({
                id: u._id,
                type: 'user',
                message: `New ${u.role} joined: ${u.name}`,
                time: u.createdAt
            })),
            ...recentJobs.map(j => ({
                id: j._id,
                type: 'job',
                message: `New job posted: ${j.title} at ${j.companyId?.name || 'Unknown'}`,
                time: j.createdAt
            })),
            ...recentApps.map(a => ({
                id: a._id,
                type: 'application',
                message: `New application for: ${a.jobId?.title || 'Job'}`,
                time: a.createdAt
            }))
        ];

        // Sort by time desc and take top 10
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        const finalActivity = activities.slice(0, 10);

        res.status(200).json({
            success: true,
            data: finalActivity
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get user growth stats
// @route   GET /api/reports/growth
// @access  Private (Admin)
exports.getUserGrowth = async (req, res, next) => {
    try {
        // Aggregation for last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const growth = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]);
        
        // Map month numbers to names (Simplified)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const formattedGrowth = growth.map(item => ({
            name: monthNames[item._id - 1],
            users: item.count
        }));

        res.status(200).json({
            success: true,
            data: formattedGrowth
        });
    } catch (error) {
        next(error);
    }
};
