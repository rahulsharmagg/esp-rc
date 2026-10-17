// Application Dependency
const mini = require('./app/framework');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Application Files
const FirmwareStore = require('./app/services/FirmwareStore');
const SessionStore = require('./app/services/SessionStore');
const DownloadController = require('./app/controllers/DownloadController');
const AdminAuth = require('./app/middleware/AdminAuth');
const AdminController = require('./app/controllers/AdminController');
const ConnectController = require('./app/controllers/ConnectController');
const downloadRoutes = require('./app/routes/download');
const adminRoutes = require('./app/routes/admin');


// Application Configuration
const app = mini();

const store = new FirmwareStore(path.join(__dirname, 'app', 'firmware'));
const sessions = new SessionStore({ ttl: 2 * 60 * 1000 });   // device has 2 min to start after the code is issued
const downloads = new DownloadController({ wss: app.wss, store, sessions, speedLimit: 20 });

app.use(mini.json());
app.use(mini.logger());
app.set('trustProxy', process.env.TRUST_PROXY === '1');

app.use('/firmware', downloadRoutes(downloads));   // HTTP
app.ws('/progress/:code', downloads.watch);        // WebSocket
app.ws('/connect/:code', new ConnectController().handle); // Device Relay

// Applicatoin Status
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

let adminToken = process.env.ADMIN_TOKEN;
if (!adminToken) {
  adminToken = crypto.randomBytes(12).toString('hex');
  console.log(`ADMIN_TOKEN not set. Temporary token: ${adminToken}`);
}
const admin = new AdminController({
  store,
  maxSize: (Number(process.env.MAX_FIRMWARE_MB) || 4) * 1024 * 1024
});
app.use('/admin/api', AdminAuth.create(adminToken), adminRoutes(admin));

// Application Socket
app.ws('/live', (socket) => {
  socket.on('connection', (c) => console.log(c));
  socket.on('message', (msg) => {
    app.wss.broadcast(msg, (client) => client !== socket);
  });
});

const API_PREFIXES = ['/firmware', '/admin/api', '/progress', '/versions', '/api'];
app.use(mini.spa(path.join(__dirname, 'public'), { exclude: API_PREFIXES }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
