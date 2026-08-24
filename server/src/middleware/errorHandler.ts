import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({
      success: false,
      error: `Validation error: ${details}`,
      code: 'VALIDATION_ERROR',
    });
  }

  // Prisma unique constraint violation
  if ((err as any).code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'A record with this data already exists.',
      code: 'CONFLICT',
    });
  }

  // Prisma not found
  if ((err as any).code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Record not found.',
      code: 'NOT_FOUND',
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
