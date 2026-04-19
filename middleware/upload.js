const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".avif", ".heic", ".heif", ".tiff", ".tif"]);

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || "").toLowerCase();
  if (file.mimetype.startsWith("image/") || allowedExtensions.has(extension)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }
});
