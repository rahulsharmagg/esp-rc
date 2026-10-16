'use strict';

/**
 * Base class for class-based middleware.
 *
 *   class Auth extends Middleware {
 *     constructor(opts) { super(); this.opts = opts; }
 *     handle(req, res, next) { ... next(); }
 *   }
 *   app.use(new Auth({...}));        // objects with handle() work directly
 *   app.use(Auth.create({...}));     // or get a plain function
 */
class Middleware {
  handle(req, res, next) {
    throw new Error(`${this.constructor.name} must implement handle(req, res, next)`);
  }

  static create(...args) {
    const instance = new this(...args);
    return (req, res, next) => instance.handle(req, res, next);
  }
}

module.exports = Middleware;
