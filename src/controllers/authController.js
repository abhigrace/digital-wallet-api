const bcrypt = require('bcryptjs');
const prisma = require('../models/database');
const { formatResponse } = require('../utils/helpers');

const register = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username }
    });
    
    if (existingUser) {
      return res.status(400).json(
        formatResponse(false, null, null, 'Username already exists')
      );
    }
    
    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash
      }
    });
    
    res.status(201).json(
      formatResponse(true, 
        { 
          id: user.id, 
          username: user.username,
          balance: parseFloat(user.balance),
          createdAt: user.createdAt
        }, 
        'User registered successfully'
      )
    );
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Registration failed')
    );
  }
};

module.exports = { register };