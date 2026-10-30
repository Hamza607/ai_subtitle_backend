import path from 'path';
import { getJob, updateJobSegments } from '../jobs/processVideoJob.js';
import { toSrt, toVtt } from '../services/srtService.js';

export function getSubtitles(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    jobId: job.jobId,
    status: job.status,
    stage: job.stage,
    segments: job.segments || [],
    validation: job.validation || { valid: true, warnings: [], errors: [] }
  });
}

export function saveSubtitles(req, res) {
  const { jobId } = req.params;
  const { segments } = req.body;

  if (!Array.isArray(segments)) {
    return res.status(400).json({ error: 'Invalid segments payload. Expected an array.' });
  }

  const updatedJob = updateJobSegments(jobId, segments);
  if (!updatedJob) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.json({
    saved: true,
    jobId: updatedJob.jobId,
    count: updatedJob.segments.length,
    validation: updatedJob.validation
  });
}

export function exportSrt(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const srtContent = toSrt(job.segments || []);
  const baseName = path.parse(job.originalName || 'subtitles').name;
  const downloadFileName = `${baseName}_urdu_subtitles.srt`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);
  // Include UTF-8 BOM so Windows Notepad and video players instantly recognize Urdu Nastaliq
  res.send('\uFEFF' + srtContent);
}

export function exportVtt(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const vttContent = toVtt(job.segments || []);
  const baseName = path.parse(job.originalName || 'subtitles').name;
  const downloadFileName = `${baseName}_urdu_subtitles.vtt`;

  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadFileName)}"`);
  res.send(vttContent);
}

export function exportJson(req, res) {
  const { jobId } = req.params;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const projectData = {
    version: '1.0',
    jobId: job.jobId,
    originalName: job.originalName,
    exportedAt: new Date().toISOString(),
    segments: job.segments || []
  };

  const baseName = path.parse(job.originalName || 'subtitles').name;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(baseName)}_project.json"`);
  res.json(projectData);
}
