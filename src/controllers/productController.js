const prisma = require('../models/database');
const { createTransaction, formatResponse } = require('../utils/helpers');

const addProduct = async (req, res) => {
  try {
    const { name, price, description } = req.body;
    
    if (!name || !price || price <= 0) {
      return res.status(400).json(
        formatResponse(false, null, null, 'Name and valid price are required')
      );
    }
    
    const product = await prisma.product.create({
      data: {
        name,
        price: parseFloat(price),
        description
      }
    });
    
    res.status(201).json(
      formatResponse(true, 
        { 
          id: product.id,
          message: 'Product added'
        },
        'Product created successfully'
      )
    );
    
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Failed to add product')
    );
  }
};

const listProducts = async (req, res) => {
  try {
    const { limit = 20, search } = req.query;
    
    const whereClause = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    } : {};
    
    const products = await prisma.product.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });
    
    const formattedProducts = products.map(product => ({
      id: product.id,
      name: product.name,
      price: parseFloat(product.price),
      description: product.description
    }));
    
    res.json(formattedProducts);
    
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Failed to fetch products')
    );
  }
};

const buyProduct = async (req, res) => {
  try {
    const { product_id } = req.body;
    const userId = req.user.id;
    
    // Get product
    const product = await prisma.product.findUnique({
      where: { id: parseInt(product_id) }
    });
    
    if (!product) {
      return res.status(400).json(
        formatResponse(false, null, null, 'Product not found')
      );
    }
    
    // Check user balance
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    const productPrice = parseFloat(product.price);
    if (parseFloat(user.balance) < productPrice) {
      return res.status(400).json(
        formatResponse(false, null, null, 
          `Insufficient balance. Required: ₹${productPrice}, Available: ₹${user.balance}`
        )
      );
    }
    
    // Create purchase transaction
    const result = await createTransaction(
      userId,
      'purchase',
      productPrice,
      `Purchased ${product.name}`,
      null,
      product.id
    );
    
    res.json(
      formatResponse(true, {
        message: 'Product purchased',
        product: {
          id: product.id,
          name: product.name,
          price: productPrice
        },
        balance: result.newBalance
      }, 'Purchase completed successfully')
    );
    
  } catch (error) {
    console.error('Buy product error:', error);
    res.status(500).json(
      formatResponse(false, null, null, 'Purchase failed')
    );
  }
};

module.exports = {
  addProduct,
  listProducts,
  buyProduct
};