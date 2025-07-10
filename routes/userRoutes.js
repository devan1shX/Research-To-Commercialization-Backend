const express = require("express");
const admin = require("firebase-admin");
const mongoose = require("mongoose");
const { verifyFirebaseToken } = require("../middleware/auth");
const Study = require("../models/study"); 

const router = express.Router();
const db = admin.firestore();

router.get("/my-profile", verifyFirebaseToken, async (req, res) => {
  const uid = req.user.uid;
  try {
    const userProfileSnap = await db.collection("users").doc(uid).get();
    if (!userProfileSnap.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }
    res.json({ userProfile: userProfileSnap.data() });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user profile." });
  }
});

router.get("/my-studies", verifyFirebaseToken, async (req, res) => {
  const researcher_id = req.user.uid;
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;

    const query = { researcher_id: researcher_id };
    const userStudies = await Study.find(query)
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalStudies = await Study.countDocuments(query);

    res.json({
      studies: userStudies,
      totalPages: Math.ceil(totalStudies / limit),
      currentPage: page,
      totalStudies: totalStudies,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error fetching your studies",
        errorName: error.name,
        errorMessage: error.message,
      });
  }
});

router.get("/my-studies/:id", verifyFirebaseToken, async (req, res) => {
  const { id: studyId } = req.params;
  const researcher_id = req.user.uid;

  try {
    // Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(studyId)) {
      return res.status(400).json({ message: "Invalid study ID format." });
    }

    const study = await Study.findById(studyId).lean();

    // Case 1: Study with that ID doesn't exist
    if (!study) {
      return res.status(404).json({ message: "Study not found." });
    }

    // Case 2: Study exists, but it does not belong to the user
    if (study.researcher_id.toString() !== researcher_id) {
      return res
        .status(403)
        .json({ message: "Forbidden: You do not own this study." });
    }

    // Success: The user owns the study, return it
    res.json(study);
    
  } catch (error) {
    res.status(500).json({ message: "Error fetching your study." });
  }
});


module.exports = router;