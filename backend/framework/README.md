# mini-express

Zero-dependency, CommonJS, class-based Express-style framework.

```
mini-express/
├── index.js                 entry: mini(), mini.Router, mini.json, mini.static ...
├── lib/
│   ├── application.js       Application (extends Router): listen, ws, plugin, onError
│   ├── router/
│   │   ├── index.js         Router: use/get/post/route/group/handle
│   │   └── layer.js         Layer: path matching + handler wrapper
│   ├── http/
│   │   ├── request.js       Request  extends IncomingMessage
│   │   └── response.js      Response extends ServerResponse
│   ├── middleware/
│   │   ├── base.js          Middleware base class
│   │   ├── logger.js  cors.js  static.js
│   ├── bodyparser/          json / urlencoded / text / raw / createParser
│   ├── websocket/           WebSocketServer, Connection, frame codec
│   └── utils/               bytes.js, mime.js
└── examples/app.js
```
Run: `node examples/app.js`
