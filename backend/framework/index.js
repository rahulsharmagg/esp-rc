'use strict';
const Application = require('./lib/application');
const Router = require('./lib/router');
const Middleware = require('./lib/middleware/base');
const bodyParser = require('./lib/bodyparser');
const { WebSocketServer } = require('./lib/websocket');

/** Usage: const app = mini(); */
function createApp() {
  return new Application();
}

createApp.Application = Application;
createApp.Router = Router;
createApp.Middleware = Middleware;
createApp.WebSocketServer = WebSocketServer;
createApp.Throttle = require('./lib/utils/throttle');

// built-in middleware (same names as Express)
createApp.json = bodyParser.json;
createApp.urlencoded = bodyParser.urlencoded;
createApp.text = bodyParser.text;
createApp.raw = bodyParser.raw;
createApp.bodyParser = bodyParser;
createApp.static = require('./lib/middleware/static');
createApp.cors = require('./lib/middleware/cors');
createApp.spa = require('./lib/middleware/spa');
createApp.logger = require('./lib/middleware/logger');

module.exports = createApp;
