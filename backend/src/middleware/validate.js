import { ApiError } from '../utils/ApiError.js'

// Parses req.body / req.query / req.params with a zod schema. Unknown keys are dropped,
// and the parsed result replaces the original so handlers only see clean data.
export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source] ?? {})
    if (!result.success) {
      const issue = result.error.issues[0]
      throw ApiError.badRequest(issue?.message ?? 'Invalid request.')
    }
    // req.query is a getter in Express 5, so keep parsed values on req.valid instead.
    req.valid = { ...req.valid, [source]: result.data }
    next()
  }
}
