const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const UPLOAD_DIR = path.join(__dirname, "../uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer: store in memory for sharp processing ─────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
};

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 5;

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// ── Process & save uploaded image via sharp ──────────────────
const processAndSave = async (buffer, subfolder = "menu") => {
  const dir = path.join(UPLOAD_DIR, subfolder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `${uuidv4()}.webp`;
  const filepath = path.join(dir, filename);

  await sharp(buffer)
    .resize(600, 600, { fit: "cover", position: "center" })
    .webp({ quality: 82 })
    .toFile(filepath);

  // Return the public URL path
  return `/uploads/${subfolder}/${filename}`;
};

// ── Delete old image file ────────────────────────────────────
const deleteImage = (urlPath) => {
  if (!urlPath) return;
  const filepath = path.join(__dirname, "..", urlPath);
  if (fs.existsSync(filepath)) {
    fs.unlink(filepath, (err) => { if (err) console.error("Error deleting image:", err.message); });
  }
};

module.exports = { upload, processAndSave, deleteImage };
