require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const authRoutes = require("./routes/auth");
const menuRoutes = require("./routes/menu");
const orderRoutes = require("./routes/orders");
const userRoutes = require("./routes/users");
const socketService = require("./services/socketService");

const app = express();
const httpServer = http.createServer(app);

// ── Allowed origins ───────────────────────────────────────────
const allowedOrigins = [
  "https://chownow.netlify.app",       // production frontend
  "http://localhost:5500",             // VS Code Live Server
  "http://localhost:5501",             // VS Code Live Server (alt port)
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "http://localhost:3000",             // npx serve
];

// ── Socket.io setup ───────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ["GET", "POST"] },
});
socketService.init(io);

// ── CORS middleware ───────────────────────────────────────────
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// Raw body for Paystack webhook (must be before express.json)
app.use("/api/orders/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ── Routes ────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "ChowNow API running with WebSockets + Paystack + Email + Uploads" });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ success: false, message: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 5}MB allowed.` });
  }
  res.status(err.status || 500).json({ success: false, message: err.message || "Internal server error" });
});

// ── Connect DB and start ──────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected");
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 WebSocket server ready`);
      console.log(`📁 Uploads served at /uploads`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });