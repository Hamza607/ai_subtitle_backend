import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

// Get ffmpeg binary path
export function getFfmpegPath() {
  if (ffmpegInstaller && ffmpegInstaller.path && fs.existsSync(ffmpegInstaller.path)) {
    return ffmpegInstaller.path;
  }
  return 'ffmpeg';
}

/**
 * Run ffmpeg with argument array (safe from shell injection)
 * @param {string[]} args 
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
export function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = getFfmpegPath();
    const child = spawn(ffmpegPath, args);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        // Many ffmpeg probe commands exit with 0 or print info to stderr
        resolve({ stdout, stderr, exitCode: code });
      }
    });
  });
}

/**
 * Inspect video duration and stream info using ffmpeg probe
 * @param {string} videoPath 
 * @returns {Promise<{ durationSeconds: number, hasAudio: boolean, format: string }>}
 */
export async function probeVideo(videoPath) {
  try {
    const { stderr } = await runFfmpeg(['-i', videoPath]);

    // Parse Duration: 00:01:23.45,
    let durationSeconds = 0;
    const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (durationMatch) {
      const hours = parseFloat(durationMatch[1]);
      const minutes = parseFloat(durationMatch[2]);
      const seconds = parseFloat(durationMatch[3]);
      durationSeconds = hours * 3600 + minutes * 60 + seconds;
    }

    const hasAudio = /Stream.*Audio:/.test(stderr);
    const formatMatch = stderr.match(/Input #0,\s*([^,]+)/);
    const format = formatMatch ? formatMatch[1].trim() : 'unknown';

    return {
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      hasAudio,
      format
    };
  } catch (error) {
    console.warn('[mediaService] probe warning:', error.message);
    return {
      durationSeconds: 60,
      hasAudio: true,
      format: 'mp4'
    };
  }
}

/**
 * Extract audio from video file to mono 16kHz WAV
 * @param {string} videoPath 
 * @param {string} outputAudioPath 
 * @returns {Promise<string>}
 */
export async function extractAudio(videoPath, outputAudioPath) {
  // Ensure output directory exists
  const dir = path.dirname(outputAudioPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Example from doc Page 8:
  // ffmpeg -i input-video.mp4 -vn -ac 1 -ar 16000 -c:a pcm_s16le output-audio.wav
  const args = [
    '-y',                     // overwrite
    '-i', videoPath,          // input
    '-vn',                    // no video
    '-ac', '1',               // mono channel
    '-ar', '16000',           // 16 kHz sample rate
    '-c:a', 'pcm_s16le',      // 16-bit PCM WAV
    outputAudioPath
  ];

  const result = await runFfmpeg(args);

  if (!fs.existsSync(outputAudioPath)) {
    // If WAV failed, try MP3 fallback
    console.warn('[mediaService] WAV extraction had issue, attempting MP3 fallback...');
    const mp3Path = outputAudioPath.replace(/\.wav$/i, '.mp3');
    await runFfmpeg(['-y', '-i', videoPath, '-vn', '-ar', '16000', '-ac', '1', '-b:a', '128k', mp3Path]);
    if (fs.existsSync(mp3Path)) {
      return mp3Path;
    }
    throw new Error(`FFmpeg failed to extract audio: ${result.stderr.slice(-300)}`);
  }

  return outputAudioPath;
}
