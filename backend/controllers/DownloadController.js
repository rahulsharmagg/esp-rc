'use strict';
const fs = require('fs');
const Throttle = require('../framework/lib/utils/throttle');
const FirmwareStore = require('../services/FirmwareStore');

const httpError = (status, message) => Object.assign(new Error(message), { status });

class DownloadController {
  /**
   * @param {object} opts
   * @param {WebSocketServer} opts.wss
   * @param {FirmwareStore} opts.store
   * @param {SessionStore} opts.sessions
   * @param {number} [opts.speedLimit]        default KB/s (0 = unlimited)
   * @param {boolean} [opts.allowQuerySpeed]  allow ?speed=50 (turn off in production)
   * @param {boolean} [opts.requireCode]      downloads need a session code (default true)
   */
  constructor({ wss, store, sessions, topic = 'progress', speedLimit = 0, allowQuerySpeed = true, requireCode = true }) {
    this.wss = wss;
    this.store = store;
    this.sessions = sessions;
    this.topic = topic;
    this.speedLimit = speedLimit;
    this.allowQuerySpeed = allowQuerySpeed;
    this.requireCode = requireCode;
    this.state = new Map(); // deviceId -> latest progress (admin view)

    this.sessions.onExpire = (s) => this._notify({ ...this._initial(s), status: 'expired' });

    for (const m of ['create', 'download', 'check', 'list', 'watch', 'status']) this[m] = this[m].bind(this);
  }

  _initial(s) {
    return { code: s.code, deviceId: s.deviceId, deviceType: s.type, version: s.version, total: 0, limit: 0, status: 'waiting', percent: 0, sent: 0 };
  }

  /**
   * POST /firmware/sessions   body: { type, version?, deviceId? }
   * The APP calls this, then sends the returned code to the ESP32 over Bluetooth.
   */
  async create(req, res) {
    const { type, version = 'stable', deviceId } = req.body || {};
    if (!type) throw httpError(400, 'type is required');

    const info = await this.store.resolve(type, version);      // 404 if it doesn't exist
    const session = this.sessions.create({ type, version: info.version });
    session.deviceId = deviceId || `dev-${session.code}`;
    const { code: _code, ...progress } = this._initial(session);   // never send the code over ws
    session.progress = progress;

    res.status(201).json({
      code: session.code,
      type,
      version: info.version,
      size: info.size,
      sha256: info.manifest.sha256 || null,
      expiresIn: Math.round(this.sessions.ttl / 1000),
      ws: `/progress/${session.code}`,
      download: `/firmware/${type}?code=${session.code}`
    });
  }

  /**
   * GET /firmware/:type/:version?code=XXXX   (the ESP32 calls this)
   * With a code, the session decides the version and the device id.
   */
  async download(req, res) {
    let { type, version } = req.params;
    let session = null;
    let deviceId;

    if (this.requireCode) {
      session = this.sessions.claim(req.query.code || req.get('x-session-code'));
      if (session.type !== type) {
        this.sessions.release(session.code);
        throw httpError(403, 'Code is not valid for this device type');
      }
      version = session.version;
      deviceId = session.deviceId;
    } else {
      deviceId = req.query.deviceId || req.get('x-device-id') || req.ip;
    }

    let info;
    try {
      info = await this.store.resolve(type, version);
    } catch (err) {
      if (session) this.sessions.release(session.code);
      throw err;
    }
    const { size: total, manifest } = info;
    let sent = 0;
    let percent = 0;

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', total);
    res.setHeader('Content-Disposition', `attachment; filename="${manifest.file || 'firmware.bin'}"`);
    res.setHeader('X-Firmware-Version', info.version);
    if (manifest.sha256) res.setHeader('X-Firmware-SHA256', manifest.sha256);

    // speed limit KB/s: ?speed=  >  manifest.speedLimit  >  controller default (0 = unlimited)
    const queryLimit = this.allowQuerySpeed ? Number(req.query.speed) : 0;
    const limit = queryLimit > 0 ? queryLimit : Number(manifest.speedLimit) || this.speedLimit;

    const base = { code: session && session.code, deviceId, deviceType: type, version: info.version, total, limit };
    this._notify({ ...base, status: 'started', percent: 0, sent: 0 });

    const source = fs.createReadStream(info.file, { highWaterMark: 16 * 1024 });
    const out = limit > 0 ? source.pipe(new Throttle(limit * 1024)) : source;   // counted AFTER throttling

    out.on('data', (chunk) => {
      sent += chunk.length;
      const p = Math.floor((sent / total) * 100);
      if (p !== percent) {
        percent = p;
        this._notify({ ...base, status: 'downloading', percent, sent });
      }
    });
    source.on('error', () => res.destroy());

    // 'finish' and 'close' can arrive in either order, so decide once, on the first one.
    let reported = false;
    const done = () => {
      if (reported) return;
      reported = true;
      if (sent >= total) this._notify({ ...base, status: 'completed', percent: 100, sent: total });
      else this._notify({ ...base, status: 'aborted', percent, sent });
    };
    res.on('finish', done);
    res.on('close', () => { done(); source.destroy(); if (out !== source) out.destroy(); });

    out.pipe(res);
  }

  /** GET /firmware/:type/check?current=1.0.5 */
  async check(req, res) {
    const { type } = req.params;
    const current = req.query.current;
    const info = await this.store.resolve(type, 'stable');
    res.json({
      current: current || null,
      stable: info.version,
      updateAvailable: !current || FirmwareStore.compare(info.version, current) > 0,
      url: `/firmware/${type}/${info.version}`,
      size: info.size,
      sha256: info.manifest.sha256 || null,
      notes: info.manifest.notes || null,
      releasedAt: info.manifest.uploadedAt
    });
  }

  async list(req, res) {
    res.json({ type: req.params.type, versions: await this.store.versions(req.params.type) });
  }

  /**
   * WebSocket /progress/:code   (the APP connects here after the ESP32 got the code)
   * WebSocket /progress         (admin view of everything - protect it or don't register it)
   */
  watch(socket, req) {
    const code = req.params.code;

    if (!code) {
      socket.topic = this.topic;
      for (const s of this.state.values()) socket.json({ type: 'download', ...s });
      return;
    }

    const session = this.sessions.get(code);
    if (!session) {
      socket.json({ type: 'error', error: 'Unknown or expired code' });
      return socket.close(4404);
    }
    socket.code = session.code;
    socket.json({ type: 'download', ...session.progress });   // catch up: waiting / current %
  }

  status(req, res) {
    res.json([...this.state.values()]);
  }

  _notify(state) {
    const { code, ...payload } = state;                       // the code is never broadcast
    this.state.set(payload.deviceId, payload);
    if (code) this.sessions.update(code, payload.status, payload);

    this.wss.broadcast(
      JSON.stringify({ type: 'download', ...payload }),
      (c) => (code && c.code === code) || c.topic === this.topic
    );

    if (code && (payload.status === 'completed' || payload.status === 'expired')) {
      setTimeout(() => {
        for (const c of this.wss.clients) if (c.code === code) c.close(1000);
      }, 1000).unref();
    }
  }
}

module.exports = DownloadController;