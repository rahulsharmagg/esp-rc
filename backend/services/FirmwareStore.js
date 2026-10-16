'use strict';
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

/**
 * Reads the firmware folder:
 *   firmware/stable.json                 { "esp32": "1.0.7" }
 *   firmware/<type>/<version>/firmware.bin
 *   firmware/<type>/<version>/manifest.json   { version, file, size, sha256, notes }
 */
class FirmwareStore {
  constructor(root) {
    this.root = root;
  }

  /** Reject anything that could escape the firmware folder. */
  _safe(name) {
    if (!/^[\w.-]+$/.test(name) || name.includes('..') || name.startsWith('.')) throw this._error(400, 'Invalid name');
    return name;
  }

  _error(status, message) {
    return Object.assign(new Error(message), { status });
  }

  async _readJson(file) {
    try {
      return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') throw this._error(404, 'Firmware not found');
      throw err;
    }
  }

  /** Version listed in stable.json for a device type. */
  async stable(type) {
    const data = await this._readJson(path.join(this.root, 'stable.json'));
    const v = data[type] || data.version;          // accepts { esp32: "x" } or { version: "x" }
    if (!v) throw this._error(404, `No stable version for ${type}`);
    return v;
  }

  /** All versions of a type, oldest -> newest. */
  async versions(type) {
    try {
      const dirs = await fs.readdir(path.join(this.root, this._safe(type)));
      return dirs.filter((d) => /^\d/.test(d)).sort(FirmwareStore.compare);
    } catch (err) {
      if (err.code === 'ENOENT') throw this._error(404, `Unknown device type: ${type}`);
      throw err;
    }
  }

  /** Turn "stable" | "latest" | "1.0.5" into full file info. */
  async resolve(type, version = 'stable') {
    this._safe(type);
    if (version === 'stable') version = await this.stable(type);
    else if (version === 'latest') version = (await this.versions(type)).pop();
    this._safe(version);

    const dir = path.join(this.root, type, version);
    const manifest = await this._readJson(path.join(dir, 'manifest.json'));
    const file = path.join(dir, this._safe(manifest.file || 'firmware.bin'));

    let stat;
    try { stat = await fs.stat(file); } catch { throw this._error(404, 'Firmware file missing'); }

    return { type, version, manifest, file, size: stat.size };
  }

  // ---------------- admin / upload helpers ----------------

  async _writeJson(file, data) {                       // atomic: write temp, then rename
    const tmp = `${file}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
    await fs.rename(tmp, file);
  }

  /** A fresh temp path on the same disk as the firmware folder (so rename is instant). */
  async tmpPath() {
    const dir = path.join(this.root, '.tmp');
    await fs.mkdir(dir, { recursive: true });
    return path.join(dir, crypto.randomBytes(8).toString('hex'));
  }

  async exists(type, version) {
    try {
      await fs.access(path.join(this.root, this._safe(type), this._safe(version), 'manifest.json'));
      return true;
    } catch (err) {
      if (err.status) throw err;
      return false;
    }
  }

  /** Every type and version, newest first, with the stable one marked. */
  async listAll() {
    let stable = {};
    try { stable = await this._readJson(path.join(this.root, 'stable.json')); } catch (e) { /* none yet */ }

    const entries = await fs.readdir(this.root, { withFileTypes: true }).catch(() => []);
    const types = {};
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || !/^[\w-]+$/.test(e.name)) continue;
      const versions = (await this.versions(e.name)).reverse();
      types[e.name] = await Promise.all(versions.map(async (version) => {
        try {
          const info = await this.resolve(e.name, version);
          const m = info.manifest;
          return { version, size: info.size, sha256: m.sha256 || null, notes: m.notes || '',
                   uploadedAt: m.uploadedAt || null, stable: (stable[e.name] || stable.version) === version };
        } catch (err) {
          return { version, broken: true };
        }
      }));
    }
    return types;
  }

  /** Move an uploaded temp file into firmware/<type>/<version>/ and write its manifest. */
  async save(type, version, tmpFile, { size, sha256, notes = '' }) {
    if (await this.exists(type, version)) throw this._error(409, 'Version already exists');
    const dir = path.join(this.root, this._safe(type), this._safe(version));
    await fs.mkdir(dir, { recursive: true });
    await fs.rename(tmpFile, path.join(dir, 'firmware.bin'));
    const manifest = { version, file: 'firmware.bin', size, sha256, notes, uploadedAt: new Date().toISOString() };
    await this._writeJson(path.join(dir, 'manifest.json'), manifest);
    return manifest;
  }

  async setStable(type, version) {
    if (!(await this.exists(type, version))) throw this._error(404, 'Version not found');
    const file = path.join(this.root, 'stable.json');
    let data = {};
    try { data = await this._readJson(file); } catch (e) { /* first time */ }
    data[type] = version;
    await this._writeJson(file, data);
  }

  async remove(type, version) {
    if (!(await this.exists(type, version))) throw this._error(404, 'Version not found');
    if ((await this.stable(type).catch(() => null)) === version) {
      throw this._error(409, 'This is the stable version. Set another version as stable first.');
    }
    await fs.rm(path.join(this.root, type, version), { recursive: true, force: true });
  }

  /** Compare "1.0.10" vs "1.0.9" numerically. */
  static compare(a, b) {
    const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d) return d;
    }
    return 0;
  }
}

module.exports = FirmwareStore;