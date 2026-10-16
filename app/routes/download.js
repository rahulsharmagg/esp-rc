'use strict';
const { Router } = require('../framework');

/** Mounted at /firmware. Order matters: specific paths before /:type/:version? */
module.exports = function downloadRoutes(c) {
  c.list = c.list.bind(c);
  const router = new Router();
  router.post('/sessions', c.create);        // POST /firmware/sessions {type, version?, deviceId?}
  router.get('/status/all', c.status);       // GET /firmware/status/all
  router.get('/versions/:type', c.list);     // GET /firmware/version/list
  router.get('/:type/check', c.check);       // GET /firmware/esp32/check?current=1.0.5
  router.get('/:type/:version?', c.download);// GET /firmware/esp32  or  /firmware/esp32/1.0.6
  return router;
};
