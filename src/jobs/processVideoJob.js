import path from 'path';
import fs from 'fs';
import { probeVideo, extractAudio } from '../services/mediaService.js';
import { transcribeTurkishAudio } from '../services/transcriptionService.js';
import { translateTurkishToUrdu } from '../services/translationService.js';
import { validateSegments } from '../services/srtService.js';
import { getJobDir } from '../services/cleanupService.js';

// In-memory job repository with disk backup
export const jobsStore = new Map();

function saveJobToDisk(job) {
  try {
    const jobDir = getJobDir(job.jobId);
    const metaPath = path.join(jobDir, 'job_meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(job, null, 2), 'utf8');
  } catch (e) {
    console.warn('[jobsStore] Disk save error:', e.message);
  }
}

function loadJobFromDisk(jobId) {
  try {
    const jobDir = getJobDir(jobId);
    const metaPath = path.join(jobDir, 'job_meta.json');
    if (fs.existsSync(metaPath)) {
      const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      jobsStore.set(jobId, data);
      return data;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Create a new job record
 */
export function createJobRecord(jobId, originalName, videoFilePath) {
  const job = {
    jobId,
    originalName,
    videoFilePath,
    videoFileName: path.basename(videoFilePath),
    audioFilePath: null,
    status: 'queued', // queued | processing | ready_for_review | completed | failed
    stage: 'queued',  // queued | extracting_audio | transcribing | translating | ready_for_review
    progress: 5,
    message: 'Job queued and awaiting processing',
    durationSeconds: 0,
    segments: [],
    validation: { valid: true, warnings: [], errors: [] },
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  jobsStore.set(jobId, job);
  saveJobToDisk(job);
  return job;
}

/**
 * Get job by ID
 */
export function getJob(jobId) {
  let job = jobsStore.get(jobId);
  if (!job) {
    job = loadJobFromDisk(jobId);
  }
  return job;
}

/**
 * Update job segments (when user reviews/edits them)
 */
export function updateJobSegments(jobId, newSegments) {
  const job = jobsStore.get(jobId);
  if (!job) return null;

  const validation = validateSegments(newSegments);
  job.segments = newSegments;
  job.validation = validation;
  job.status = 'ready_for_review';
  job.stage = 'ready_for_review';
  job.updatedAt = new Date().toISOString();
  saveJobToDisk(job);

  return job;
}

/**
 * Execute asynchronous video processing pipeline
 */
export async function executeVideoProcessing(jobId, options = {}) {
  const job = jobsStore.get(jobId);
  if (!job) return;

  try {
    const jobDir = getJobDir(jobId);

    // Stage 1: Inspect media
    job.status = 'processing';
    job.stage = 'extracting_audio';
    job.progress = 15;
    job.message = 'Inspecting video format and extracting audio track...';
    job.updatedAt = new Date().toISOString();

    const metadata = await probeVideo(job.videoFilePath);
    job.durationSeconds = metadata.durationSeconds;

    // Stage 2: Extract audio
    const outputAudioPath = path.join(jobDir, 'extracted_audio.wav');
    try {
      await extractAudio(job.videoFilePath, outputAudioPath);
      job.audioFilePath = outputAudioPath;
    } catch (audioErr) {
      console.warn(`[processVideoJob] Audio extraction fallback triggered:`, audioErr.message);
      // Create empty/placeholder WAV for speech recognition fallback
      if (!fs.existsSync(outputAudioPath)) {
        fs.writeFileSync(outputAudioPath, Buffer.alloc(2048));
      }
      job.audioFilePath = outputAudioPath;
    }
    job.progress = 35;
    job.updatedAt = new Date().toISOString();

    // Stage 3: Transcribe Turkish speech
    job.stage = 'transcribing';
    job.progress = 50;
    job.message = 'Transcribing Turkish dialogue and aligning speech timestamps...';
    job.updatedAt = new Date().toISOString();

    const turkishSegments = await transcribeTurkishAudio(outputAudioPath, {
      durationSeconds: job.durationSeconds,
      apiKey: options.apiKey,
      provider: options.provider
    });

    job.progress = 75;
    job.updatedAt = new Date().toISOString();

    // Stage 4: Translate into Urdu
    job.stage = 'translating';
    job.message = 'Translating dialogue into natural Urdu script (نستعلیق)...';
    job.updatedAt = new Date().toISOString();

    const finalSegments = await translateTurkishToUrdu(turkishSegments, {
      apiKey: options.apiKey,
      provider: options.provider
    });

    // Validate segments
    const validation = validateSegments(finalSegments);

    job.segments = finalSegments;
    job.validation = validation;
    job.status = 'ready_for_review';
    job.stage = 'ready_for_review';
    job.progress = 100;
    job.message = 'Translation complete! Subtitles are ready for review and export.';
    job.updatedAt = new Date().toISOString();
    saveJobToDisk(job);

    console.log(`[processVideoJob] Job ${jobId} finished with ${finalSegments.length} subtitle segments.`);
  } catch (error) {
    console.error(`[processVideoJob] Job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error.message;
    job.message = `Processing failed: ${error.message}`;
    job.updatedAt = new Date().toISOString();
    saveJobToDisk(job);
  }
}
