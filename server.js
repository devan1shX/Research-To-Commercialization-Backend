const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");
const connectDB = require("./config/db");

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

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const studyRoutes = require("./routes/studyRoutes");

app.use(cors());
app.use(express.json());
app.use("/documents", express.static(path.join(__dirname, "documents")));

app.use("/auth", authRoutes);
app.use("/api", userRoutes); 
app.use("/studies", studyRoutes);

app.use((req, res, next) => {
  res.status(404).json({ message: "Sorry, can't find that route!" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err.name, err.message, err.stack);
  res.status(500).json({
    message: "Something broke on the server!",
    error:
      process.env.NODE_ENV === "production"
        ? {}
        : { name: err.name, message: err.message, stack: err.stack },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});