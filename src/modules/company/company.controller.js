const Company = require('../../models/Company');
const { uploadToCloudinary } = require('../../services/upload.service');
const APIFeatures = require('../../utils/apiFeatures');

// Helper to sanitize fields
const sanitizeCompanyData = (data) => {
    if (data.website === '') delete data.website;
    // Add other fields if necessary
    return data;
};

// @desc    Create company profile
// @route   POST /api/company
// @access  Private (Employer)
exports.createCompany = async (req, res, next) => {
  try {
    req.body.ownerId = req.user.id;
    console.log(req.body,"createCompany");
    req.body = sanitizeCompanyData(req.body);

    // Check if company already exists for user (Limit 1 per employer for now)
    const existingCompany = await Company.findOne({ ownerId: req.user.id });
    if (existingCompany) {
        return res.status(400).json({ success: false, message: 'You already have a company profile' });
    }

    // Handle Logo Upload
    if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, 'company-logos');
        req.body.logoUrl = result.secure_url;
    }

    const company = await Company.create(req.body);

    res.status(201).json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all companies
// @route   GET /api/companies
// @access  Public
exports.getCompanies = async (req, res, next) => {
  try {
    const features = new APIFeatures(Company.find(), req.query)
      .search() // Search by name? Need to check if Company model has text index.
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const companies = await features.query;

    res.status(200).json({
      success: true,
      count: companies.length,
      data: companies
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get company by ID
// @route   GET /api/company/:id
// @access  Public
exports.getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update company
// @route   PUT /api/company/:id
// @access  Private (Owner)
exports.updateCompany = async (req, res, next) => {
  try {
    let company = await Company.findById(req.params.id);

    if (!company) {
      return res.status(404).json({ success: false, message: 'Company not found' });
    }

    // Check ownership
    if (company.ownerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to update this company' });
    }
    console.log(req.body,"updateCo");
    req.body = sanitizeCompanyData(req.body);

    // Handle Logo Upload
    if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, 'company-logos');
        req.body.logoUrl = result.secure_url;
    }

    company = await Company.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: company
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current employer's company
// @route   GET /api/company/me
// @access  Private
exports.getMyCompany = async (req, res, next) => {
    try {
        const company = await Company.findOne({ ownerId: req.user.id });
        
        // Return null data if not found, don't 404, let frontend handle "Create Company" UI
        if (!company) {
            return res.status(200).json({ success: true, data: null });
        }

        res.status(200).json({
            success: true,
            data: company
        });
    } catch (error) {
        next(error);
    }
};
