import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { ApiError } from '../errors/ApiError';

export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/covers');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const uploader = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new ApiError('Cover image must be JPEG, PNG, or WebP', 'INVALID_FILE_TYPE', 400));
      return;
    }
    cb(null, true);
  },
}).single('cover');

/**
 * Wraps multer so its errors (bad file type, size limit) come out as the
 * `{ error: { message, code } }` shape instead of an unhandled MulterError.
 */
export const uploadCoverImage: RequestHandler = (req, res, next) => {
  uploader(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof MulterError) {
      next(new ApiError(err.message, 'INVALID_FILE_UPLOAD', 400));
      return;
    }
    next(err);
  });
};

// Kept in memory (not on disk like covers) — bulk-import parses it once and
// discards it, no need to persist the file itself.
const csvUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const looksLikeCsv =
      file.mimetype === 'text/csv' || file.originalname.toLowerCase().endsWith('.csv');
    if (!looksLikeCsv) {
      cb(new ApiError('File must be a CSV', 'INVALID_FILE_TYPE', 400));
      return;
    }
    cb(null, true);
  },
}).single('file');

export const uploadCsvFile: RequestHandler = (req, res, next) => {
  csvUploader(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof MulterError) {
      next(new ApiError(err.message, 'INVALID_FILE_UPLOAD', 400));
      return;
    }
    next(err);
  });
};
