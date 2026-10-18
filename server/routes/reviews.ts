import { Router } from 'express'
import { z } from 'zod'
import { authenticatedUser, requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { HttpError } from '../errors.js'

export const reviewsRouter = Router()

const paramsSchema = z.object({ reviewId: z.string().uuid() })
const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(1000),
})

reviewsRouter.patch('/:reviewId', requireAuth, async (request, response) => {
  const { reviewId } = paramsSchema.parse(request.params)
  const input = reviewSchema.parse(request.body)
  const user = authenticatedUser(request)
  const result = await pool.query<{ id: string; quote: string; rating: number; updated_at: Date }>(`
    update public.reviews r
    set quote = $3, rating = $4, approved = true
    from public.members m
    where r.id = $1 and r.member_id = m.id and m.auth_user_id = $2
    returning r.id, r.quote, r.rating, r.updated_at
  `, [reviewId, user.id, input.text, input.rating])
  if (!result.rows[0]) throw new HttpError(404, 'Review not found')
  response.json({
    review: {
      id: result.rows[0].id,
      text: result.rows[0].quote,
      rating: result.rows[0].rating,
      updatedAt: result.rows[0].updated_at.toISOString(),
    },
  })
})

reviewsRouter.delete('/:reviewId', requireAuth, async (request, response) => {
  const { reviewId } = paramsSchema.parse(request.params)
  const user = authenticatedUser(request)
  const result = await pool.query(`
    delete from public.reviews r
    using public.members m
    where r.id = $1 and r.member_id = m.id and m.auth_user_id = $2
  `, [reviewId, user.id])
  if (!result.rowCount) throw new HttpError(404, 'Review not found')
  response.status(204).send()
})
