import { ErrorCode } from '../constants/error-codes';

export class AppException extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
