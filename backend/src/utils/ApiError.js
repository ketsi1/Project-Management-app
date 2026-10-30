// An error whose message is safe to show the user. The error handler turns it into
// `{ "message": "..." }` with the given HTTP status, which is what the frontend reads.
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }

  static badRequest(message) {
    return new ApiError(400, message)
  }

  static unauthorized(message = 'Please log in again.') {
    return new ApiError(401, message)
  }

  static forbidden(message = 'You do not have permission to do that.') {
    return new ApiError(403, message)
  }

  static notFound(message = 'Not found.') {
    return new ApiError(404, message)
  }

  static conflict(message) {
    return new ApiError(409, message)
  }
}
