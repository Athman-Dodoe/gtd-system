import { RateLimiterMemory } from 'rate-limiter-flexible'

export const signInLimiter = new RateLimiterMemory({
  points: 5,
  duration: 15 * 60,
})

export const forgotPasswordLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60,
})

export const changePasswordLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 60,
})

export const resetPasswordLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 60,
})
