const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.dwdgoitzv,
  api_key:    process.env.469239145564615,
  api_secret: process.env.3FbMYEjaskNDzA1lD_qvCRYzN88,
});

// Storage — images go directly to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chownow/menu",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 600, height: 600, crop: "fill", quality: 82 }],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 5) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only JPEG, PNG and WebP images are allowed"), false);
  },
});

// processAndSave is no longer needed — Cloudinary handles it
// But we keep the signature so routes don't need to change
const processAndSave = async (buffer, subfolder = "menu") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `chownow/${subfolder}`, transformation: [{ width: 600, height: 600, crop: "fill", quality: 82 }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

const deleteImage = async (urlOrPublicId) => {
  if (!urlOrPublicId) return;
  try {
    // Extract public_id from Cloudinary URL
    const parts = urlOrPublicId.split("/");
    const filename = parts[parts.length - 1].split(".")[0];
    const folder = parts[parts.length - 2];
    await cloudinary.uploader.destroy(`${folder}/${filename}`);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

module.exports = { upload, processAndSave, deleteImage };