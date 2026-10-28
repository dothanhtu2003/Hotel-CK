import { Catch, HttpException, HttpStatus, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    if (exception instanceof HttpException) {
      // Preserve intentional Nest HTTP errors, including health 503 and validation arrays.
      const body = exception.getResponse();
      response.status(exception.getStatus()).json(typeof body === 'string'
        ? { statusCode: exception.getStatus(), message: body, timestamp: new Date().toISOString() }
        : body);
      return;
    }
    // Unknown/Prisma errors can contain SQL, hosts, credentials or personal data.
    // Only log method + path (never query string, body, error.message or stack).
    this.logger.error(`Unhandled error: ${request.method} ${request.path}`);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
    });
  }
}
