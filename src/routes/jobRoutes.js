import express from 'express';
import { getJobStatus, listJobs, deleteJob, retryJob, streamJobVideo } from '../controllers/jobController.js';

const router = express.Router();

router.get('/jobs', listJobs);
router.get('/jobs/:jobId', getJobStatus);
router.delete('/jobs/:jobId', deleteJob);
router.post('/jobs/:jobId/retry', retryJob);
router.get('/jobs/:jobId/video', streamJobVideo);

export default router;
