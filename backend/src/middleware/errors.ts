import type { ErrorRequestHandler, RequestHandler } from 'express'
import { env } from '../config/env.ts'
import { ApiError } from '../utils/ApiError.ts'

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}.`))
}

// The fields we look at on errors thrown by Express's body parser and the database driver.
interface ErrorInfo {
  type?: unknown
  code?: unknown
  message?: unknown
}

// Every error leaves the API as { "message": "..." } — the shape httpApi.ts reads.
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const info: ErrorInfo = typeof error === 'object' && error !== null ? error : {}
  let status = 500
  let message = 'Something went wrong. Please try again.'

  if (error instanceof ApiError) {
    status = error.status
    message = error.message
  } else if (info.type === 'entity.parse.failed') {
    status = 400
    message = 'The request body is not valid JSON.'
  } else if (info.type === 'entity.too.large') {
    status = 413
    message = 'The request body is too large.'
  } else if (info.code === 'ER_DUP_ENTRY') {
    status = 409
    message = 'That already exists.'
  } else if (info.code === 'ER_ROW_IS_REFERENCED_2' || info.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 409
    message = 'That change conflicts with other data.'
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error)
  }

  const body: { message: string; detail?: string } = { message }
  if (!env.isProduction && status >= 500 && typeof info.message === 'string' && info.message) body.detail = info.message
  res.status(status).json(body)
}
