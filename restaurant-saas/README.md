# Restaurant SaaS Platform

A complete, production-ready multi-tenant SaaS platform for restaurant and café management with QR code ordering, real-time order management, and comprehensive administrative features.

## Architecture

- **Frontend**: Next.js 15+ with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: NestJS with TypeScript
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **Realtime**: Supabase Realtime / WebSocket
- **ORM**: Prisma

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (optional)
- Supabase account

### Installation

1. Clone the repository
2. Copy .env.example to .env and configure
3. Install dependencies for both frontend and backend
4. Run database migrations
5. Start the development servers

`ash
# Backend
cd backend
npm install
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev
`

## Documentation

- API Documentation: http://localhost:3001/api/docs (Swagger)
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
