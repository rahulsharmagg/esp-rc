'use strict';
const mini = require('..');

const app = mini();

// ---- 1. Class-based custom middleware -------------------------------
class Auth extends mini.Middleware {
  constructor(token) { super(); this.token = token; }
  handle(req, res, next) {
    if (req.get('authorization') !== `Bearer ${this.token}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }
}

// ---- 2. Plugin: add anything to the app -----------------------------
function healthPlugin(app, { path = '/health' } = {}) {
  app.get(path, (req, res) => res.json({ ok: true, uptime: process.uptime() }));
}

// ---- global middleware ----------------------------------------------
app.use(mini.logger());
app.use(mini.cors());
app.use(mini.json());
app.use(mini.urlencoded());
app.use(mini.static(__dirname + '/public'));
app.plugin(healthPlugin);

// ---- routes ---------------------------------------------------------
app.get('/', (req, res) => res.send('<h1>mini-express</h1>'));

app.get('/users/:id', (req, res) => res.json({ id: req.params.id, query: req.query }));

app.route('/items')
  .get((req, res) => res.json([]))
  .post((req, res) => res.status(201).json({ created: req.body }));

// ---- grouped / nested router with its own middleware ----------------
const admin = new mini.Router();
admin.use(Auth.create('secret'));
admin.get('/stats', async (req, res) => res.json({ users: 42 }));
app.use('/admin', admin);

app.group('/api/v1', (api) => {
  api.get('/ping', (req, res) => res.json({ pong: true }));
});

// ---- async errors are caught automatically --------------------------
app.get('/boom', async () => { throw Object.assign(new Error('Boom'), { status: 400 }); });

// ---- custom error handler (4 args, same as Express) -----------------
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});

// ---- WebSocket ------------------------------------------------------
app.ws('/chat/:room', (socket, req) => {
  socket.json({ welcome: req.params.room });
  socket.on('message', (msg) => app.wss.broadcast(msg, (c) => c !== socket));
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Listening on http://localhost:${port}`));
