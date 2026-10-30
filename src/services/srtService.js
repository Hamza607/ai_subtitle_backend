/**
 * SRT (SubRip) formatting and validation service
 * Implements HH:MM:SS,mmm timestamp formatting and UTF-8 SRT output
 */

/**
 * Format milliseconds into SRT timestamp: HH:MM:SS,mmm
 * @param {number} ms 
 * @returns {string}
 */
export function formatSrtTime(ms) {
  const safeMs = Math.max(0, Math.floor(ms || 0));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  const millis = safeMs % 1_000;

  const pad2 = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');

  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${pad3(millis)}`;
}

/**
 * Parse an SRT timestamp string (HH:MM:SS,mmm or HH:MM:SS.mmm) to milliseconds
 * @param {string} timeString 
 * @returns {number}
 */
export function parseSrtTime(timeString) {
  if (!timeString) return 0;
  const normalized = timeString.trim().replace('.', ',');
  const parts = normalized.split(':');
  if (parts.length < 3) return 0;

  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const [secondsStr, millisStr] = parts[2].split(',');
  const seconds = parseInt(secondsStr, 10) || 0;
  const millis = parseInt(millisStr || '0', 10) || 0;

  return hours * 3_600_000 + minutes * 60_000 + seconds * 1_000 + millis;
}

/**
 * Serialize subtitle segments into UTF-8 SRT text
 * @param {Array<{id: string, startMs: number, endMs: number, translatedText: string}>} segments 
 * @returns {string}
 */
export function toSrt(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return '';
  }

  return [...segments]
    .sort((a, b) => a.startMs - b.startMs)
    .map((segment, index) => {
      const startMs = Math.max(0, Number(segment.startMs) || 0);
      const endMs = Math.max(startMs + 500, Number(segment.endMs) || startMs + 1000);

      const text = (segment.translatedText || '').trim();

      return [
        String(index + 1),
        `${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}`,
        text || '...'
      ].join('\n');
    })
    .join('\n\n') + '\n';
}

/**
 * Serialize segments to WebVTT format (useful for HTML5 video <track>)
 * @param {Array<{id: string, startMs: number, endMs: number, translatedText: string}>} segments 
 * @returns {string}
 */
export function toVtt(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return 'WEBVTT\n\n';
  }

  const srtContent = toSrt(segments);
  // WebVTT uses '.' instead of ',' for milliseconds
  return 'WEBVTT\n\n' + srtContent.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

/**
 * Validate subtitle segments and detect timing warnings
 * @param {Array<any>} segments 
 * @returns {{ valid: boolean, warnings: Array<string>, errors: Array<string> }}
 */
export function validateSegments(segments) {
  const warnings = [];
  const errors = [];

  if (!Array.isArray(segments)) {
    return { valid: false, warnings, errors: ['Segments must be an array'] };
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const index = i + 1;

    if (typeof seg.startMs !== 'number' || seg.startMs < 0) {
      errors.push(`Segment #${index} (${seg.id}) has invalid start time (${seg.startMs}ms).`);
    }

    if (typeof seg.endMs !== 'number' || seg.endMs <= seg.startMs) {
      errors.push(`Segment #${index} (${seg.id}) end time must be greater than start time.`);
    }

    const durationSec = (seg.endMs - seg.startMs) / 1000;
    const textLen = (seg.translatedText || '').length;

    // Check reading speed: typical reading speed is 15-22 chars per second
    if (durationSec > 0 && textLen / durationSec > 30) {
      warnings.push(`Segment #${index} may be too short to read (${textLen} characters in ${durationSec.toFixed(1)}s).`);
    }

    // Check overlap with next segment
    if (i < segments.length - 1) {
      const nextSeg = segments[i + 1];
      if (seg.endMs > nextSeg.startMs) {
        warnings.push(`Segment #${index} (${formatSrtTime(seg.endMs)}) overlaps with Segment #${index + 1} (${formatSrtTime(nextSeg.startMs)}).`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors
  };
}
