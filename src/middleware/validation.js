const validateRegistration = (req, res, next) => {
  const { username, password } = req.body;
  
  const errors = [];
  
  if (!username || username.length < 3 || username.length > 20) {
    errors.push('Username must be 3-20 characters long');
  }
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors
    });
  }
  
  next();
};

const validateAmount = (req, res, next) => {
  const { amt } = req.body;
  
  if (!amt || amt <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount',
      message: 'Amount must be greater than 0'
    });
  }
  
  if (amt > 1000000) {
    return res.status(400).json({
      success: false,
      error: 'Amount too large',
      message: 'Maximum amount is ₹10,00,000'
    });
  }
  
  next();
};

module.exports = {
  validateRegistration,
  validateAmount
};