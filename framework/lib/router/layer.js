'use strict';

const escapeRegex = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/**
 * One entry in the router stack: path matcher + one handler (+ optional HTTP method).
 * Path syntax: /users/:id   /posts/:slug?   /files/*
 */
class Layer {
  /**
   * @param {string} path
   * @param {Function|{handle:Function}} handler
   * @param {{method?:string|null, end?:boolean}} options
   *        end=true  -> exact match (routes)
   *        end=false -> prefix match (middleware / mounted routers)
   */
  constructor(path, handler, { method = null, end = true } = {}) {
    if (typeof handler !== 'function' && !(handler && typeof handler.handle === 'function')) {
      throw new TypeError('Handler must be a function or an object with handle(req, res, next)');
    }
    this.path = path;
    this.method = method;
    this.end = end;
    this.keys = [];
    this.regexp = this._compile(path, end);
    this.isErrorHandler = typeof handler === 'function' && handler.length === 4;
    this.fn = typeof handler === 'function' ? handler : handler.handle.bind(handler);
  }

  _compile(path, end) {
    let p = !end && path === '/' ? '' : path;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);

    let src = '';
    for (const seg of p.split('/').filter(Boolean)) {
      if (seg === '*') {
        this.keys.push('*');
        src += '/(.*)';
      } else if (seg[0] === ':') {
        const optional = seg.endsWith('?');
        this.keys.push(seg.slice(1, optional ? -1 : undefined));
        src += optional ? '(?:/([^/]+))?' : '/([^/]+)';
      } else {
        src += '/' + escapeRegex(seg);
      }
    }
    return new RegExp('^' + src + (end ? '/?$' : '(?=/|$)'), 'i');
  }

  /** @returns {{params:object, matched:string}|null} */
  match(pathname) {
    const m = this.regexp.exec(pathname);
    if (!m) return null;
    const params = {};
    this.keys.forEach((key, i) => {
      if (m[i + 1] !== undefined) params[key] = decodeURIComponent(m[i + 1]);
    });
    return { params, matched: m[0] };
  }

  /** Run the handler; sync throws and rejected promises both go to next(err). */
  run(err, req, res, next) {
    try {
      const result = err ? this.fn(err, req, res, next) : this.fn(req, res, next);
      if (result && typeof result.then === 'function') result.catch(next);
    } catch (e) {
      next(e);
    }
  }
}

module.exports = Layer;
