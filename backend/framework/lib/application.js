'use strict';
const http = require('http');
const Router = require('./router');
const Layer = require('./router/layer');
const Request = require('./http/request');
const Response = require('./http/response');
const { WebSocketServer } = require('./websocket');

class Application extends Router {
  constructor() {
    super();
    this.settings = {};
    this.server = null;
    this.wss = new WebSocketServer();
    this.wsRoutes = [];
  }

  /** app.set('name', value) / app.setting('name') */
  set(key, value) {
    this.settings[key] = value;
    return this;
  }

  setting(key) {
    return this.settings[key];
  }

  /** Install a plugin: a function (app, options) that can add middleware, routes, methods... */
  plugin(fn, options) {
    fn(this, options);
    return this;
  }

  /** WebSocket route: app.ws('/chat', (socket, req) => { ... }) */
  ws(path, handler) {
    this.wsRoutes.push(new Layer(path, handler, { end: true }));
    return this;
  }

  /** Entry point for every HTTP request. */
  handleRequest(req, res) {
    req.app = res.app = this;
    req.res = res;
    res.req = req;
    req.params = {};
    this.handle(req, res, (err) => (err ? this.onError(err, req, res) : this.onNotFound(req, res)));
  }

  /** Override to customise: app.onNotFound = (req, res) => ... */
  onNotFound(req, res) {
    res.status(404).type('text').send(`Cannot ${req.method} ${req.path}`);
  }

  /** Override to customise: app.onError = (err, req, res) => ... */
  onError(err, req, res) {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return res.end();
    res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message });
  }

  _handleUpgrade(req, socket) {
    const pathname = req.path;
    for (const layer of this.wsRoutes) {
      const m = layer.match(pathname);
      if (!m) continue;
      req.params = m.params;
      return this.wss.handleUpgrade(req, socket, (conn) => layer.fn(conn, req));
    }
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
  }

  /** Same signature as http.Server#listen */
  listen(...args) {
    this.server = http.createServer(
      { IncomingMessage: Request, ServerResponse: Response },
      (req, res) => this.handleRequest(req, res)
    );
    this.server.on('upgrade', (req, socket) => this._handleUpgrade(req, socket));
    return this.server.listen(...args);
  }

  close(cb) {
    this.wss.closeAll();
    return this.server && this.server.close(cb);
  }
}

module.exports = Application;
