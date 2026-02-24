"use strict";

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

// Load BotController from source (requires Node run with tsx: node --import tsx server.js)
const { BotController } = require("./src/lib/engine/BotController.ts");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

// Initialize BotController in this process before Next.js handles any request.
// This ensures the WebSocket and Screener run in the same Node instance as API routes.
BotController.getInstance().init();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  })
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
