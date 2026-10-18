import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db.js'

export const membersRouter = Router()

const joinSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(320).transform((email) => email.toLowerCase()),
})

membersRouter.post('/', async (request, response) => {
  const member = joinSchema.parse(request.body)
  const result = await pool.query<{ id: string; name: string; email: string }>(
    `
      insert into public.members (name, email, subscribed)
      values ($1, $2, true)
      on conflict (email) do update
        set name = excluded.name,
            subscribed = true,
            updated_at = now()
      returning id, name, email
    `,
    [member.name, member.email],
  )

  response.status(201).json({ member: result.rows[0] })
})
