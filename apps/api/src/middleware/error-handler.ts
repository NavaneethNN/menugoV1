import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message
      }))
    });
    return;
  }

  // Known AppError
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      message: err.message
    });
    return;
  }

  // CORS Origin Blocked error
  if (err.message && typeof err.message === 'string' && err.message.startsWith('CORS origin not allowed')) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Cross-origin request rejected'
    });
    return;
  }

  // Fallback 500 error: Sanitize error output in production to prevent information disclosure
  const isProduction = process.env.NODE_ENV === 'production';
  const publicErrorMessage = isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error';

  res.status(err.status || 500).json({
    error: publicErrorMessage,
    message: publicErrorMessage
  });
}

