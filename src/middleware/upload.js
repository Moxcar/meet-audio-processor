const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { config } = require("../config");

// Configure multer for image file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../", config.upload.destination);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, config.upload.filenamePrefix + "-" + uniqueSuffix + ".jpg");
  },
});

// Configure multer for audio file uploads
const audioStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../../", config.audioUpload.destination);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".mp3";
    cb(null, config.audioUpload.filenamePrefix + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
  fileFilter: function (req, file, cb) {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG images are allowed"), false);
    }
  },
});

const audioUpload = multer({
  storage: audioStorage,
  limits: {
    fileSize: config.audioUpload.maxFileSize,
  },
  fileFilter: function (req, file, cb) {
    if (config.audioUpload.allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only MP3 audio files are allowed"), false);
    }
  },
});

module.exports = {
  upload,
  audioUpload
};


