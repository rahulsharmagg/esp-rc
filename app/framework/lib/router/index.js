'use strict';
const Layer = require('./layer');

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

/**
 * Router: holds an ordered stack of Layers.
 * Application extends this class, so app.get / app.use work exactly like router.get / router.use.
 */
class Router {
  constructor() {
    this.stack = [];
  }

  /** Add middleware (function, object with handle(), or a Router). Optional path prefix. */
  use(...args) {
    const path = typeof args[0] === 'string' ? args.shift() : '/';
    for (const h of args.flat(Infinity)) {
      this.stack.push(new Layer(path, h, { end: false }));
    }
    return this;
  }

  /** Register handlers for any method. */
  all(path, ...handlers) {
    return this._add(null, path, handlers);
  }

  /** router.route('/users').get(fn).post(fn) */
  route(path) {
    const chain = { all: (...h) => (this._add(null, path, h), chain) };
    for (const m of METHODS) chain[m] = (...h) => (this._add(m.toUpperCase(), path, h), chain);
    return chain;
  }

  /** router.group('/api', r => { r.get('/users', fn) }) */
  group(prefix, callback) {
    const sub = new Router();
    callback(sub);
    return this.use(prefix, sub);
  }

  _add(method, path, handlers) {
    for (const h of handlers.flat(Infinity)) {
      this.stack.push(new Layer(path, h, { method, end: true }));
    }
    return this;
  }

  /** Walk the stack. `out` is called when nothing handled the request. */
  handle(req, res, out) {
    const stack = this.stack;
    const parentUrl = req.url;
    const parentBase = req.baseUrl || '';
    const parentParams = req.params || {};
    let idx = 0;

    const restore = () => {
      req.url = parentUrl;
      req.baseUrl = parentBase;
    };

    const next = (err) => {
      restore();
      if (idx >= stack.length) return out(err);

      const layer = stack[idx++];
      if (err ? !layer.isErrorHandler : layer.isErrorHandler) return next(err);

      if (layer.method) {
        const ok = layer.method === req.method || (req.method === 'HEAD' && layer.method === 'GET');
        if (!ok) return next(err);
      }

      const pathname = parentUrl.split('?')[0];
      const m = layer.match(pathname);
      if (!m) return next(err);

      req.params = Object.assign({}, parentParams, m.params);
      if (!layer.end && m.matched) {          // mounted: strip prefix
        req.baseUrl = parentBase + m.matched;
        req.url = parentUrl.slice(m.matched.length) || '/';
      }
      layer.run(err, req, res, next);
    };

    next();
  }
}

for (const m of METHODS) {
  Router.prototype[m] = function (path, ...handlers) {
    return this._add(m.toUpperCase(), path, handlers);
  };
}

module.exports = Router;
module.exports.METHODS = METHODS;
