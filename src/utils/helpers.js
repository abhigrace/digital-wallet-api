const prisma = require('../models/database');

const createTransaction = async (
  userId,
  type,
  amount,
  description,
  recipientId = null,
  productId = null
) => {
  // Get current balance
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error(`User with id ${userId} not found`);
  }

  const currentBalance = parseFloat(user.balance);
  const transactionAmount = parseFloat(amount);

  let newBalance;
  if (type === 'credit') {
    newBalance = currentBalance + transactionAmount;
  } else {
    newBalance = currentBalance - transactionAmount;
  }

  // Create transaction and update balance in a transaction
  const result = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId,
        type,
        amount: transactionAmount,
        description,
        recipientId,
        productId,
        balanceAfter: newBalance
      }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { balance: newBalance }
    })
  ]);

  return {
    transaction: result[0],
    newBalance: newBalance
  }; // ✅ Closing brace added here
};

const formatResponse = (success, data = null, message = null, error = null) => {
  const response = { success };

  if (data) response.data = data;
  if (message) response.message = message;
  if (error) response.error = error;

  return response;
};

module.exports = {
  createTransaction,
  formatResponse
};
