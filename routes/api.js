'use strict';

const crypto = require('crypto');

// Store anonymized IPs for each stock
const likesDB = {};

function anonymizeIP(ip) {
  if (!ip) {
    return 'unknown';
  }

  return crypto
    .createHash('sha256')
    .update(ip)
    .digest('hex');
}

async function getStockPrice(stock) {
  const url =
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to fetch stock price');
  }

  const data = await response.json();

  return Number(data.latestPrice);
}

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res) {

      let stocks = req.query.stock;

      // No stock supplied
      if (!stocks) {
        return res.status(400).json({
          error: 'Missing stock parameter'
        });
      }

      // Make sure stock is always an array
      if (!Array.isArray(stocks)) {
        stocks = [stocks];
      }

      // Maximum two stocks for this challenge
      stocks = stocks
        .slice(0, 2)
        .map(stock => stock.toUpperCase());

      const like = req.query.like === 'true';

      // Anonymize IP before storing it
      const ip = req.ip || req.connection.remoteAddress;
      const anonymousIP = anonymizeIP(ip);

      try {

        const stockData = await Promise.all(
          stocks.map(async function (stock) {

            const price = await getStockPrice(stock);

            if (!likesDB[stock]) {
              likesDB[stock] = new Set();
            }

            // Only allow one like per IP per stock
            if (like && !likesDB[stock].has(anonymousIP)) {
              likesDB[stock].add(anonymousIP);
            }

            return {
              stock: stock,
              price: price,
              likes: likesDB[stock].size
            };
          })
        );

        // One stock
        if (stockData.length === 1) {
          return res.json({
            stockData: stockData[0]
          });
        }

        // Two stocks
        if (stockData.length === 2) {

          const first = stockData[0];
          const second = stockData[1];

          return res.json({
            stockData: [
              {
                stock: first.stock,
                price: first.price,
                rel_likes: first.likes - second.likes
              },
              {
                stock: second.stock,
                price: second.price,
                rel_likes: second.likes - first.likes
              }
            ]
          });
        }

      } catch (error) {

        console.error(error);

        return res.status(500).json({
          error: 'Failed to fetch stock price'
        });
      }

    });

};