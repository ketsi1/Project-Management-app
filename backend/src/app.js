import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { router } from './routes/index.js'

export function createApp() {
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
