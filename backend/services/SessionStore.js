'use strict';
const crypto = require('crypto');

// no 0/O/1/I so the code is easy to read and type
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const BLOCKED = new Set(['claimed', 'started', 'downloading', 'completed']);

const httpError = (status, message) => Object.assign(new Error(message), { status });

/**
 * One-time download codes that link a device's download to the app watching it.
 *
 * status: waiting -> claimed -> started -> downloading -> completed
 *                 \-> expired (never used)      \-> aborted (can retry with same code)
 */
class SessionStore {
  /** @param {{ttl?:number, length?:number}} opts  ttl = ms the device has to start (default 2 min) */
  constructor({ ttl = 120000, length = 8 } = {}) {
    this.ttl = ttl;
    this.length = length;
    this.sessions = new Map();
    this.onExpire = null;                       // (session) => void
    this._timer = setInterval(() => this.sweep(), 15000);
    this._timer.unref();                        // don't keep the process alive
  }

  _newCode() {
    let code;
    do {
      code = '';
      for (let i = 0; i < this.length; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    } while (this.sessions.has(code));
    return code;
  }

  create(data = {}) {
    const now = Date.now();
    const session = {
      ...data,
      code: this._newCode(),
      status: 'waiting',
      createdAt: now,
      expiresAt: now + this.ttl,
      removeAt: now + this.ttl + 60000,
      progress: null
    };
    this.sessions.set(session.code, session);
    return session;
  }

  get(code) {
    return this.sessions.get(String(code || '').trim().toUpperCase()) || null;
  }

  /** Validate a code for a download. Throws 403 / 410 / 409. */
  claim(code) {
    const s = this.get(code);
    if (!s) throw httpError(403, 'Invalid code');
    if (s.status === 'expired' || (s.status === 'waiting' && Date.now() > s.expiresAt)) {
      throw httpError(410, 'Code expired');
    }
    if (BLOCKED.has(s.status)) throw httpError(409, 'Code already used');
    s.status = 'claimed';                       // blocks a second request immediately
    return s;
  }

  /** Undo claim() when the download could not start. */
  release(code) {
    const s = this.get(code);
    if (s && s.status === 'claimed') s.status = 'waiting';
  }

  update(code, status, progress) {
    const s = this.get(code);
    if (!s) return;
    s.status = status;
    s.progress = progress;
    const now = Date.now();
    if (status === 'started' || status === 'downloading') s.removeAt = now + 10 * 60000;
    else if (status === 'completed') s.removeAt = now + 10 * 60000;   // app can reconnect and see the result
    else if (status === 'aborted') s.removeAt = now + this.ttl;       // retry window
    else if (status === 'expired') s.removeAt = now + 60000;
  }

  sweep() {
    const now = Date.now();
    for (const [code, s] of this.sessions) {
      if (s.status === 'waiting' && now > s.expiresAt) {
        s.status = 'expired';
        s.removeAt = now + 60000;
        if (this.onExpire) this.onExpire(s);
      }
      if (now > s.removeAt) this.sessions.delete(code);
    }
  }
}

module.exports = SessionStore;