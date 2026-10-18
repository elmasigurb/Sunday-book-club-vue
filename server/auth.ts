import { createClient, type User } from '@supabase/supabase-js'
import type { NextFunction, Request, Response } from 'express'
import { config } from './config.js'
import { HttpError } from './errors.js'

declare global {
  namespace Express {
    interface Request {
      authUser?: User
    }
  }
}

const supabaseAuth = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  try {
    const authorization = request.get('authorization')

    if (!authorization?.startsWith('Bearer ')) {
      throw new HttpError(401, 'Authentication required')
    }

    const token = authorization.slice('Bearer '.length).trim()
    if (!token) throw new HttpError(401, 'Authentication required')

    const { data, error } = await supabaseAuth.auth.getUser(token)
    if (error || !data.user?.email) {
      throw new HttpError(401, 'Your session is invalid or has expired')
    }

    request.authUser = data.user
    next()
  } catch (error) {
    next(error)
  }
}

export async function optionalAuth(
  request: Request,
  _response: Response,
  next: NextFunction,
) {
  const authorization = request.get('authorization')
  if (!authorization) {
    next()
    return
  }

  if (!authorization.startsWith('Bearer ')) {
    next(new HttpError(401, 'Your session is invalid or has expired'))
    return
  }

  try {
    const token = authorization.slice('Bearer '.length).trim()
    const { data, error } = await supabaseAuth.auth.getUser(token)
    if (error || !data.user?.email) {
      throw new HttpError(401, 'Your session is invalid or has expired')
    }
    request.authUser = data.user
    next()
  } catch (error) {
    next(error)
  }
}

export function authenticatedUser(request: Request): User {
  if (!request.authUser?.email) throw new HttpError(401, 'Authentication required')
  return request.authUser
}
