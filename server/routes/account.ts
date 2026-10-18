import { Router } from 'express'
import { authenticatedUser, requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { ensureMember } from '../member-profile.js'

export const accountRouter = Router()

accountRouter.get('/', requireAuth, async (request, response) => {
  const user = authenticatedUser(request)
  const client = await pool.connect()

  try {
    await client.query('begin')
    const member = await ensureMember(client, user)
    await client.query('commit')
    response.json({ member })
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})
