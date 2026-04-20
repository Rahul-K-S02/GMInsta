require("dotenv").config();
const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Server } = require("socket.io");

const connectDB = require("./config/db");
const { apiLimiter, authLimiter } = require("./middleware/rateLimiter");
const errorHandler = require("./middleware/errorHandler");
const setupSocket = require("./config/socket");
const { completeGoogleAuth, getGoogleCallbackRoutePath } = require("./controllers/authController");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const commentRoutes = require("./routes/commentRoutes");
const messageRoutes = require("./routes/messageRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const eventRoutes = require("./routes/eventRoutes");
const viewRoutes = require("./routes/viewRoutes");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

connectDB();
setupSocket(io);
app.set("io", io);

const DEFAULT_PORT = parseInt(process.env.PORT || "5000", 10);
const CANONICAL_HOST = process.env.CANONICAL_HOST || "localhost";

app.use((req, res, next) => {
  const hostname = req.hostname;
  const isLoopbackHost = hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
  if (isLoopbackHost && hostname !== CANONICAL_HOST) {
    return res.redirect(302, `${req.protocol}://${CANONICAL_HOST}:${DEFAULT_PORT}${req.originalUrl}`);
  }
  return next();
});

// Helmet's default CSP is strict and blocks `blob:` (local previews) and external image hosts
// like Cloudinary. Configure CSP explicitly so image previews and uploaded post images render.
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        // Allow Cloudinary (https) and browser previews (blob/data) for images.
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        // Allow Cloudinary videos and local previews for reels.
        mediaSrc: ["'self'", "blob:", "https:"],
        // Socket.io and API calls; allow ws/wss for local sockets.
        connectSrc: ["'self'", "ws:", "wss:", "https:"],
        // App ships scripts from self; allow inline handlers used in a few templates.
        scriptSrc: ["'self'", "https://accounts.google.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        // Allow inline styles used across templates.
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        frameSrc: ["'self'", "https://accounts.google.com"],
        fontSrc: ["'self'", "data:", "https:"],
        upgradeInsecureRequests: null
      }
    }
  })
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes);

app.get(getGoogleCallbackRoutePath(), completeGoogleAuth);

app.use("/", viewRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});
app.use(errorHandler);

let currentPort = DEFAULT_PORT;

const startServer = (port) => {
  server.listen(port, () => {
    console.log(`GMinsta server running on http://localhost:${port}`);
  });
};

server.on("error", (error) => {
  if (error.syscall !== "listen") throw error;
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${currentPort} is already in use. Stop the process using it or change PORT and update the Google authorized origin to match.`);
    process.exit(1);
  }
  throw error;
});

startServer(currentPort);
