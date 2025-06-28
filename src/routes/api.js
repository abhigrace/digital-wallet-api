const express = require('express');
const router = express.Router();

// Controllers
const { register } = require('../controllers/authController');
const {
  fundAccount,
  payUser,
  getBalance,
  getStatement,
  bulkPay,
  getInsights
} = require('../controllers/walletController');
const {
  addProduct,
  listProducts,
  buyProduct
} = require('../controllers/productController');

// Middleware
const { basicAuth } = require('../middleware/auth');
const { validateRegistration, validateAmount } = require('../middleware/validation');

// ✅ API root documentation
router.get('/', (req, res) => {
  res.json({
    name: 'Digital Wallet API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /register': 'Register new user'
      },
      wallet: {
        'POST /fund': 'Fund account (requires auth)',
        'POST /pay': 'Pay another user (requires auth)',
        'GET /bal': 'Get balance (requires auth)',
        'GET /stmt': 'Get transaction history (requires auth)',
        'POST /bulk-pay': 'Pay multiple users (requires auth)',
        'GET /insights': 'Get spending insights (requires auth)'
      },
      products: {
        'POST /product': 'Add product (requires auth)',
        'GET /product': 'List all products',
        'POST /buy': 'Buy product (requires auth)'
      }
    }
  });
});

// ✅ Auth routes
router.post('/register', validateRegistration, register);

// ✅ Wallet routes (protected)
router.post('/fund', basicAuth, validateAmount, fundAccount);
router.post('/pay', basicAuth, payUser);
router.get('/bal', basicAuth, getBalance);
router.get('/stmt', basicAuth, getStatement);
router.post('/bulk-pay', basicAuth, bulkPay);
router.get('/insights', basicAuth, getInsights);

// ✅ Product routes
router.post('/product', basicAuth, addProduct);
router.get('/product', listProducts);
router.post('/buy', basicAuth, buyProduct);

// ✅ Export router
module.exports = router;
