const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Study = require("../models/study");
const { verifyFirebaseToken } = require("../middleware/auth");

const router = express.Router();

const documentsDir = path.join(__dirname, "..", "documents");
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/\.\.+/g, ".");
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, documentsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const tempFilename =
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
    cb(null, tempFilename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    cb(null, true);
  },
});

router.get("/", async (req, res) => {
  try {
    const { genre, title, page = 1, limit = 10 } = req.query;
    const queryOptions = {};

    queryOptions.approved = true;

    if (genre) {
      if (Array.isArray(genre)) {
        queryOptions.genres = { $in: genre.map((g) => new RegExp(g, "i")) };
      } else {
        queryOptions.genres = { $in: [new RegExp(genre, "i")] };
      }
    }
    if (title) {
      queryOptions.title = { $regex: title, $options: "i" };
    }

    const studies = await Study.find(queryOptions)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ created_at: -1 })
      .lean();

    const count = await Study.countDocuments(queryOptions);

    res.json({
      studies,
      totalPages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      totalStudies: count,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching studies", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  const studyId = req.params.id;
  try {
    if (!mongoose.Types.ObjectId.isValid(studyId)) {
      return res.status(400).json({ message: "Invalid study ID format" });
    }
    const study = await Study.findById(studyId).lean();
    if (!study) {
      return res.status(404).json({ message: "Study not found" });
    }
    res.json(study);
  } catch (error) {
    if (error.name === "CastError" && error.kind === "ObjectId") {
      return res
        .status(400)
        .json({ message: "Invalid study ID format (CastError)" });
    }
    res
      .status(500)
      .json({ message: "Error fetching study", error: error.message });
  }
});

router.post(
  "/",
  verifyFirebaseToken,
  upload.array("study_document_files", 5),
  async (req, res) => {
    const researcher_id = req.user.uid;
    try {
      const { title, abstract, brief_description, patent_status } = req.body;

      if (!title || !abstract || !brief_description) {
        if (req.files)
          req.files.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Error cleaning up file ${file.path}:`, e);
            }
          });
        return res.status(400).json({
          message: "Title, abstract, and brief description are required.",
        });
      }

      let parsedDocumentsMetadata = [];
      if (req.body.documents_metadata) {
        try {
          parsedDocumentsMetadata = JSON.parse(req.body.documents_metadata);
        } catch (parseError) {
          if (req.files)
            req.files.forEach((file) => {
              try {
                fs.unlinkSync(file.path);
              } catch (e) {
                console.error(`Error cleaning up file ${file.path}:`, e);
              }
            });
          return res
            .status(400)
            .json({ message: "Invalid documents_metadata format." });
        }
      }

      const processedDbDocuments = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const metadata = parsedDocumentsMetadata[i] || {};
          const displayName = metadata.display_name || file.originalname;
          const originalExtension = path.extname(file.originalname);
          const sanitizedBaseName = sanitizeFilename(
            path.parse(displayName).name || `document_${Date.now()}`
          );
          const newFilename = sanitizedBaseName + originalExtension;
          const finalPath = path.join(documentsDir, newFilename);
          const relativePath = path.join("documents", newFilename);
          try {
            fs.renameSync(file.path, finalPath);
            processedDbDocuments.push({
              display_name: displayName,
              file_location: relativePath,
            });
          } catch (renameError) {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Error cleaning up file ${file.path}:`, e);
            }
          }
        }
      } else if (parsedDocumentsMetadata.length > 0 && !req.files) {
        parsedDocumentsMetadata.forEach((metaDoc) => {
          if (metaDoc.file_location) {
            processedDbDocuments.push({
              display_name: metaDoc.display_name || "Untitled Document",
              file_location: metaDoc.file_location,
            });
          }
        });
      }

      let genres = [];
      if (req.body.genres) {
        try {
          genres =
            typeof req.body.genres === "string"
              ? JSON.parse(req.body.genres)
              : req.body.genres;
        } catch (e) {
          genres = [req.body.genres];
        }
      }
      let questions = [];
      if (req.body.questions) {
        try {
          questions =
            typeof req.body.questions === "string"
              ? JSON.parse(req.body.questions)
              : req.body.questions;
        } catch (e) {
          questions = [];
        }
      }
      let additional_info = {};
      if (req.body.additional_info) {
        try {
          additional_info =
            typeof req.body.additional_info === "string"
              ? JSON.parse(req.body.additional_info)
              : req.body.additional_info;
        } catch (e) {
          additional_info = {};
        }
      }

      const studyToCreate = {
        researcher_id,
        title,
        abstract,
        brief_description,
        genres: Array.isArray(genres) ? genres : genres ? [genres] : [],
        documents: processedDbDocuments,
        patent_status: patent_status || null,
        questions: Array.isArray(questions) ? questions : [],
        additional_info:
          typeof additional_info === "object" && additional_info !== null
            ? additional_info
            : {},
      };

      const newStudy = new Study(studyToCreate);
      const savedStudy = await newStudy.save();
      res.status(201).json(savedStudy);
    } catch (error) {
      if (req.files)
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error(`Error cleaning up file ${file.path}:`, e);
          }
        });
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
        }));
        return res
          .status(400)
          .json({ message: "Validation Error", errors: errors });
      }
      res.status(500).json({
        message: "Server error while creating study",
        errorName: error.name,
        errorMessage: error.message,
      });
    }
  }
);

