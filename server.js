// Application Dependency
const mini = require('./framework');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Application Files
const FirmwareStore = require('./services/FirmwareStore');
const SessionStore = require('./services/SessionStore');
const DownloadController = require('./controllers/DownloadController');
const AdminAuth = require('./middleware/AdminAuth');
const AdminController = require('./controllers/AdminController');
const downloadRoutes = require('./routes/download');
const adminRoutes = require('./routes/admin');


// Application Configuration
const app = mini();

const store = new FirmwareStore(path.join(__dirname, 'firmware'));
const sessions = new SessionStore({ ttl: 2 * 60 * 1000 });   // device has 2 min to start after the code is issued
const downloads = new DownloadController({ wss: app.wss, store, sessions, speedLimit: 20 });

app.use(mini.json());
app.use(mini.logger());

app.use('/firmware', downloadRoutes(downloads));   // HTTP
app.ws('/progress/:code', downloads.watch);        // WebSocket

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


app.wss.on('connection', (socket, req) => {
  console.log('connected from', req.ip, '| online:', app.wss.clients.size);
});

app.wss.on('disconnect', (socket, code) => {
  console.log('disconnected, code', code, '| online:', app.wss.clients.size);
});

app.wss.on('message', (socket, data) => {
  console.log('any client sent:', data);   // sees every message from every client
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
