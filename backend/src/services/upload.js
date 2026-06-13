/**
 * src/services/upload.js
 * Local file upload service using multer.
 * Stores files under: backend/public/uploads/{avatars,products}
 * Serves them via Express static route at /uploads/...
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const UPLOAD_ROOT = path.join(__dirname, '../../public/uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const PRODUCT_DIR = path.join(UPLOAD_ROOT, 'products');

for (const dir of [UPLOAD_ROOT, AVATAR_DIR, PRODUCT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Avatar storage ──────────────────────────────────────────
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, _file, cb) => {
    // e.g. avatar-7-1718123456789.jpg
    const ext = path.extname(_file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

// ── Product image storage ───────────────────────────────────
const productImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUCT_DIR),
  filename: (req, _file, cb) => {
    const ext = path.extname(_file.originalname).toLowerCase() || '.jpg';
    cb(null, `product-${req.params.id}-${Date.now()}${ext}`);
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP and GIF images are allowed'), false);
  }
};

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_SIZE },
}).single('avatar');

const uploadProductImage = multer({
  storage: productImageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: MAX_SIZE },
}).single('image');

module.exports = { uploadAvatar, uploadProductImage, UPLOAD_ROOT };
