import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export class CatalogError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);
  catch(error: unknown, host: ArgumentsHost): void {
    const requestId = randomUUID();
    const status =
      error instanceof CatalogError
        ? error.status
        : error instanceof HttpException
          ? error.getStatus()
          : 500;
    const code =
      error instanceof CatalogError
        ? error.code
        : status === 404
          ? 'NOT_FOUND'
          : 'SERVICE_UNAVAILABLE';
    const message =
      error instanceof CatalogError
        ? error.message
        : status === 404
          ? 'Recurso não encontrado.'
          : 'Serviço temporariamente indisponível.';
    if (status >= 500) this.logger.warn({ requestId, status, code });
    host
      .switchToHttp()
      .getResponse<{
        status: (status: number) => { json: (body: unknown) => void };
      }>()
      .status(status)
      .json({ code, message, requestId });
  }
}
