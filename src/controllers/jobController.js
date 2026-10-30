import fs from 'fs';
import { getJob, jobsStore, executeVideoProcessing } from '../jobs/processVideoJob.js';
import { cleanupJobFiles } from '../services/cleanupService.js';

export function getJobStatus(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      message: `No processing job found with ID: ${jobId}`
    });
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    originalName: job.originalName,
    durationSeconds: job.durationSeconds,
    videoUrl: `/api/jobs/${job.jobId}/video`,
    validation: job.validation,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
}

export function listJobs(req, res) {
  // If memory store has fewer items, scan temp directory for existing projects
  try {
    const tempDir = './temp';
    if (fs.existsSync(tempDir)) {
      const dirs = fs.readdirSync(tempDir);
      for (const d of dirs) {
        if (!jobsStore.has(d)) {
          const metaPath = path.join(tempDir, d, 'job_meta.json');
          if (fs.existsSync(metaPath)) {
            try {
              const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
              jobsStore.set(d, data);
            } catch (e) {}
          }
        }
      }
    }
  } catch (err) {}

  const list = Array.from(jobsStore.values()).map(j => ({
    jobId: j.jobId,
    originalName: j.originalName,
    status: j.status,
    stage: j.stage,
    segmentsCount: j.segments ? j.segments.length : 0,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt
  }));

  res.json({ jobs: list });
}

export function deleteJob(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  cleanupJobFiles(jobId);
  jobsStore.delete(jobId);

  res.json({
    deleted: true,
    message: `Job ${jobId} and temporary media files deleted.`
  });
}

export function retryJob(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const clientApiKey = req.headers['x-api-key'] || req.body.apiKey;
  const clientProvider = req.headers['x-api-provider'] || req.body.provider;

  job.status = 'queued';
  job.stage = 'queued';
  job.progress = 5;
  job.error = null;
  job.message = 'Retrying processing job...';
  job.updatedAt = new Date().toISOString();

  executeVideoProcessing(jobId, {
    apiKey: clientApiKey,
    provider: clientProvider
  }).catch(err => {
    console.error(`[jobController] Error during retry of ${jobId}:`, err);
  });

  res.json({
    jobId: job.jobId,
    status: job.status,
    stage: job.stage,
    message: 'Job retry initiated.'
  });
}

export function streamJobVideo(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job || !job.videoFilePath) {
    return res.status(404).json({ error: 'Video file not found' });
  }

  const videoPath = job.videoFilePath;
  try {
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes'
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (err) {
    res.sendFile(videoPath);
  }
}