router.put(
  "/:id",
  verifyFirebaseToken,
  upload.array("study_document_files", 5),
  async (req, res) => {
    const studyId = req.params.id;
    const researcher_id = req.user.uid;

    try {
      const study = await Study.findById(studyId);
      if (!study) {
        if (req.files)
          req.files.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Error cleaning up file ${file.path}:`, e);
            }
          });
        return res.status(404).json({ message: "Study not found" });
      }
      if (study.researcher_id.toString() !== researcher_id) {
        if (req.files)
          req.files.forEach((file) => {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Error cleaning up file ${file.path}:`, e);
            }
          });
        return res
          .status(403)
          .json({ message: "User not authorized to update this study" });
      }

      let keptDocumentsMetadata = [];
      if (req.body.kept_documents_metadata) {
        try {
          keptDocumentsMetadata = JSON.parse(req.body.kept_documents_metadata);
        } catch (e) {
          return res
            .status(400)
            .json({ message: "Invalid format for kept_documents_metadata." });
        }
      }

      let deletedDocumentLocations = [];
      if (req.body.deleted_documents_locations) {
        try {
          deletedDocumentLocations = JSON.parse(
            req.body.deleted_documents_locations
          );
        } catch (e) {
          return res.status(400).json({
            message: "Invalid format for deleted_documents_locations.",
          });
        }
      }

      let newDocumentsMetadata = [];
      if (req.body.new_documents_metadata) {
        try {
          newDocumentsMetadata = JSON.parse(req.body.new_documents_metadata);
        } catch (e) {
          return res
            .status(400)
            .json({ message: "Invalid format for new_documents_metadata." });
        }
      }

      for (const locationToDelete of deletedDocumentLocations) {
        if (
          locationToDelete &&
          typeof locationToDelete === "string" &&
          !locationToDelete.startsWith("http")
        ) {
          const filePath = path.join(__dirname, "..", locationToDelete);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              console.warn(`Failed to delete file: ${filePath}`, e);
            }
          }
        }
      }

      const finalDocumentsArray = [];
      keptDocumentsMetadata.forEach((keptDoc) => {
        if (keptDoc.file_location && keptDoc.display_name) {
          finalDocumentsArray.push({
            display_name: keptDoc.display_name,
            file_location: keptDoc.file_location,
            uploaded_at:
              study.documents.find(
                (d) => d.file_location === keptDoc.file_location
              )?.uploaded_at || new Date(),
          });
        }
      });

      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const metadata = newDocumentsMetadata[i] || {};
          const displayName = metadata.display_name || file.originalname;

          const originalExtension = path.extname(file.originalname);
          const sanitizedBaseName = sanitizeFilename(
            path.parse(displayName).name || `document_${Date.now()}`
          );
          const newFilename = sanitizedBaseName + originalExtension;
          const finalPathOnServer = path.join(documentsDir, newFilename);
          const relativePathForDB = path.join("documents", newFilename);

          try {
            fs.renameSync(file.path, finalPathOnServer);
            finalDocumentsArray.push({
              display_name: displayName,
              file_location: relativePathForDB,
            });
          } catch (renameError) {
            console.warn(
              `Failed to rename/move uploaded file: ${file.originalname}`,
              renameError
            );
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Error cleaning up temp file ${file.path}:`, e);
            }
          }
        }
      }

      if (finalDocumentsArray.length > 5) {
        if (req.files)
          req.files.forEach((file) => {
            const finalPathAttempt = path.join(documentsDir, file.filename);
            if (fs.existsSync(finalPathAttempt)) {
              try {
                fs.unlinkSync(finalPathAttempt);
              } catch (e) {
                console.error(
                  `Error rolling back file ${finalPathAttempt}:`,
                  e
                );
              }
            }
          });
        return res
          .status(400)
          .json({ message: "Cannot exceed 5 documents in total." });
      }
      study.documents = finalDocumentsArray;

      study.title = req.body.title || study.title;
      study.abstract = req.body.abstract || study.abstract;
      study.brief_description =
        req.body.brief_description || study.brief_description;
      study.patent_status =
        req.body.patent_status !== undefined
          ? req.body.patent_status || null
          : study.patent_status;

      if (req.body.genres) {
        try {
          study.genres =
            typeof req.body.genres === "string"
              ? JSON.parse(req.body.genres)
              : req.body.genres;
        } catch (e) {
          console.warn(`Failed to parse genres for update, keeping old.`);
        }
      }
      if (req.body.questions) {
        try {
          study.questions =
            typeof req.body.questions === "string"
              ? JSON.parse(req.body.questions)
              : req.body.questions;
        } catch (e) {
          console.warn(`Failed to parse questions for update, keeping old.`);
        }
      }
      if (req.body.additional_info) {
        try {
          study.additional_info =
            typeof req.body.additional_info === "string"
              ? JSON.parse(req.body.additional_info)
              : req.body.additional_info;
        } catch (e) {
          console.warn(
            `Failed to parse additional_info for update, keeping old.`
          );
        }
      }

      const updatedStudy = await study.save();
      res.json(updatedStudy);
    } catch (error) {
      if (req.files) {
        req.files.forEach((file) => {
          try {
            fs.unlinkSync(file.path);
          } catch (e) {
            console.error(`Error cleaning up file ${file.path}:`, e);
          }
        });
      }
      if (error.name === "ValidationError") {
        const errors = Object.values(error.errors).map((err) => ({
          field: err.path,
          message: err.message,
        }));
        return res
          .status(400)
          .json({ message: "Validation Error during update", errors });
      }
      if (error.name === "CastError" && error.kind === "ObjectId")
        return res
          .status(400)
          .json({ message: "Invalid study ID format (CastError)" });
      res.status(500).json({
        message: "Error updating study",
        errorName: error.name,
        errorMessage: error.message,
      });
    }
  }
);

router.delete("/:id", verifyFirebaseToken, async (req, res) => {
  const studyId = req.params.id;
  const userIdToken = req.user.uid;

  try {
    if (!mongoose.Types.ObjectId.isValid(studyId)) {
      return res.status(400).json({ message: "Invalid study ID format" });
    }

    const study = await Study.findById(studyId);
    if (!study) {
      return res.status(404).json({ message: "Study not found" });
    }
    if (study.researcher_id.toString() !== userIdToken) {
      return res
        .status(403)
        .json({ message: "User not authorized to delete this study" });
    }

    if (study.documents && study.documents.length > 0) {
      study.documents.forEach((doc) => {
        if (doc.file_location && !doc.file_location.startsWith("http")) {
          const filePath = path.join(__dirname, "..", doc.file_location);
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch (fileError) {
            console.warn(`Error deleting file ${filePath}`, fileError);
          }
        }
      });
    }

    const result = await Study.findByIdAndDelete(studyId);
    if (!result) {
      return res.status(404).json({ message: "Study not found for deletion." });
    }
    res.json({ message: "Study deleted successfully" });
  } catch (error) {
    if (error.name === "CastError" && error.kind === "ObjectId")
      return res
        .status(400)
        .json({ message: "Invalid study ID format (CastError)" });
    res
      .status(500)
      .json({ message: "Error deleting study", error: error.message });
  }
});

module.exports = router;
