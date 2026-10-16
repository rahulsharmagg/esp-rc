'use strict';
const UNITS = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/** '1mb' -> 1048576 (numbers pass through) */
module.exports = function bytes(value) {
  if (typeof value === 'number') return value;
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(String(value).trim());
  if (!m) throw new TypeError(`Invalid size: ${value}`);
  return Math.floor(parseFloat(m[1]) * UNITS[(m[2] || 'b').toLowerCase()]);
};
