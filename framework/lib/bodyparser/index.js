'use strict';
const querystring = require('querystring');
const readBody = require('./reader');
const bytes = require('../utils/bytes');

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Build a body-parsing middleware.
 * @param {string} type    substring to look for in Content-Type
 * @param {Function} parse (buffer) => value   (throw to reject with 400)
 * @param {*} empty        value of req.body when the body is empty
 */
function createParser(type, parse, empty) {
  return function (options = {}) {
    const limit = bytes(options.limit || '1mb');

    return async (req, res, next) => {
      if (req.body !== undefined || !BODY_METHODS.has(req.method) || !req.is(type)) return next();
      try {
        const buf = await readBody(req, limit);
        req.rawBody = buf;
        req.body = buf.length ? parse(buf) : empty;
        next();
      } catch (err) {
        if (!err.status) {
          err.status = 400;
          err.message = `Invalid ${type} body`;
        }
        next(err);
      }
    };
  };
}

module.exports = {
  json: createParser('json', (b) => JSON.parse(b.toString('utf8')), {}),
  urlencoded: createParser('application/x-www-form-urlencoded', (b) => querystring.parse(b.toString('utf8')), {}),
  text: createParser('text/', (b) => b.toString('utf8'), ''),
  raw: createParser('application/octet-stream', (b) => b, Buffer.alloc(0)),
  createParser // build your own parser (e.g. xml, msgpack)
};
