import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getJobDir } from '../services/cleanupService.js';

const ALLOWED_EXTENSIONS = ['.mp4', '.mov', '.webm', '.mkv', '.avi', '.m4v'];
const ALLOWED_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
  'video/avi',
  'video/x-msvideo',
  'application/octet-stream' // some browsers send this for mov/mkv
];

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '500', 10);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Generate unique jobId before saving
    const jobId = 'job_' + uuidv4().replace(/-/g, '').slice(0, 12);
    req.generatedJobId = jobId;

    const jobDir = getJobDir(jobId);
    cb(null, jobDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Safe generated server-side filename (page 8 guideline)
    cb(null, `source_video${ext}`);
  }
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Unsupported file type: ${ext}. Supported formats: MP4, MOV, WebM, MKV`), false);
  }

  // Soft check for mime type
  if (file.mimetype && !ALLOWED_MIMES.includes(file.mimetype) && !file.mimetype.startsWith('video/')) {
    return cb(new Error(`Invalid MIME type: ${file.mimetype}. Expected a video file.`), false);
  }

  cb(null, true);
}

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_MB * 1024 * 1024 // 500 MB
  },
  fileFilter
});
