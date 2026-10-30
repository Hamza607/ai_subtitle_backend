import { createJobRecord, executeVideoProcessing } from '../jobs/processVideoJob.js';

export async function uploadVideo(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please choose a valid video file (MP4, MOV, WebM, MKV).'
      });
    }

    const jobId = req.generatedJobId;
    const originalName = req.file.originalname;
    const videoFilePath = req.file.path;

    // Optional user API key provided from frontend modal/header
    const clientApiKey = req.headers['x-api-key'] || req.body.apiKey;
    const clientProvider = req.headers['x-api-provider'] || req.body.provider;

    // Create job record
    const job = createJobRecord(jobId, originalName, videoFilePath);

    // Launch background asynchronous pipeline
    executeVideoProcessing(jobId, {
      apiKey: clientApiKey,
      provider: clientProvider
    }).catch(err => {
      console.error(`[uploadController] Unhandled error in background job ${jobId}:`, err);
    });

    // Return immediate response with jobId per page 7 architecture
    res.status(201).json({
      jobId: job.jobId,
      status: job.status,
      stage: job.stage,
      message: 'Video uploaded successfully. Processing started.',
      originalName: job.originalName
    });
  } catch (error) {
    next(error);
  }
}
