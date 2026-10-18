import { app } from './app.js'
import { config } from './config.js'
import { closeDatabase } from './db.js'

const server = app.listen(config.port, () => {
  console.log(`Sunday Book Club API listening on http://localhost:${config.port}`)
})

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`)
  server.close(async () => {
    await closeDatabase()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
