'use strict';
const http = require('http');

const TYPES = {
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  text: 'text/plain; charset=utf-8',
  bin: 'application/octet-stream'
};

/** Extends Node's ServerResponse. Add your own helpers here. */
class Response extends http.ServerResponse {
  status(code) {
    this.statusCode = code;
    return this;
  }

  set(name, value) {
    this.setHeader(name, value);
    return this;
  }

  get(name) {
    return this.getHeader(name);
  }

  type(t) {
    return this.set('Content-Type', TYPES[t] || t);
  }

  send(body = '') {
    if (typeof body === 'object' && !Buffer.isBuffer(body)) return this.json(body);
    if (!this.getHeader('Content-Type')) this.type(Buffer.isBuffer(body) ? 'bin' : 'html');
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
    this.setHeader('Content-Length', buf.length);
    this.end(this.req && this.req.method === 'HEAD' ? undefined : buf);
    return this;
  }

  json(data) {
    this.type('json');
    return this.send(JSON.stringify(data));
  }

  sendStatus(code) {
    return this.status(code).type('text').send(http.STATUS_CODES[code] || String(code));
  }

  redirect(url, code = 302) {
    this.statusCode = code;
    this.setHeader('Location', url);
    this.end();
    return this;
  }
}

module.exports = Response;
