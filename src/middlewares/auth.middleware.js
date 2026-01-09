const jwt = require('jsonwebtoken');
const config = require('../config/jwt');
const User = require('../models/User');
const logger = require('../config/logger');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, config.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      if (req.user.status === 'blocked') {
        return res.status(403).json({ success: false, message: 'Your account has been blocked' });
      }

      next();
    } catch (error) {
      logger.error(`Auth Error: ${error.message}`);
      res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};
