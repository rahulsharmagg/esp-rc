'use strict';
const { Router } = require('../framework');

/** Mounted at /admin/api behind AdminAuth. */
module.exports = function adminRoutes(c) {
  const router = new Router();
  router.get('/firmware', c.list);
  router.put('/firmware/:type/:version', c.upload);
  router.post('/firmware/:type/:version/stable', c.setStable);
  router.delete('/firmware/:type/:version', c.remove);
  return router;
};