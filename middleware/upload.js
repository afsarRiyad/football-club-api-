const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const AppError = require("../utils/AppError");

// Use memory storage — files are streamed to Cloudinary, never saved to disk
const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
];

const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

// File filter
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        `Invalid file type: ${file.mimetype}. Allowed: images (JPEG, PNG, GIF, WebP, SVG) and videos (MP4, MPEG, MOV, WebM).`,
        400
      ),
      false
    );
  }
};

// Multer upload instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
  },
});

/**
 * Upload a single file to Cloudinary.
 * Expects `req.file` from multer middleware.
 * Attaches result to `req.uploadedFile`.
 */
const uploadToCloudinary = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const isVideo = req.file.mimetype.startsWith("video/");
    const resourceType = isVideo ? "video" : "image";

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: process.env.CLOUDINARY_FOLDER || "fclub",
          resource_type: resourceType,
          public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
          transformation: isVideo
            ? undefined
            : [{ quality: "auto", fetch_format: "auto" }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    req.uploadedFile = {
      url: result.secure_url,
      publicId: result.public_id,
      type: isVideo ? "VIDEO" : "IMAGE",
      format: result.format,
      bytes: result.bytes,
      width: result.width || null,
      height: result.height || null,
      duration: result.duration || null,
    };

    next();
  } catch (error) {
    return next(new AppError(`Upload failed: ${error.message}`, 500));
  }
};

/**
 * Upload multiple files to Cloudinary.
 * Expects `req.files` from multer middleware.
 * Attaches results array to `req.uploadedFiles`.
 */
const uploadMultipleToCloudinary = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  try {
    const uploads = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        const isVideo = file.mimetype.startsWith("video/");
        const resourceType = isVideo ? "video" : "image";

        const stream = cloudinary.uploader.upload_stream(
          {
            folder: process.env.CLOUDINARY_FOLDER || "fclub",
            resource_type: resourceType,
            public_id: `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
            transformation: isVideo
              ? undefined
              : [{ quality: "auto", fetch_format: "auto" }],
          },
          (error, result) => {
            if (error) return reject(error);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
              type: isVideo ? "VIDEO" : "IMAGE",
              format: result.format,
              bytes: result.bytes,
              width: result.width || null,
              height: result.height || null,
              duration: result.duration || null,
              originalName: file.originalname,
            });
          }
        );
        stream.end(file.buffer);
      });
    });

    req.uploadedFiles = await Promise.all(uploads);
    next();
  } catch (error) {
    return next(new AppError(`Upload failed: ${error.message}`, 500));
  }
};

/**
 * Delete a file from Cloudinary by public ID.
 */
const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return true;
  } catch (error) {
    console.error("Cloudinary delete error:", error.message);
    return false;
  }
};

module.exports = {
  upload,
  uploadToCloudinary,
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
};
