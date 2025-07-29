// server.js
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");
const connectDB = require("./config/db");

// --- Firebase Admin SDK Initialization ---
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error("Failed to initialize Firebase Admin SDK:", error);
  process.exit(1);
}

connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---

// IMPORTANT: Global CORS configuration at the TOP
// This is the key change to fix the non-JSON response error.
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://r2c.iiitd.edu.in'];
app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json()); // To parse JSON bodies
app.use("/documents", express.static(path.join(__dirname, "documents")));

// --- Routes ---
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const studyRoutes = require("./routes/studyRoutes");
const chatRoutes = require("./routes/chatRoutes");

app.use("/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/studies", studyRoutes);
app.use("/studies", chatRoutes);

// --- Error Handling ---
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: "Sorry, can't find that route!" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled Server Error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Something broke on the server!",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
