import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import * as Sentry from "@sentry/node";
import { isSentryEnabled } from "./sentry";

/**
 * Reports every genuinely unexpected error (a non-HttpException, or an
 * HttpException at 5xx) to Sentry before falling back to Nest's normal
 * response formatting - a validation 400 or an auth 401/403 is expected
 * traffic, not an incident, so only 5xx and truly unhandled exceptions
 * are worth an alert (Task 8.5).
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (isSentryEnabled()) {
      const status =
        exception instanceof HttpException ? exception.getStatus() : 500;
      if (status >= 500) {
        Sentry.captureException(exception);
      }
    }
    super.catch(exception, host);
  }
}
