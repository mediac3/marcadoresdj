import { createServer } from "http";
import { Server } from "socket.io";

// ─── HTTP + Socket.io Server on port 3003 ───────────────────────────────────

const PORT = 3003;

const httpServer = createServer((req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "marcadoresdj-socket" }));
    return;
  }

  // Broadcast endpoint – called by API routes to push updates to clients
  if (req.method === "POST" && req.url === "/broadcast") {
    let body = "";

    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body);
        const { event: eventId, type, data } = payload;

        if (!eventId || !type) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({ error: "Missing required fields: event, type" })
          );
          return;
        }

        // Build the broadcast message
        const message = {
          type,
          eventId,
          data,
          timestamp: Date.now(),
        };

        // Emit to the specific event room
        io.to(`event:${eventId}`).emit("event-update", message);

        // Also emit to the global live-events room
        io.to("live-events").emit("live-update", message);

        // Count clients in the event room
        const roomSockets = io.sockets.adapter.rooms.get(`event:${eventId}`);
        const clientCount = roomSockets ? roomSockets.size : 0;

        console.log(
          `[broadcast] type=${type} event=${eventId} clients=${clientCount}`
        );

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            eventId,
            type,
            clientsReached: clientCount,
          })
        );
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON body" }));
      }
    });

    return;
  }

  // 404 for everything else
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// ─── Socket.io Setup ─────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  // Default path /socket.io/ is used so custom HTTP endpoints (/health, /broadcast)
  // on the same server are not intercepted by Socket.io middleware.
  // Frontend connects with: io("/socket.io/?XTransformPort=3003")
  cors: {
    origin: "*", // Allow all origins for v1.0
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

io.on("connection", (socket) => {
  console.log(`[connect] socket=${socket.id} total=${io.engine.clientsCount}`);

  // ── Join an event room ──────────────────────────────────────────────────
  socket.on("join-event", (payload: { eventId: string }) => {
    if (!payload?.eventId) return;

    const roomName = `event:${payload.eventId}`;
    socket.join(roomName);
    console.log(`[join-event] socket=${socket.id} room=${roomName}`);

    // Confirm join back to the client
    socket.emit("joined-event", { eventId: payload.eventId, room: roomName });
  });

  // ── Leave an event room ─────────────────────────────────────────────────
  socket.on("leave-event", (payload: { eventId: string }) => {
    if (!payload?.eventId) return;

    const roomName = `event:${payload.eventId}`;
    socket.leave(roomName);
    console.log(`[leave-event] socket=${socket.id} room=${roomName}`);

    socket.emit("left-event", { eventId: payload.eventId, room: roomName });
  });

  // ── Join the global live-events room ────────────────────────────────────
  socket.on("join-live", () => {
    socket.join("live-events");
    console.log(`[join-live] socket=${socket.id}`);
    socket.emit("joined-live", { room: "live-events" });
  });

  // ── Leave the global live-events room ───────────────────────────────────
  socket.on("leave-live", () => {
    socket.leave("live-events");
    console.log(`[leave-live] socket=${socket.id}`);
    socket.emit("left-live", { room: "live-events" });
  });

  // ── Disconnect ──────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(
      `[disconnect] socket=${socket.id} reason=${reason} total=${io.engine.clientsCount}`
    );
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`🟢 MarcadoresDJ Socket Service running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Broadcast: POST http://localhost:${PORT}/broadcast`);
});

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down...");
  httpServer.close(() => {
    console.log("Socket service closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down...");
  httpServer.close(() => {
    console.log("Socket service closed");
    process.exit(0);
  });
});