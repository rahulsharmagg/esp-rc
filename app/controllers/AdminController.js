'use strict';
const fs = require('fs');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const crypto = require('crypto');

const TYPE_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
const VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;
const httpError = (status, message) => Object.assign(new Error(message), { status });

/** Firmware upload / management (mount behind AdminAuth). */
class AdminController {
  /**
   * @param {object} opts
   * @param {FirmwareStore} opts.store
   * @param {number} [opts.maxSize]          max upload in bytes (default 4 MB)
   * @param {boolean} [opts.requireEspImage] first byte must be 0xE9, the ESP32 image magic (default true)
   */
  constructor({ store, maxSize = 4 * 1024 * 1024, requireEspImage = true }) {
    this.store = store;
    this.maxSize = maxSize;
    this.requireEspImage = requireEspImage;
    for (const m of ['list', 'upload', 'setStable', 'remove']) this[m] = this[m].bind(this);
  }

  _check(type, version) {
    if (!TYPE_RE.test(type)) throw httpError(400, 'Invalid device type (letters, numbers, - _ )');
    if (version !== undefined && !VERSION_RE.test(version)) throw httpError(400, 'Version must look like 1.0.8');
  }

  /** GET /admin/api/firmware */
  async list(req, res) {
    res.json({ maxSize: this.maxSize, types: await this.store.listAll() });
  }

  /**
   * PUT /admin/api/firmware/:type/:version?notes=...&stable=1
   * Body = the raw .bin file (streamed to disk, hashed on the way).
   *   curl -T firmware.bin -H "Authorization: Bearer $TOKEN" localhost:3000/admin/api/firmware/esp32/1.0.8
   */
  async upload(req, res) {
    const { type, version } = req.params;
    this._check(type, version);

    if (await this.store.exists(type, version)) throw httpError(409, 'Version already exists');

    const declared = Number(req.get('content-length'));
    if (declared > this.maxSize) {
      res.set('Connection', 'close');
      throw httpError(413, `File too large (max ${Math.round(this.maxSize / 1024)} KB)`);
    }

    const tmp = await this.store.tmpPath();
    const hash = crypto.createHash('sha256');
    let size = 0;
    let first = -1;
    const maxSize = this.maxSize;

    const meter = new Transform({
      transform(chunk, enc, cb) {
        if (first < 0) first = chunk[0];
        size += chunk.length;
        if (size > maxSize) return cb(httpError(413, 'File too large'));
        hash.update(chunk);
        cb(null, chunk);
      }
    });

    try {
      await pipeline(req, meter, fs.createWriteStream(tmp));

      if (size === 0) throw httpError(400, 'Empty upload');
      if (this.requireEspImage && first !== 0xe9) {
        throw httpError(422, 'Not an ESP firmware image (first byte should be 0xE9)');
      }

      const manifest = await this.store.save(type, version, tmp, {
        size,
        sha256: hash.digest('hex'),
        notes: String(req.query.notes || '').slice(0, 500)
      });

      const makeStable = ['1', 'true', 'on'].includes(String(req.query.stable));
      if (makeStable) await this.store.setStable(type, version);

      res.status(201).json({ ...manifest, type, stable: makeStable });
    } catch (err) {
      await fs.promises.rm(tmp, { force: true });   // never leave half files behind
      throw err;
    }
  }

  /** POST /admin/api/firmware/:type/:version/stable */
  async setStable(req, res) {
    this._check(req.params.type, req.params.version);
    await this.store.setStable(req.params.type, req.params.version);
    res.json({ ok: true });
  }

  /** DELETE /admin/api/firmware/:type/:version */
  async remove(req, res) {
    this._check(req.params.type, req.params.version);
    await this.store.remove(req.params.type, req.params.version);
    res.json({ ok: true });
  }
}

module.exports = AdminController;