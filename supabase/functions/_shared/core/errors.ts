export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = 'HttpError';
  }
}

export const createHttpError = (status: number, message: string, details?: unknown) =>
  new HttpError(status, message, details);

export const assertCondition = (condition: unknown, status: number, message: string) => {
  if (!condition) {
    throw createHttpError(status, message);
  }
};
