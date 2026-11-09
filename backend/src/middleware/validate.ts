import type { Request, RequestHandler } from 'express'
import type { z } from 'zod'
import { ApiError } from '../utils/ApiError.ts'

type Source = 'body' | 'query' | 'params'

// Parses req.body / req.query / req.params with a zod schema. Unknown keys are dropped,
// and the parsed result replaces the original so handlers only see clean data.
export function validate(schema: z.ZodType, source: Source = 'body'): RequestHandler {
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

// The data `validate(schema, source)` parsed for this request, typed from the same schema.
// Pass the schema the route used: validated(req, schemas.loginSchema) → { email, password }.
export function validated<S extends z.ZodType>(req: Request, _schema: S, source: Source = 'body'): z.output<S> {
  const value = req.valid?.[source]
  if (value === undefined) throw new Error(`validate(..., '${source}') is missing on ${req.method} ${req.path}`)
  return value as z.output<S>
}

// A route parameter such as :id. Express types allow string[] (for wildcards); our routes never use them.
export function param(req: Request, name: string): string {
  const value = req.params[name]
  if (typeof value !== 'string' || value === '') throw ApiError.badRequest(`Missing ${name} in the address.`)
  return value
}
