import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.path}.`))
}

// Every error leaves the API as { "message": "..." } — the shape httpApi.ts reads.
// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  let status = 500
  let message = 'Something went wrong. Please try again.'

  if (error instanceof ApiError) {
    status = error.status
    message = error.message
  } else if (error?.type === 'entity.parse.failed') {
    status = 400
    message = 'The request body is not valid JSON.'
  } else if (error?.type === 'entity.too.large') {
    status = 413
    message = 'The request body is too large.'
  } else if (error?.code === 'ER_DUP_ENTRY') {
    status = 409
    message = 'That already exists.'
  } else if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_NO_REFERENCED_ROW_2') {
    status = 409
    message = 'That change conflicts with other data.'
  }

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error)
  }

  const body = { message }
  if (!env.isProduction && status >= 500 && error?.message) body.detail = error.message
  res.status(status).json(body)
}
