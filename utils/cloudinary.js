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

const uploadBufferToCloudinary = ({ buffer, publicId, overwrite = false, invalidate = false }) =>
  new Promise((resolve, reject) => {
    ensureCloudinaryEnv();
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        public_id: publicId,
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

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  ensureCloudinaryEnv();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
};

module.exports = { uploadBufferToCloudinary, deleteFromCloudinary };
