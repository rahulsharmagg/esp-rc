'use strict';
const EventEmitter = require('events');
const { OPCODES, decode, encode } = require('./frame');

/**
 * One WebSocket client.
 * Events: 'message' (data, isBinary) | 'close' (code) | 'error' (err)
 */
class Connection extends EventEmitter {
  constructor(socket, { maxPayload = 1024 * 1024 } = {}) {
    super();
    this.socket = socket;
    this.maxPayload = maxPayload;
    this.open = true;
    this.alive = true;
    this._buffer = Buffer.alloc(0);
    this._fragments = [];
    this._fragOpcode = 0;

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('end', () => { this._onClosed(1006); socket.end(); });
    socket.on('close', () => this._onClosed(1006));
    socket.on('error', (err) => {
      if (this.listenerCount('error')) this.emit('error', err); // never crash on a dropped client
      this._onClosed(1006);
    });
  }

  send(data) {
    const isBinary = Buffer.isBuffer(data);
    this._write(isBinary ? OPCODES.BINARY : OPCODES.TEXT, isBinary ? data : Buffer.from(String(data)));
  }

  json(obj) {
    this.send(JSON.stringify(obj));
  }

  ping() {
    this._write(OPCODES.PING, Buffer.alloc(0));
  }

  terminate() {
    this.socket.destroy();
  }

  close(code = 1000) {
    if (!this.open) return;
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code);
    this._write(OPCODES.CLOSE, payload);
    this.socket.end();
    this._onClosed(code);
  }

  _write(opcode, payload) {
    if (this.open) this.socket.write(encode(opcode, payload));
  }

  _onData(chunk) {
    this._buffer = Buffer.concat([this._buffer, chunk]);
    let frame;
    while (this.open && (frame = decode(this._buffer))) {
      this._buffer = this._buffer.subarray(frame.length);
      if (frame.payload.length > this.maxPayload) return this.close(1009);
      this.alive = true;
      this._onFrame(frame);
    }
  }

  _onFrame({ fin, opcode, payload }) {
    switch (opcode) {
      case OPCODES.CLOSE:
        return this.close(payload.length >= 2 ? payload.readUInt16BE(0) : 1000);
      case OPCODES.PING:
        this.emit('ping', payload);
        return this._write(OPCODES.PONG, payload);
      case OPCODES.PONG:
        this.emit('pong', payload);
        return;
      default: {
        if (opcode !== OPCODES.CONT) this._fragOpcode = opcode;
        this._fragments.push(payload);
        if (!fin) return;
        const message = Buffer.concat(this._fragments);
        this._fragments = [];
        const isBinary = this._fragOpcode === OPCODES.BINARY;
        this.emit('message', isBinary ? message : message.toString('utf8'), isBinary);
      }
    }
  }

  _onClosed(code) {
    if (!this.open) return;
    this.open = false;
    this.emit('close', code);
  }
}

module.exports = Connection;
