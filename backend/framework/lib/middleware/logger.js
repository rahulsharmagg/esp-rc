'use strict';

/** logger({ log: console.log }) -> "GET /path 200 3ms" */
module.exports = function logger({ log = console.log } = {}) {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => log(`${req.method} ${req.originalUrl || req.url} ${res.statusCode} ${Date.now() - start}ms`));
    req.originalUrl = req.url;
    next();
  };
};
