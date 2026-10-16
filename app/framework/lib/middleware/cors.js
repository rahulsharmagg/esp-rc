'use strict';

module.exports = function cors({
  origin = '*',
  methods = 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  headers = 'Content-Type,Authorization',
  credentials = false
} = {}) {
  return (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', headers);
    if (credentials) res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
};
