'use strict';
const { Transform } = require('stream');

/**
 * Limits throughput of a stream.
 *   fs.createReadStream(file).pipe(new Throttle(30 * 1024)).pipe(res);   // 30 KB/s
 * Data is released in small slices (default every 100 ms) on a fixed schedule,
 * so the average speed stays close to the limit.
 */
class Throttle extends Transform {
  /** @param {number} bytesPerSec  @param {{interval?:number}} [options] slice size in ms */
  constructor(bytesPerSec, { interval = 100 } = {}) {
    super();
    if (!(bytesPerSec > 0)) throw new TypeError('Throttle needs bytesPerSec > 0');
    this.rate = bytesPerSec;
    this.interval = interval;
    this._nextAt = 0;      // time when the next slice may be sent
    this._timer = null;
  }

  /** Change the limit while streaming. */
  setRate(bytesPerSec) {
    this.rate = bytesPerSec;
  }

  _transform(chunk, enc, cb) {
    let offset = 0;

    const sendNext = () => {
      if (offset >= chunk.length) return cb();

      const size = Math.max(1, Math.floor((this.rate * this.interval) / 1000));
      const part = chunk.subarray(offset, offset + size);
      offset += part.length;

      const now = Date.now();
      const wait = Math.max(0, this._nextAt - now);
      this._timer = setTimeout(() => {
        this._nextAt = Math.max(Date.now(), this._nextAt) + (part.length / this.rate) * 1000;
        this.push(part);
        sendNext();
      }, wait);
    };

    sendNext();
  }

  _destroy(err, cb) {
    clearTimeout(this._timer);
    cb(err);
  }
}

module.exports = Throttle;
