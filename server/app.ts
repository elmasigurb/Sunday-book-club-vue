import cors from 'cors'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import helmet from 'helmet'
import { accountRouter } from './routes/account.js'
import { config } from './config.js'
import { pool } from './db.js'
import { errorHandler, HttpError } from './errors.js'
import { contentRouter } from './routes/content.js'
import { membersRouter } from './routes/members.js'
import { rsvpsRouter } from './routes/rsvps.js'
import { booksRouter } from './routes/books.js'
import { eventsRouter } from './routes/events.js'
import { profileRouter } from './routes/profile.js'
import { reviewsRouter } from './routes/reviews.js'

export const app = express()

app.disable('x-powered-by')
if (config.trustProxyHops > 0) app.set('trust proxy', config.trustProxyHops)
app.use(helmet())
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.clientOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new HttpError(403, 'Origin is not allowed'))
    },
  }),
)
app.use(express.json({ limit: '32kb' }))
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests; please try again later' },
  }),
)

app.get('/api/health', async (_request, response) => {
  await pool.query('select 1')
  response.json({ status: 'ok' })
})

app.use('/api/content', contentRouter)
app.use(
  '/api/members',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many signup attempts; please try again later' },
  }),
  membersRouter,
)
app.use('/api/account', accountRouter)
app.use('/api/meetings', rsvpsRouter)
app.use('/api/books', booksRouter)
app.use('/api/events', eventsRouter)
app.use('/api/profile', profileRouter)
app.use('/api/reviews', reviewsRouter)

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found' })
})

app.use(errorHandler)
