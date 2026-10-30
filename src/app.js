import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRoutes from './routes/uploadRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import subtitleRoutes from './routes/subtitleRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { initTempDir, cleanupStaleTempFiles } from './services/cleanupService.js';

dotenv.config();

// Ensure temp storage directory exists
initTempDir();

// Run periodic cleanup every 60 minutes
setInterval(() => {
  cleanupStaleTempFiles();
}, 60 * 60 * 1000);

const app = express();

// CORS configuration
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl) or matching dev ports
    if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    if (origin === allowedOrigin) {
      return callback(null, true);
    }
    callback(null, true); // Dev-friendly permissive
  },
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint (Page 11 roadmap requirement)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'turkish-urdu-ai-backend',
    timestamp: new Date().toISOString()
  });
});

// Mount modular API routes
app.use('/api', uploadRoutes);
app.use('/api', jobRoutes);
app.use('/api', subtitleRoutes);

// Central error handler
app.use(errorHandler);

export default app;
