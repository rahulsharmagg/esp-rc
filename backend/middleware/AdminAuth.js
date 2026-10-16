'use strict';
const crypto = require('crypto');
const Middleware = require('../framework/lib/middleware/base');

/**
 * Bearer-token auth for admin routes, with a simple brute-force lock
 * (10 wrong tokens from one IP -> blocked for 10 minutes).
 *   app.use('/admin/api', AdminAuth.create(process.env.ADMIN_TOKEN));
 */
class AdminAuth extends Middleware {
  constructor(token, { maxFails = 10, lockMs = 10 * 60 * 1000 } = {}) {
    super();
    if (!token) throw new Error('AdminAuth needs a token');
    this.expected = Buffer.from(token);
    this.maxFails = maxFails;
    this.lockMs = lockMs;
    this.fails = new Map();   // ip -> { count, until }
  }

  handle(req, res, next) {
    const rec = this.fails.get(req.ip);
    if (rec && rec.until > Date.now()) return res.status(429).json({ error: 'Too many attempts, try later' });

    const header = req.get('authorization') || '';
    const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
    const ok = given.length === this.expected.length && crypto.timingSafeEqual(given, this.expected);

    if (ok) {
      this.fails.delete(req.ip);
      return next();
    }

    const lockEnded = rec && rec.until && rec.until <= Date.now();   // a lock existed and has run out
    const count = (rec && !lockEnded ? rec.count : 0) + 1;
    this.fails.set(req.ip, { count, until: count >= this.maxFails ? Date.now() + this.lockMs : 0 });
    res.set('WWW-Authenticate', 'Bearer').status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = AdminAuth;