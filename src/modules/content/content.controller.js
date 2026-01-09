const Content = require('../../models/Content');

// @desc    Get all content
// @route   GET /api/content
// @access  Public (or Admin only? Usually public to view, admin to edit. But this is for Admin Panel management)
// Let's make it Protected/Admin for this endpoint as it is for the editing page.
// Public fetching might be done via a public route if needed for the actual About page.
exports.getAllContent = async (req, res, next) => {
  try {
    const content = await Content.find();
    // Reduce to object { key: value } for easier frontend consumption
    const contentMap = content.reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
    }, {});
    
    // Ensure default keys exist if DB is empty
    const defaults = {
        about: '',
        terms: '',
        privacy: ''
    };

    res.status(200).json({
      success: true,
      data: { ...defaults, ...contentMap }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update content
// @route   PUT /api/content
// @access  Private (Admin)
exports.updateContent = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    
    if (!['about', 'terms', 'privacy'].includes(key)) {
        return res.status(400).json({ success: false, message: 'Invalid content key' });
    }

    const content = await Content.findOneAndUpdate(
        { key },
        { 
            value,
            lastUpdatedBy: req.user.id
        },
        { new: true, upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    next(error);
  }
};
