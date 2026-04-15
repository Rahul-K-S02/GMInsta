const cloudinary = require("../config/cloudinary");

const ensureCloudinaryEnv = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary env vars are missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.");
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
