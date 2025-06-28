const axios = require('axios');

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const getCurrencyRate = async (fromCurrency, toCurrency) => {
  const cacheKey = `${fromCurrency}_${toCurrency}`;
  
  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.rate;
  }
  
  try {
    const response = await axios.get(`https://api.currencyapi.com/v3/latest`, {
      params: {
        apikey: process.env.CURRENCY_API_KEY,
        currencies: toCurrency,
        base_currency: fromCurrency
      }
    });
    
    const rate = response.data.data[toCurrency].value;
    
    // Cache the result
    cache.set(cacheKey, {
      rate,
      timestamp: Date.now()
    });
    
    return rate;
  } catch (error) {
    console.error('Currency API error:', error.message);
    
    // Fallback rates (for development)
    const fallbackRates = {
      'INR_USD': 0.012,
      'INR_EUR': 0.011,
      'INR_GBP': 0.0095
    };
    
    return fallbackRates[cacheKey] || 1;
  }
};

const convertCurrency = async (amount, fromCurrency, toCurrency) => {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  const rate = await getCurrencyRate(fromCurrency, toCurrency);
  return Number((amount * rate).toFixed(2));
};

module.exports = {
  getCurrencyRate,
  convertCurrency
};