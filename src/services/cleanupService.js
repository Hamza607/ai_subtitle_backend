import fs from 'fs';
import path from 'path';

const TEMP_BASE_DIR = path.resolve(process.env.UPLOAD_DIR || './temp');

/**
 * Ensure base temp directory exists
 */
export function initTempDir() {
  if (!fs.existsSync(TEMP_BASE_DIR)) {
    fs.mkdirSync(TEMP_BASE_DIR, { recursive: true });
  }
  return TEMP_BASE_DIR;
}

/**
 * Get or create isolated temp directory for a specific job
 * @param {string} jobId 
 * @returns {string}
 */
export function getJobDir(jobId) {
  initTempDir();
  const jobDir = path.join(TEMP_BASE_DIR, jobId);
  if (!fs.existsSync(jobDir)) {
    fs.mkdirSync(jobDir, { recursive: true });
  }
  return jobDir;
}

/**
 * Delete a job's temp directory and all its files
 * @param {string} jobId 
 */
export function cleanupJobFiles(jobId) {
  try {
    const jobDir = path.join(TEMP_BASE_DIR, jobId);
    if (fs.existsSync(jobDir)) {
      fs.rmSync(jobDir, { recursive: true, force: true });
      console.log(`[cleanupService] Cleaned up job files for ${jobId}`);
    }
  } catch (err) {
    console.error(`[cleanupService] Error cleaning job ${jobId}:`, err.message);
  }
}

/**
 * Periodic cleanup of stale files older than maxAgeMs (default: 2 hours)
 */
export function cleanupStaleTempFiles(maxAgeMs = 2 * 60 * 60 * 1000) {
  try {
    initTempDir();
    const entries = fs.readdirSync(TEMP_BASE_DIR, { withFileTypes: true });
    const now = Date.now();

    for (const entry of entries) {
      const fullPath = path.join(TEMP_BASE_DIR, entry.name);
      try {
        const stats = fs.statSync(fullPath);
        if (now - stats.mtimeMs > maxAgeMs) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`[cleanupService] Removed stale directory/file: ${entry.name}`);
        }
      } catch (e) {
        // Ignore single file stat error
      }
    }
  } catch (err) {
    console.error('[cleanupService] Error in stale cleanup:', err.message);
  }
}
