import multer from 'multer';

export function errorHandler(err, req, res, next) {
  console.error('[errorHandler] Error encountered:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: `Maximum allowed upload size is ${process.env.MAX_UPLOAD_MB || 500}MB.`
      });
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred during processing.'
  });
}
