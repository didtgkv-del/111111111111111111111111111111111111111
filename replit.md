# ONMS - Social Network for Developers

## Overview
ONMS is a social network platform for developers to share projects, find collaborators, and climb the leaderboard. Built with a modern web stack.

## Tech Stack
- **Frontend**: React 18 with Vite, TailwindCSS, Radix UI components
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **Email**: Nodemailer for password reset functionality

## Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities
│   │   └── pages/       # Page components
├── server/           # Express backend
│   ├── auth.ts       # Authentication setup
│   ├── db.ts         # Database connection
│   ├── routes.ts     # API routes
│   ├── storage.ts    # Data access layer
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code (schema)
│   └── schema.ts     # Drizzle database schema
```

## Key Features
- User authentication (login/register)
- User profiles with customization
- Post creation and sharing
- Following system
- Like functionality
- Leaderboard

## Database Schema
- users: User accounts with profiles
- posts: User posts (text/project shares)
- follows: Following relationships
- likes: Post likes

## Running the App
- Development: `npm run dev`
- Build: `npm run build`
- Production: `npm run start`
- Database push: `npm run db:push`

## Environment Variables
- DATABASE_URL: PostgreSQL connection string (auto-configured)
- SESSION_SECRET: Session encryption key
