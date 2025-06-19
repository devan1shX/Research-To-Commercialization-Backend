const admin = require("firebase-admin");
const db = admin.firestore();
const auth = admin.auth();

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Unauthorized: No token provided or malformed token." });
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    req.user = decodedToken;
    if (req.user && req.user.uid) {
      db.collection("users")
        .doc(req.user.uid)
        .update({
          lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        })
        .catch((err) => {
          console.error(
            `Failed to update lastLoginAt for UID: ${req.user.uid}`,
            err
          );
        });
    }
    next();
  } catch (error) {
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ message: "Unauthorized: Token expired." });
    }
    return res.status(403).json({ message: "Unauthorized: Invalid token." });
  }
}

module.exports = { verifyFirebaseToken };
