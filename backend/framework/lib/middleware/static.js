'use strict';
const fs = require('fs');
const path = require('path');
const mime = require('../utils/mime');

module.exports = function serveStatic(root, { index = 'index.html' } = {}) {
  root = path.resolve(root);

  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    let file;
    try {
      file = path.join(root, decodeURIComponent(req.path));
    } catch (e) {
      return next();
    }
    if (file !== root && !file.startsWith(root + path.sep)) return next(); // path traversal guard

    const send = (f, stat) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', mime[path.extname(f).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(f).on('error', next).pipe(res);
    };

    fs.stat(file, (err, stat) => {
      if (!err && stat.isDirectory()) {
        const idx = path.join(file, index);
        return fs.stat(idx, (e, s) => (e || !s.isFile() ? next() : send(idx, s)));
      }
      if (err || !stat.isFile()) return next();
      send(file, stat);
    });
  };
};
