'use strict';
const fs = require('fs');
const path = require('path');
const mime = require('../utils/mime');

const matchesPrefix = (p, prefix) => p === prefix || p.startsWith(prefix + '/');

/**
 * Serve a built single-page app (SvelteKit / Vite / any bundler output).
 *
 *   app.use(mini.spa('web/build', { exclude: ['/api'] }));
 *
 * For a request it tries, in order:  the file  ->  dir/index.html  ->  path.html  ->  fallback page.
 * The fallback page (client-side routing) is only used for paths WITHOUT a file extension,
 * so a missing /app.js is a real 404, and `exclude` prefixes (your API) are never touched.
 * Mount it AFTER your API routes.
 *
 * @param {string} root
 * @param {object} [o]
 * @param {string|string[]|false} [o.fallback]  default ['200.html', 'index.html'] (first that exists); false = none
 * @param {string[]} [o.exclude]          path prefixes to skip (matched on the full URL path)
 * @param {string[]} [o.extensions]       default ['.html'] (so /admin finds admin.html)
 * @param {RegExp} [o.immutable]          files cached for a year (hashed bundles)
 * @param {RegExp} [o.noCache]            files that must always revalidate (html, service worker, manifest)
 */
module.exports = function spa(root, {
  fallback = ['200.html', 'index.html'],
  exclude = [],
  extensions = ['.html'],
  immutable = /^\/(?:_app\/immutable|assets)\//,
  noCache = /(?:\.html|\.webmanifest|(?:^|\/)(?:sw|service-worker|registerSW)\.js)$/
} = {}) {
  root = path.resolve(root);
  const fallbacks = [].concat(fallback).filter(Boolean);   // fallback: false -> unknown routes are 404
  let fallbackFound = null;

  const inside = (file) => file === root || file.startsWith(root + path.sep);
  const statFile = (file) =>
    fs.promises.stat(file).then((s) => (s.isFile() ? s : null), () => null);

  function send(req, res, file, stat) {
    const rel = '/' + path.relative(root, file).split(path.sep).join('/');
    const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

    res.setHeader('ETag', etag);
    res.setHeader(
      'Cache-Control',
      immutable.test(rel) ? 'public, max-age=31536000, immutable'
        : noCache.test(rel) ? 'no-cache'
        : 'public, max-age=3600'
    );
    if (req.headers['if-none-match'] === etag) {
      res.statusCode = 304;
      return res.end();
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  return async (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    let pathname;
    try { pathname = decodeURIComponent(req.path); } catch (e) { return next(); }

    const fullPath = (req.baseUrl || '') + pathname;
    if (exclude.some((p) => matchesPrefix(fullPath, p))) return next();

    // "/admin/" and "/admin" both find admin/index.html or admin.html
    const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const candidates = pathname.endsWith('/')
      ? [pathname + 'index.html', ...(bare !== pathname ? extensions.map((e) => bare + e) : [])]
      : [pathname, pathname + '/index.html', ...extensions.map((e) => pathname + e)];

    for (const c of candidates) {
      const file = path.join(root, c);
      if (!inside(file)) return next();                  // path traversal guard
      const stat = await statFile(file);
      if (stat) return send(req, res, file, stat);
    }

    if (path.extname(pathname)) return next();           // missing asset -> real 404

    for (const name of fallbackFound ? [fallbackFound] : fallbacks) {
      const file = path.join(root, name);
      const stat = await statFile(file);
      if (stat) {
        fallbackFound = name;
        return send(req, res, file, stat);
      }
    }
    next();
  };
};