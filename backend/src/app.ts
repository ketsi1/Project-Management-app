import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'
import { env } from './config/env.ts'
import { errorHandler, notFound } from './middleware/errors.ts'
import { router } from './routes/index.ts'

export function createApp(): Express {
  const app = express()

  app.disable('x-powered-by')
  if (env.trustProxy) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.use('/api', router)

  app.use(notFound)
  app.use(errorHandler)
  return app
}
