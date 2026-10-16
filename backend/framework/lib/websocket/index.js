'use strict';
const crypto = require('crypto');
const EventEmitter = require('events');
const Connection = require('./connection');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class WebSocketServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.clients = new Set();
  }

  /** Complete the HTTP -> WebSocket handshake, then call onConnection(conn). */
  handleUpgrade(req, socket, onConnection) {
    const key = req.headers['sec-websocket-key'];
    if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      return socket.destroy();
    }

    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    const conn = new Connection(socket, this.options);
    this.clients.add(conn);

    conn.on('close', (code) => {
      this.clients.delete(conn);
      this.emit('disconnect', conn, code);
    });

    this.emit('connection', conn, req);
    onConnection(conn);
  }

  /** Send to every client (optionally filtered: broadcast(msg, c => c !== sender)). */
  broadcast(data, filter = () => true) {
    for (const c of this.clients) if (filter(c)) c.send(data);
  }

  closeAll() {
    for (const c of this.clients) c.close(1001);
  }
}

module.exports = { WebSocketServer, Connection };
