# Sticker Slap

A modern full-stack canvas-based sticker art application built with Next.js 14+, TypeScript, and Konva.js.

## Tech Stack

### Frontend
- **Next.js 14+** - React framework with App Router and Server Components
- **TypeScript** - Strict mode enabled
- **TailwindCSS** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library
- **Framer Motion** - Animation library
- **React Query (TanStack Query)** - Data fetching and caching
- **Zustand** - Client-side state management
- **Zod** - Runtime validation

### Backend
- **Next.js API Routes** - Route handlers
- **Prisma ORM** - Database ORM with PostgreSQL
- **NextAuth.js v5** - Authentication (OAuth + Credentials)
- **AWS S3 / Cloudflare R2** - Image storage
- **Sharp** - Image optimization and processing
- **Upstash Redis** - Rate limiting

### Canvas Engine
- **Konva.js** - Canvas rendering
- **react-konva** - React integration
- **Web Workers** - Heavy computations offloaded

### DevOps
- **ESLint + Prettier** - Code quality
- **Husky** - Git hooks
- **Jest + React Testing Library** - Testing
- **GitHub Actions** - CI/CD
- **Docker** - Containerization

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- npm or pnpm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sticker-slap.git
cd sticker-slap
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment file and configure:
```bash
cp .env.example .env
```

4. Set up the database:
```bash
npm run db:push
npm run db:seed
```

5. Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Setup

Run with Docker Compose:

```bash
docker-compose up -d
```

This starts:
- Next.js application on port 3000
- PostgreSQL on port 5432
- Redis on port 6379

## Project Structure

```
/src
├── /app                  # Next.js App Router
│   ├── /api             # API route handlers
│   ├── /auth            # Auth pages
│   ├── /editor          # Canvas editor
│   └── layout.tsx       # Root layout
├── /components          # Shared components
│   └── /ui              # shadcn/ui components
├── /features            # Feature modules
│   └── /canvas          # Canvas feature
│       ├── /components  # Canvas components
│       ├── /store       # Zustand store
│       └── /workers     # Web Workers
├── /hooks               # Custom React hooks
├── /lib                 # Utilities and configs
├── /server              # Server-only code
│   ├── auth.ts          # NextAuth config
│   ├── db.ts            # Prisma client
│   ├── image.ts         # Image processing
│   ├── rate-limit.ts    # Rate limiting
│   └── storage.ts       # S3/R2 storage
└── /types               # TypeScript types
```

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Auth
AUTH_SECRET=your-secret
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...

# Storage (AWS S3)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket

# Rate Limiting (Upstash)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Scripts

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix lint errors
npm run format       # Format with Prettier
npm run type-check   # TypeScript check

# Testing
npm run test         # Run tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report

# Database
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run migrations
npm run db:studio    # Open Prisma Studio
npm run db:seed      # Seed database
```

## Features

### Canvas Editor
- Drag-and-drop stickers
- Text editing with rich formatting
- Shape tools (rectangle, circle, star, polygon, line)
- Layer management (bring to front, send to back)
- Undo/redo history
- Zoom and pan controls
- Grid and snap-to-grid
- Keyboard shortcuts

### Authentication
- OAuth (Google, GitHub)
- Email/password credentials
- Session management with JWT

### Storage
- Direct upload to S3/R2
- Automatic image optimization
- Thumbnail generation
- Presigned URLs for secure access

### API
- Rate limiting per endpoint type
- Input validation with Zod
- Paginated responses
- Error handling

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Self-hosted

1. Build the Docker image:
```bash
docker build -t sticker-slap .
```

2. Run with your preferred orchestrator (K8s, ECS, etc.)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
