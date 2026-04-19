require("dotenv").config();
const cloudinary = require("../config/cloudinary");

const isPlaceholderValue = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return !normalized || normalized.startsWith("your_");
};

const ensureCloudinaryEnv = () => {
  if (
    isPlaceholderValue(process.env.CLOUDINARY_CLOUD_NAME) ||
    isPlaceholderValue(process.env.CLOUDINARY_API_KEY) ||
    isPlaceholderValue(process.env.CLOUDINARY_API_SECRET)
  ) {
    throw new Error(
      "Cloudinary is not configured. Replace CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env with your real Cloudinary dashboard values."
    );
  }
};

const uploadBufferToCloudinary = ({
  buffer,
  publicId,
  overwrite = false,
  invalidate = false,
  resourceType = "image"
}) =>
  new Promise((resolve, reject) => {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return reject(new Error("Missing image buffer for Cloudinary upload."));
    }
    if (!publicId || typeof publicId !== "string") {
      return reject(new Error("Missing publicId for Cloudinary upload."));
    }

    ensureCloudinaryEnv();
    const normalizedPublicId = publicId.replace(/^\/+/, "");
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        public_id: normalizedPublicId,
        use_filename: false,
        unique_filename: false,
        overwrite,
        invalidate
      },
      (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      }
    );
    uploadStream.end(buffer);
  });

const buildOptimizedAssetUrl = ({ publicId, fallbackUrl, resourceType = "image" }) => {
  if (publicId) {
    try {
      ensureCloudinaryEnv();
      return cloudinary.url(publicId, {
        secure: true,
        resource_type: resourceType,
        fetch_format: "auto",
        quality: "auto"
      });
    } catch (error) {
      return fallbackUrl || "/public/images/default-avatar.svg";
    }
  }

  return fallbackUrl || "/public/images/default-avatar.svg";
};

const buildOptimizedImageUrl = ({ publicId, fallbackUrl }) =>
  buildOptimizedAssetUrl({ publicId, fallbackUrl, resourceType: "image" });

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  if (!publicId) return;
  ensureCloudinaryEnv();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
};

const getCloudinaryResource = async (publicId, resourceType = "image") => {
  if (!publicId) throw new Error("Missing publicId for Cloudinary lookup.");
  ensureCloudinaryEnv();
  return cloudinary.api.resource(publicId, { resource_type: resourceType });
};

module.exports = {
  uploadBufferToCloudinary,
  buildOptimizedAssetUrl,
  buildOptimizedImageUrl,
  deleteFromCloudinary,
  getCloudinaryResource
};
