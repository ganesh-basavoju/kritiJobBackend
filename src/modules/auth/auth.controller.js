const User = require('../../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/jwt');
const logger = require('../../config/logger');
const sendEmail = require('../../services/email.service');
const notificationService = require('../../services/notification.service');

// Generate Access Token
const generateAccessToken = (id, role) => {
  return jwt.sign({ id, role }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRE
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateAccessToken(user._id, user.role);
  const refreshToken = generateRefreshToken(user._id);

  // In production, send refresh token as HTTPOnly Cookie
  // For this MVP/Phase 1, sending in body as per common simple JWT flows, or cookie.
  // Requirement says "JWT access + refresh token flow".
  // Let's send both in body for simplicity unless cookie specified.
  
  res.status(statusCode).json({
    success: true,
    token,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role
    });

    // Notify Admin
    await notificationService.sendToAdmin({
        type: 'NEW_USER',
        title: 'New User Registered',
        message: `New ${role} registered: ${name} (${email})`,
        entityType: 'user',
        entityId: user._id
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status === 'blocked') {
        return res.status(403).json({ success: false, message: 'Your account has been blocked.' });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'No refresh token provided' });
        }

        const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET);

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid refresh token' });
        }

        const newAccessToken = generateAccessToken(user._id, user.role);

        res.status(200).json({
            success: true,
            token: newAccessToken
        });
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password (OTP)
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
    try {
        const user = await User.findOne({ email: req.body.email });

        if (!user) {
            return res.status(404).json({ success: false, message: 'There is no user with that email' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Set OTP and expiration (10 minutes)
        user.resetPasswordOTP = otp;
        user.resetPasswordOTPExpire = Date.now() + 10 * 60 * 1000;

        await user.save({ validateBeforeSave: false });

        const message = `Your password reset OTP is: ${otp}\n\nIt is valid for 10 minutes.`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset OTP',
                message
            });

            // For development/demo purposes (and if email fails), returning OTP in response can help
            // In strict production, do not return OTP.
            res.status(200).json({ 
                success: true, 
                data: 'Email sent', 
                otp: process.env.NODE_ENV === 'development' ? otp : undefined 
            });
        } catch (err) {
            console.error(err);
            user.resetPasswordOTP = undefined;
            user.resetPasswordOTPExpire = undefined;
            await user.save({ validateBeforeSave: false });
            return res.status(500).json({ success: false, message: 'Email could not be sent' });
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Reset Password (Verify OTP)
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, otp, password } = req.body;

        if (!email || !otp || !password) {
             return res.status(400).json({ success: false, message: 'Please provide email, otp and new password' });
        }

        const user = await User.findOne({
            email,
            resetPasswordOTP: otp,
            resetPasswordOTPExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid OTP or expired' });
        }

        // Set new password
        user.password = password;
        user.resetPasswordOTP = undefined;
        user.resetPasswordOTPExpire = undefined;
        await user.save();

        sendTokenResponse(user, 200, res);
    } catch (error) {
        next(error);
    }
};

// @desc    Log user out
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res, next) => {
  res.status(200).json({
    success: true,
    data: {}
  });
};
