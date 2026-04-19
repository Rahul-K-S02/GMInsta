const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();
const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".avif",
  ".heic",
  ".heif",
  ".tiff",
  ".tif",
  ".mp4",
  ".mov",
  ".webm",
  ".mkv",
  ".avi",
  ".m4v"
]);

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/") || allowedExtensions.has(extension)) {
    cb(null, true);
  } else {
    cb(new Error("Only image/video files are allowed"), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 60 * 1024 * 1024 }
});
