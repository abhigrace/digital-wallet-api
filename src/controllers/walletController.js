const prisma = require('../models/database');
const { createTransaction, formatResponse } = require('../utils/helpers');
const { convertCurrency } = require('../utils/currency');

const fundAccount = async (req, res) => {
  try {
    const { amt } = req.body;
    const userId = req.user.id;
    
    const result = await createTransaction(
      userId,
      'credit',
      amt,
      'Account funding'
    );
    
    res.json(
      formatResponse(true, 
        { balance: result.newBalance },
        'Account funded successfully'
      )
    );
    
  } catch (error) {
    console.error('Fund account error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Failed to fund account')
    );
  }
};

const payUser = async (req, res) => {
  try {
    const { to, amt } = req.body;
    const userId = req.user.id;

    console.log('→ payUser:', { to, amt, userId });

    if (amt <= 0) {
      return res.status(400).json(formatResponse(false, null, null, 'Amount must be greater than 0'));
    }

    const recipient = await prisma.user.findUnique({
      where: { username: to }
    });
    console.log('✅ Recipient:', recipient);

    if (!recipient) {
      return res.status(400).json(formatResponse(false, null, null, 'Recipient not found'));
    }

    const sender = await prisma.user.findUnique({
      where: { id: userId }
    });
    console.log('✅ Sender:', sender);

    if (parseFloat(sender.balance) < amt) {
      return res.status(400).json(formatResponse(false, null, null,
        `Insufficient funds. Available: ₹${sender.balance}, Required: ₹${amt}`
      ));
    }

    console.log('💸 Initiating transaction...');

    const [senderResult] = await Promise.all([
      createTransaction(userId, 'debit', amt, `Payment to ${to}`, recipient.id),
      createTransaction(recipient.id, 'credit', amt, `Payment from ${sender.username}`, userId)
    ]);

    console.log('✅ Payment done');

    return res.json(formatResponse(true, { balance: senderResult.newBalance }, `Payment sent to ${to} successfully`));
  } catch (error) {
    console.error('❌ Pay user error:', error); // <-- LOG THE ERROR
    return res.status(500).json(formatResponse(false, null, null, 'Payment failed'));
  }
};

const getBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currency } = req.query;
    
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    let balance = parseFloat(user.balance);
    let responseCurrency = 'INR';
    
    // Convert currency if requested
    if (currency && currency.toUpperCase() !== 'INR') {
      const targetCurrency = currency.toUpperCase();
      balance = await convertCurrency(balance, 'INR', targetCurrency);
      responseCurrency = targetCurrency;
    }
    
    res.json(
      formatResponse(true, {
        balance: balance,
        currency: responseCurrency
      })
    );
    
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Failed to fetch balance')
    );
  }
};

const getStatement = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, type, search } = req.query;
    
    const whereClause = {
      userId: userId
    };
    
    if (type) {
      whereClause.type = type;
    }
    
    if (search) {
      whereClause.description = {
        contains: search,
        mode: 'insensitive'
      };
    }
    
    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        recipient: {
          select: { username: true }
        },
        product: {
          select: { name: true }
        }
      }
    });
    
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      kind: tx.type,
      amt: parseFloat(tx.amount),
      updated_bal: parseFloat(tx.balanceAfter),
      timestamp: tx.createdAt.toISOString(),
      description: tx.description,
      recipient: tx.recipient?.username,
      product: tx.product?.name
    }));
    
    res.json(formattedTransactions);
    
  } catch (error) {
    console.error('Get statement error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Failed to fetch statement')
    );
  }
};

// Bonus: Bulk payments
const bulkPay = async (req, res) => {
  try {
    const { payments } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json(
        formatResponse(false, null, null, 'Payments array is required')
      );
    }
    
    // Calculate total amount
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amt, 0);
    
    // Check balance
    const sender = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (parseFloat(sender.balance) < totalAmount) {
      return res.status(400).json(
        formatResponse(false, null, null, 
          `Insufficient funds. Available: ₹${sender.balance}, Required: ₹${totalAmount}`
        )
      );
    }
    
    // Process all payments
    const results = [];
    for (const payment of payments) {
      const recipient = await prisma.user.findUnique({
        where: { username: payment.to }
      });
      
      if (recipient) {
        await Promise.all([
          createTransaction(userId, 'debit', payment.amt, `Bulk payment to ${payment.to}`, recipient.id),
          createTransaction(recipient.id, 'credit', payment.amt, `Bulk payment from ${sender.username}`, userId)
        ]);
        results.push({ to: payment.to, amt: payment.amt, status: 'success' });
      } else {
        results.push({ to: payment.to, amt: payment.amt, status: 'failed', reason: 'User not found' });
      }
    }
    
    // Get updated balance
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    res.json(
      formatResponse(true, {
        results,
        balance: parseFloat(updatedUser.balance)
      }, 'Bulk payments processed')
    );
    
  } catch (error) {
    console.error('Bulk pay error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Bulk payment failed')
    );
  }
};

// Bonus: Insights
const getInsights = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [totalSpent, avgTransaction, transactionCount, recentTransactions] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, type: 'debit' },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: { userId },
        _avg: { amount: true }
      }),
      prisma.transaction.count({
        where: { userId }
      }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 7,
        select: { createdAt: true, amount: true }
      })
    ]);
    
    const insights = {
      totalSpent: parseFloat(totalSpent._sum.amount || 0),
      avgTransactionSize: parseFloat(avgTransaction._avg.amount || 0),
      totalTransactions: transactionCount,
      weeklyTrend: recentTransactions.length > 5 ? 'active' : 'low'
    };
    
    res.json(
      formatResponse(true, insights)
    );
    
  } catch (error) {
    console.error('Get insights error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Failed to fetch insights')
    );
  }
};

module.exports = {
  fundAccount,
  payUser,
  getBalance,
  getStatement,
  bulkPay,
  getInsights
};