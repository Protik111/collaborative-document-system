# Collaborative Document System

A real-time, block-based collaborative document editing system built with NestJS and WebSockets. Think of it as a developer-friendly, extensible take on modern documentation platforms.

## Key Features

- **Real-Time Collaboration**: Seamlessly edit documents with others in real-time, powered by Socket.io.
- **Block-Based Architecture**: Dynamic document structure using customizable content blocks.
- **Workspaces & Teams**: Organize documents into workspaces and manage member permissions.
- **Full-Text Search**: Quickly find documents across your workspaces with integrated search logic.
- **Secure Authentication**: Robust user authentication system with JWT access and refresh tokens.
- **Docker-First**: Fully containerized development environment for easy setup and scaling.

## Tech Stack

- **Backend**: [NestJS](https://nestjs.com/) (TypeScript)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [TypeORM](https://typeorm.io/)
- **Real-Time**: [Socket.io](https://socket.io/)
- **Auth**: [Passport.js](https://www.passportjs.org/) & [JWT](https://jwt.io/)
- **DevOps**: Docker & Docker Compose

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Protik111/collaborative-document-system.git
   cd collaborative-document-system
   ```

2. **Environment Configuration**
   Create a `.env` file in the root directory (refer to `.env.example` if available).

3. **Launch with Docker**
   The easiest way to get started is using Docker Compose:
   ```bash
   docker compose up --build
   ```
   This will spin up the NestJS application, PostgreSQL database, and any other required services.

4. **Local Development (Optional)**
   If you prefer running the app locally:
   ```bash
   npm install
   npm run start:dev
   ```

## Testing

The project maintains high test coverage with Jest.

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Project Structure

```text
src/
├── auth/              # Authentication & Security
├── document/          # Document & Block management
├── workspace/         # Workspace organization
├── workspace-member/  # Permission & Membership handling
├── user/              # User profiles & management
├── config/            # System & Provider configurations
└── shared/            # Common utilities & patterns
```
