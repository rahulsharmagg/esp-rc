'use strict';

/** Collect the request stream into a Buffer, enforcing a size limit. */
module.exports = function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;

    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        const err = new Error('Payload too large');
        err.status = 413;
        return reject(err);
      }
      chunks.push(chunk);
    });
    req.on('end', () => !failed && resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
};
