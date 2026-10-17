'use strict';

const OTHER = { device: 'app', app: 'device' };

/**
 * Pairs a device (ESP32) with an app by a 4-digit code and relays every message both ways.
 *
 *   ws://host/connect/1234?role=device     the ESP32 connects first
 *   ws://host/connect/1234?role=app        the app connects after
 *
 * - Messages are passed through untouched (text stays text, binary stays binary).
 * - Nothing is stored: if the other side is offline the message is dropped (stale commands are unsafe).
 * - A new "device" connection replaces the old one (ESP32 reconnects after Wi-Fi loss).
 * - Only one "app" per code. An app can only join when its device is already online.
 * - Server messages are JSON with a "_srv" key, so your own protocol can ignore them:
 *     {"_srv":"presence","role":"device","online":true}
 *     {"_srv":"error","error":"Device is not online"}
 *   Turn presence messages off with new ConnectController({ presence: false }).
 *
 * A 4-digit code is NOT a password (10,000 possibilities). It limits accidents, not attackers.
 */
class ConnectController {
  /**
   * @param {object} [opts]
   * @param {boolean} [opts.presence]      send online/offline notices (default true)
   * @param {number} [opts.heartbeatMs]    ping interval; sockets that never answer are dropped (default 30 s)
   * @param {number} [opts.maxFails]       failed joins allowed per IP per window (default 10)
   * @param {number} [opts.failWindowMs]   window for maxFails (default 60 s)
   */
  constructor({ codeLength = 4, presence = true, heartbeatMs = 30000, maxFails = 10, failWindowMs = 60000 } = {}) {
    this.codeLength = codeLength;
    this.codeRe = new RegExp(`^[A-Z0-9]{${codeLength}}$`);   this.presence = presence;
    this.maxFails = maxFails;
    this.failWindowMs = failWindowMs;
    this.rooms = new Map();   // code -> { device: Connection|null, app: Connection|null }
    this.fails = new Map();   // ip   -> { count, resetAt }

    this.handle = this.handle.bind(this);

    this._timer = setInterval(() => this._heartbeat(), heartbeatMs);
    this._timer.unref();
  }

  /** app.ws('/connect/:code', controller.handle) */
  handle(socket, req) {
    const ip = req.ip;
    const code = String(req.params.code).toUpperCase();
    const role = req.query.role;
    if (this._blocked(ip)) return this._refuse(socket, 4429, 'Too many failed attempts, try again later', ip, false);
    if (!this.codeRe.test(code)) return this._refuse(socket, 4400, `Code must be ${this.codeLength} letters or digits (A-Z, 0-9)`, ip);
    if (!OTHER[role]) return this._refuse(socket, 4400, 'role must be "device" or "app"', ip);

    let room = this.rooms.get(code);

    if (role === 'app') {
      if (!room || !room.device) return this._refuse(socket, 4404, 'Device is not online', ip);
      if (room.app) return this._refuse(socket, 4409, 'Another app is already connected', ip);
    } else {
      if (!room) {
        room = { device: null, app: null };
        this.rooms.set(code, room);
      }
      if (room.device) {                                   // same device reconnecting: replace the old socket
        const old = room.device;
        old.replaced = true;
        room.device = null;
        old.json({ _srv: 'error', error: 'Replaced by a new device connection' });
        old.close(4001);
      }
    }

    room[role] = socket;
    socket.alive = true;

    const peer = () => room[OTHER[role]];
    this._notice(socket, { role: OTHER[role], online: !!peer() });   // tell the newcomer who is here
    this._notice(peer(), { role, online: true });                    // tell the other side

    socket.on('message', (data) => {
      const p = peer();
      if (p) p.send(data);                                 // Buffer -> binary frame, string -> text frame
    });

    socket.on('close', () => {
      if (socket.replaced) return;                         // already swapped out, nothing to announce
      if (room[role] === socket) room[role] = null;
      this._notice(peer(), { role, online: false });
      if (!room.device && !room.app && this.rooms.get(code) === room) this.rooms.delete(code);
    });
  }

  // ---------------- helpers ----------------

  _notice(socket, data) {
    if (this.presence && socket) socket.json({ _srv: 'presence', ...data });
  }

  _refuse(socket, code, message, ip, count = true) {
    if (count) this._fail(ip);
    socket.json({ _srv: 'error', error: message });
    socket.close(code);
  }

  _fail(ip) {
    const now = Date.now();
    let rec = this.fails.get(ip);
    if (!rec || rec.resetAt <= now) rec = { count: 0, resetAt: now + this.failWindowMs };
    rec.count++;
    this.fails.set(ip, rec);
  }

  _blocked(ip) {
    const rec = this.fails.get(ip);
    return !!rec && rec.resetAt > Date.now() && rec.count >= this.maxFails;
  }

  /** Ping everyone; drop sockets that were silent since the last round (dead Wi-Fi, closed lid...). */
  _heartbeat() {
    for (const room of this.rooms.values()) {
      for (const s of [room.device, room.app]) {
        if (!s) continue;
        if (!s.alive) { s.terminate(); continue; }
        s.alive = false;
        s.ping();
      }
    }
    const now = Date.now();
    for (const [ip, rec] of this.fails) if (rec.resetAt <= now) this.fails.delete(ip);
  }
}

module.exports = ConnectController;