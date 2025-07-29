const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const router = express.Router();
const db = admin.firestore();
const auth = admin.auth();

// Add CORS middleware for development
router.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URLs
  credentials: true
}));

// Error handling middleware
const handleError = (res, error, defaultMessage = "An error occurred") => {
  console.error("Error:", error);
  
  const authErrorMessages = {
    "auth/email-already-exists": "The email address is already in use by another account.",
    "auth/invalid-email": "The email address is not valid.",
    "auth/weak-password": "The password is too weak.",
    "auth/id-token-expired": "Token expired, please sign in again.",
    "auth/id-token-revoked": "Token has been revoked, please sign in again.",
    "auth/invalid-id-token": "Invalid token, please sign in again."
  };

  if (authErrorMessages[error.code]) {
    return res.status(400).json({ 
      success: false,
      message: authErrorMessages[error.code] 
    });
  }

  // Network or server errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({ 
      success: false,
      message: "Service temporarily unavailable. Please try again later." 
    });
  }

  res.status(500).json({ 
    success: false,
    message: defaultMessage, 
    error: process.env.NODE_ENV === 'development' ? error.message : undefined 
  });
};

router.post("/signup", async (req, res) => {
  try {
    const { displayName, email, password, role, phone } = req.body;
    
    // Validation
    if (!email || !password || !displayName || !role) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, password, displayName, and role are required.",
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: "Password must be at least 6 characters long." 
      });
    }

    // Create user in Firebase Auth
    const userRecord = await auth.createUser({ 
      email, 
      password, 
      displayName 
    });
    
    const uid = userRecord.uid;
    const userProfileRef = db.collection("users").doc(uid);
    
    const userProfileData = {
      email: email.toLowerCase(),
      displayName,
      role,
      contactInfo: { phone: phone || null },
      photoURL: userRecord.photoURL || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
      authProvider: "password",
      favoriteStudies: [],
    };

    // Save user profile to Firestore
    await userProfileRef.set(userProfileData);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        uid,
        email: userProfileData.email,
      }
    });
    
  } catch (error) {
    handleError(res, error, "Error creating new user");
  }
});

router.post("/google-signin", async (req, res) => {
  try {
    const { idToken, role, phone } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ 
        success: false,
        message: "ID token is required." 
      });
    }

    // Verify the ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email: rawEmail, name, picture } = decodedToken;
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    const displayNameFromToken = name || (email ? email.split("@")[0] : "User");

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email not available from Google token." 
      });
    }

    const userProfileRef = db.collection("users").doc(uid);
    const userProfileSnap = await userProfileRef.get();
    let userProfileData;
    let isNewUser = false;

    if (!userProfileSnap.exists) {
      // New user
      isNewUser = true;
      userProfileData = {
        email,
        displayName: displayNameFromToken,
        photoURL: picture || null,
        role: role || "student",
        contactInfo: { phone: phone || null },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        authProvider: "google.com",
        favoriteStudies: [],
      };
      await userProfileRef.set(userProfileData);
    } else {
      // Existing user - update login time and other fields
      userProfileData = userProfileSnap.data();
      const updates = {
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        displayName: displayNameFromToken || userProfileData.displayName,
        photoURL: picture || userProfileData.photoURL,
        email,
      };
      
      // Only update role if provided and user doesn't have one
      if (role && (!userProfileData.role || userProfileData.role === "")) {
        updates.role = role;
      }
      
      // Update phone if provided
      if (phone !== undefined) {
        updates.contactInfo = {
          ...(userProfileData.contactInfo || {}),
          phone: phone || null,
        };
      }

      await userProfileRef.update(updates);
      userProfileData = {
        ...userProfileData,
        ...updates,
        lastLoginAt: new Date(),
      };
    }

    res.status(200).json({
      success: true,
      message: "Google Sign-In successful",
      data: {
        uid,
        isNewUser,
        userProfile: userProfileData,
      }
    });
    
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ 
        success: false,
        message: "Token expired, please sign in again." 
      });
    }
    
    if (error.code === "auth/invalid-id-token") {
      return res.status(403).json({ 
        success: false,
        message: "Invalid authentication token." 
      });
    }
    
    handleError(res, error, "Authentication failed");
  }
});

// Health check endpoint
router.get("/health", (req, res) => {
  res.status(200).json({ 
    success: true,
    message: "Auth service is running",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
