'use strict';
const http = require('http');
const querystring = require('querystring');

/** Extends Node's IncomingMessage. Add your own helpers here. */
class Request extends http.IncomingMessage {
  get path() {
    return this.url.split('?')[0];
  }

  get query() {
    if (!this._query) {
      const i = this.url.indexOf('?');
      this._query = i === -1 ? {} : querystring.parse(this.url.slice(i + 1));
    }
    return this._query;
  }

  get ip() {
    const fwd = this.headers['x-forwarded-for'];
    const trust = this.app && this.app.settings && this.app.settings.trustProxy;
    return trust && fwd ? fwd.split(',').pop().trim() : this.socket.remoteAddress;
  }

  /** req.get('Content-Type') */
  get(name) {
    return this.headers[name.toLowerCase()];
  }

  /** req.is('json') */
  is(type) {
    const ct = this.headers['content-type'] || '';
    return ct.includes(type);
  }
}

module.exports = Request;
