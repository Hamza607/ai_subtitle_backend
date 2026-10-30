import express from 'express';
import { getSubtitles, saveSubtitles, exportSrt, exportVtt, exportJson } from '../controllers/subtitleController.js';

const router = express.Router();

router.get('/jobs/:jobId/subtitles', getSubtitles);
router.put('/jobs/:jobId/subtitles', saveSubtitles);
router.get('/jobs/:jobId/export.srt', exportSrt);
router.get('/jobs/:jobId/export.vtt', exportVtt);
router.get('/jobs/:jobId/export.json', exportJson);

export default router;
