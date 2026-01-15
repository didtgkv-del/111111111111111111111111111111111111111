import { z } from 'zod';
import { insertUserSchema, insertPostSchema, users, posts } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema.extend({
        confirmPassword: z.string(),
      }),
      responses: {
        201: z.object({
          message: z.string(),
          user: z.object({
            id: z.number(),
            username: z.string(),
            email: z.string().email(),
          }),
        }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect | null>(),
      },
    },
    verify: {
      method: 'POST' as const,
      path: '/api/verify-email',
      input: z.object({
        email: z.string().email(),
        code: z.string(),
      }),
      responses: {
        200: z.object({
          message: z.string(),
          user: z.object({
            id: z.number(),
            username: z.string(),
            email: z.string().email(),
          }),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    resend: {
      method: 'POST' as const,
      path: '/api/resend-verification',
      input: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({
          message: z.string(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    forgotPassword: {
      method: 'POST' as const,
      path: '/api/forgot-password',
      input: z.object({
        email: z.string().email(),
      }),
      responses: {
        200: z.object({
          message: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    verifyResetCode: {
      method: 'POST' as const,
      path: '/api/verify-reset-code',
      input: z.object({
        email: z.string().email(),
        code: z.string(),
      }),
      responses: {
        200: z.object({
          message: z.string(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    resetPassword: {
      method: 'POST' as const,
      path: '/api/reset-password',
      input: z.object({
        email: z.string().email(),
        code: z.string(),
        newPassword: z.string().min(6),
      }),
      responses: {
        200: z.object({
          message: z.string(),
        }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
  },
  conversations: {
    list: {
      method: 'GET' as const,
      path: '/api/conversations',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          otherUser: z.object({
            id: z.number(),
            username: z.string(),
            avatar: z.string().nullable().optional(),
          }),
          lastMessage: z.object({
            type: z.string(),
            content: z.string().nullable().optional(),
            createdAt: z.string().nullable().optional(),
          }).nullable(),
        })),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/conversations',
      input: z.object({ userId: z.number() }),
      responses: {
        200: z.object({ id: z.number() }),
        400: errorSchemas.validation,
        401: errorSchemas.unauthorized,
      },
    },
    messages: {
      list: {
        method: 'GET' as const,
        path: '/api/conversations/:id/messages',
        responses: {
          200: z.array(z.object({
            id: z.number(),
            conversationId: z.number(),
            senderId: z.number(),
            type: z.string(),
            content: z.string().nullable().optional(),
            fileUrl: z.string().nullable().optional(),
            createdAt: z.string().nullable().optional(),
          })),
          401: errorSchemas.unauthorized,
          404: errorSchemas.notFound,
        },
      },
      send: {
        method: 'POST' as const,
        path: '/api/conversations/:id/messages',
        input: z.object({
          type: z.enum(['text']).default('text'),
          content: z.string().min(1),
        }),
        responses: {
          201: z.object({
            id: z.number(),
            conversationId: z.number(),
            senderId: z.number(),
            type: z.string(),
            content: z.string().nullable().optional(),
            fileUrl: z.string().nullable().optional(),
            createdAt: z.string().nullable().optional(),
          }),
          400: errorSchemas.validation,
          401: errorSchemas.unauthorized,
          404: errorSchemas.notFound,
        },
      },
    },
  },
  settings: {
    updateProfile: {
      method: 'PATCH' as const,
      path: '/api/settings/profile',
      input: z.object({
        username: z.string().min(3).max(7).optional(),
        bio: z.string().optional(),
        avatar: z.string().optional(),
        theme: z.string().optional(),
        isPrivate: z.boolean().optional(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    updatePassword: {
      method: 'PATCH' as const,
      path: '/api/settings/password',
      input: z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }),
      responses: {
        200: z.void(),
        400: errorSchemas.validation,
      },
    },
  },
  users: {
    get: {
      method: 'GET' as const,
      path: '/api/users/:username',
      responses: {
        200: z.custom<typeof users.$inferSelect & { followersCount: number, followingCount: number, isFollowing: boolean, isFollowedBy: boolean, isMutualFollow: boolean }>(),
        404: errorSchemas.notFound,
      },
    },
    follow: {
      method: 'POST' as const,
      path: '/api/users/:id/follow',
      responses: {
        200: z.void(),
      },
    },
    leaderboard: {
      method: 'GET' as const,
      path: '/api/leaderboard',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect & { followersCount: number }>()),
      },
    },
    search: {
      method: 'GET' as const,
      path: '/api/users/search',
      responses: {
        200: z.array(z.object({
          id: z.number(),
          username: z.string(),
          bio: z.string().nullable().optional(),
          avatar: z.string().nullable().optional(),
          followersCount: z.number(),
          isFollowing: z.boolean(),
          isFollowedBy: z.boolean(),
        })),
        401: errorSchemas.unauthorized,
      },
    },
  },
  posts: {
    list: {
      method: 'GET' as const,
      path: '/api/posts',
      responses: {
        200: z.array(z.custom<typeof posts.$inferSelect & { author: typeof users.$inferSelect, likesCount: number, isLiked: boolean }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/posts',
      input: insertPostSchema.omit({ userId: true }),
      responses: {
        201: z.custom<typeof posts.$inferSelect>(),
      },
    },
    like: {
      method: 'POST' as const,
      path: '/api/posts/:id/like',
      responses: {
        200: z.void(),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
