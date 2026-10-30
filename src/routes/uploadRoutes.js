import express from 'express';
import { uploadVideo } from '../controllers/uploadController.js';
import { uploadMiddleware } from '../middleware/uploadValidation.js';

const router = express.Router();

// POST /api/jobs - upload video & initialize job
router.post('/jobs', uploadMiddleware.single('video'), uploadVideo);

export default router;
