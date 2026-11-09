// An error whose message is safe to show the user. The error handler turns it into
// `{ "message": "..." }` with the given HTTP status, which is what the frontend reads.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, message)
  }

  static unauthorized(message = 'Please log in again.'): ApiError {
    return new ApiError(401, message)
  }

  static forbidden(message = 'You do not have permission to do that.'): ApiError {
    return new ApiError(403, message)
  }

  static notFound(message = 'Not found.'): ApiError {
    return new ApiError(404, message)
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message)
  }
}
