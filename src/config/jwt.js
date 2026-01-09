module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'secret_key_change_me',
  JWT_EXPIRE: process.env.JWT_EXPIRE || '1d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_change_me',
  JWT_REFRESH_EXPIRE: process.env.JWT_REFRESH_EXPIRE || '7d',
};
