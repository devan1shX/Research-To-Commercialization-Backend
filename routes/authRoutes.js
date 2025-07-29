const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
const db = admin.firestore();
const auth = admin.auth();

router.post("/signup", async (req, res) => {
  try {
    const { displayName, email, password, role, phone } = req.body;
    if (!email || !password || !displayName || !role) {
      return res
        .status(400)
        .json({
          message:
            "Missing required fields: email, password, displayName, and role are required.",
        });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }
    const userRecord = await auth.createUser({ email, password, displayName });
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
    await userProfileRef.set(userProfileData);
    res
      .status(201)
      .json({
        message: "User created successfully",
        uid,
        email: userProfileData.email,
      });
  } catch (error) {
    const authErrorMessages = {
      "auth/email-already-exists":
        "The email address is already in use by another account.",
      "auth/invalid-email": "The email address is not valid.",
      "auth/weak-password": "The password is too weak.",
    };
    if (authErrorMessages[error.code]) {
      return res.status(400).json({ message: authErrorMessages[error.code] });
    }
    res
      .status(500)
      .json({ message: "Error creating new user", error: error.message });
  }
});

router.post("/google-signin", async (req, res) => {
  const { idToken, role, phone } = req.body;
  if (!idToken) {
    return res.status(400).json({ message: "ID token is required." });
  }
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email: rawEmail, name, picture } = decodedToken;
    const email = rawEmail ? rawEmail.toLowerCase() : null;
    const displayNameFromToken = name || (email ? email.split("@")[0] : "User");

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email not available from Google token." });
    }

    const userProfileRef = db.collection("users").doc(uid);
    const userProfileSnap = await userProfileRef.get();
    let userProfileData;
    let isNewUser = false;

    if (!userProfileSnap.exists) {
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
      userProfileData = userProfileSnap.data();
      const updates = {
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        displayName: displayNameFromToken || userProfileData.displayName,
        photoURL: picture || null,
        email,
      };
      if (role) updates.role = role;
      if (phone !== undefined)
        updates.contactInfo = {
          ...userProfileData.contactInfo || {},
          phone: phone || null,
        };
      await userProfileRef.update(updates);
      userProfileData = {
        ...userProfileData,
        ...updates,
        lastLoginAt: new Date(),
      };
    }
    res
      .status(200)
      .json({
        message: "Google Sign-In successful",
        uid,
        isNewUser,
        userProfile: userProfileData,
      });
  } catch (error) {
    if (error.code === "auth/id-token-expired")
      return res
        .status(401)
        .json({ message: "Token expired, please sign in again." });
    res
      .status(403)
      .json({ message: "Authentication failed", error: error.message });
  }
});

module.exports = router;
