import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export interface FieldError {
  field: string;
  message: string;
}

/**
 * An API failure in a shape the UI can show directly. Built from the backend's
 * RFC 7807 Problem Details; `status` is 0 when the API could not be reached.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly fieldErrors: FieldError[] = [],
  ) {
    super(detail);
    this.name = 'ApiError';
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Field errors to show on the form: invalid input (400) or a taken unique value (409). */
  get isValidation(): boolean {
    return (this.status === 400 || this.status === 409) && this.fieldErrors.length > 0;
  }
}

export function toApiError(response: HttpErrorResponse): ApiError {
  if (response.status === 0) {
    return new ApiError(
      0,
      'API unreachable',
      'Cannot reach the RouteWise API. Check that it is running and try again.',
    );
  }
  const problem = isRecord(response.error) ? response.error : {};
  const title = typeof problem['title'] === 'string' ? problem['title'] : 'Request failed';
  const detail =
    typeof problem['detail'] === 'string'
      ? problem['detail']
      : `The request failed with status ${response.status}.`;
  return new ApiError(response.status, title, detail, toFieldErrors(problem['errors']));
}

/** Converts every failed HTTP call into an {@link ApiError}, so callers handle one error type. */
export const apiErrorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) =>
      throwError(() => (error instanceof HttpErrorResponse ? toApiError(error) : error)),
    ),
  );

function toFieldErrors(errors: unknown): FieldError[] {
  if (!Array.isArray(errors)) {
    return [];
  }
  return errors.filter(
    (error): error is FieldError =>
      isRecord(error) && typeof error['field'] === 'string' && typeof error['message'] === 'string',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
