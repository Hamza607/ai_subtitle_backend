import app from './app.js';
import dotenv from 'dotenv';
import { getFfmpegPath } from './services/mediaService.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Turkish-to-Urdu AI Subtitle Generator Backend`);
  console.log(`📡 Listening on: http://localhost:${PORT}`);
  console.log(`🎥 FFmpeg Engine: ${getFfmpegPath()}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});
