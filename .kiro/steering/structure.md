# Project Structure & Organization

## Root Level Organization

```
├── client/                 # Frontend React application
├── server/                 # Backend Express application  
├── db/                     # Database configuration and utilities
├── shared/                 # Shared code between frontend and backend
├── public/                 # Static public assets
├── attached_assets/        # User uploaded files and attachments
├── uploads/               # File upload directory
└── scripts/               # Utility and maintenance scripts
```

## Frontend Structure (`client/`)

```
client/
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/            # Page-level components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and configurations
│   └── main.tsx          # Application entry point
├── index.html            # HTML template
└── tailwind.config.js    # Tailwind CSS configuration
```

## Backend Structure (`server/`)

```
server/
├── routes/               # API route definitions
├── models/              # Database models and schemas
├── services/            # Business logic services
├── config/              # Server configuration files
├── auth.ts              # Authentication logic
├── storage.ts           # File storage handling
├── upload.ts            # File upload middleware
└── index.ts             # Server entry point
```

## Database Structure (`db/`)

```
db/
├── index.ts             # Database connection and setup
├── mongodb.ts           # MongoDB specific configuration
├── mongo-seed.ts        # MongoDB seeding utilities
└── seed.ts              # Database seeding scripts
```

## Shared Code (`shared/`)

```
shared/
├── schema.ts            # Shared database schemas and types
└── uploads/             # Shared upload utilities
```

## Key Conventions

### File Naming
- **TypeScript files**: Use `.ts` extension for Node.js, `.tsx` for React components
- **Components**: PascalCase for component files and exports
- **Utilities**: camelCase for utility functions and files
- **Constants**: UPPER_SNAKE_CASE for constants

### Import Patterns
- Use path aliases: `@db`, `@/`, `@shared/*`, `@assets`
- Absolute imports preferred over relative imports
- Group imports: external libraries first, then internal modules

### Database Schema
- All schemas defined in `shared/schema.ts` using Drizzle ORM
- Zod validation schemas for all database operations
- Type-safe database operations with inferred types

### API Structure
- RESTful API endpoints under `/api` prefix
- Route handlers in `server/routes/`
- Business logic separated into `server/services/`
- Middleware for authentication, validation, and error handling

### Component Organization
- UI components use shadcn/ui pattern with Radix UI primitives
- Custom components in `client/src/components/`
- Page components in `client/src/pages/`
- Shared hooks in `client/src/hooks/`

### Static Assets
- Public assets in `public/` (logos, icons, etc.)
- User uploads in `attached_assets/` and `uploads/`
- Static file serving configured for both directories