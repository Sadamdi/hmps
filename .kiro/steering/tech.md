# Technology Stack & Build System

## Architecture
Full-stack TypeScript application with React frontend and Express.js backend.

## Frontend Stack
- **React 18** with TypeScript
- **Vite** for development and build tooling
- **Tailwind CSS** for styling with shadcn/ui components
- **Wouter** for client-side routing
- **React Query (@tanstack/react-query)** for state management and API calls
- **React Hook Form** with Zod validation
- **Radix UI** components for accessible UI primitives
- **Framer Motion** for animations
- **WebSocket** for real-time features

## Backend Stack
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL (Neon) and MongoDB support
- **JWT** authentication with bcryptjs
- **Multer** for file uploads
- **WebSocket (ws)** for real-time communication
- **Google Generative AI** integration
- **Passport.js** for authentication strategies

## Database
- **Primary**: PostgreSQL via Neon serverless
- **Secondary**: MongoDB for specific features
- **Drizzle ORM** for type-safe database operations
- **Schema validation** with Zod

## Development Tools
- **TypeScript** with strict configuration
- **ESBuild** for production builds
- **tsx** for TypeScript execution
- **Drizzle Kit** for database migrations

## Common Commands

### Development
```bash
npm run dev          # Start development server
npm run check        # TypeScript type checking
```

### Database
```bash
npm run db:push      # Push schema changes to database
npm run db:seed      # Seed database with initial data
```

### Production
```bash
npm run build        # Build for production (Vite + ESBuild)
npm start           # Start production server
```

## Path Aliases
- `@db` → `./db/index.ts` and `./db/*`
- `@/` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets` → `./attached_assets`

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Environment mode
- `DISABLE_MONGODB` - Toggle MongoDB usage

## Port Configuration
- Development and production both run on **port 5000**
- Single server serves both API and client
- Static files served from `/uploads` and `/attached_assets`