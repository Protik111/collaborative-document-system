# API Reference

Base URL: `http://localhost:3001/api/v1`

## Health
- **GET** `/health` — Public
  - Response: `{ status: 'ok', timestamp: string }`

## Auth
- **POST** `/auth/login` — Public
  - Body: [src/user/dto/login-user.dto.ts](src/user/dto/login-user.dto.ts)
  - Response: tokens / auth payload (see `AuthService`)
- **POST** `/auth/refresh` — Public
  - Body: [src/auth/dto/refresh-token.dto.ts](src/auth/dto/refresh-token.dto.ts)
- **GET** `/auth/me` — Protected (JWT)
  - Response: `{ user: { userId, email } }`

## User
- **POST** `/user` — Public
  - Body: [src/user/dto/create-user.dto.ts](src/user/dto/create-user.dto.ts)

## Workspace
All workspace routes require JWT.
- **POST** `/workspace` — Create workspace
  - Body: [src/workspace/dto/create-workspace.dto.ts](src/workspace/dto/create-workspace.dto.ts)
- **GET** `/workspace` — List user's workspaces
- **GET** `/workspace/:id` — Get workspace by id
- **PATCH** `/workspace/:id` — Update workspace
  - Body: [src/workspace/dto/update-workspace.dto.ts](src/workspace/dto/update-workspace.dto.ts)
- **DELETE** `/workspace/:id` — Delete workspace

Membership management (JWT required):
- **POST** `/workspace/:id/invite` — Invite member
  - Body: [src/workspace/dto/invite-member.dto.ts](src/workspace/dto/invite-member.dto.ts)
- **GET** `/workspace/:id/members` — List members
- **GET** `/workspace/:id/members/:userId` — Get member
- **PATCH** `/workspace/:id/members/:userId` — Update member role
  - Body: [src/workspace/dto/update-role.dto.ts](src/workspace/dto/update-role.dto.ts)
- **DELETE** `/workspace/:id/members/:userId` — Remove member

## Documents
All document routes are scoped under a workspace and require JWT.
- **POST** `/workspaces/:workspaceId/documents` — Create document
  - Body: [src/document/dto/create-document.dto.ts](src/document/dto/create-document.dto.ts)
- **GET** `/workspaces/:workspaceId/documents` — List documents
- **GET** `/workspaces/:workspaceId/documents/:docId` — Get document
- **PATCH** `/workspaces/:workspaceId/documents/:docId` — Update document
  - Body: [src/document/dto/update-document.dto.ts](src/document/dto/update-document.dto.ts)
- **DELETE** `/workspaces/:workspaceId/documents/:docId` — Delete document

## Document Blocks
All require JWT and are scoped to a document.
- **POST** `/workspaces/:workspaceId/documents/:documentId/blocks` — Create block
  - Body: [src/document/dto/create-block.dto.ts](src/document/dto/create-block.dto.ts)
- **GET** `/workspaces/:workspaceId/documents/:documentId/blocks` — List blocks
- **PATCH** `/workspaces/:workspaceId/documents/:documentId/blocks/:blockId` — Update block
  - Body: [src/document/dto/update-block.dto.ts](src/document/dto/update-block.dto.ts)
- **DELETE** `/workspaces/:workspaceId/documents/:documentId/blocks/:blockId` — Delete block

## Document Versions
- **POST** `/workspaces/:workspaceId/documents/:documentId/versions` — Create version
  - Body: [src/document/dto/create-version.dto.ts](src/document/dto/create-version.dto.ts)
- **GET** `/workspaces/:workspaceId/documents/:documentId/versions` — List versions
- **POST** `/workspaces/:workspaceId/documents/:documentId/versions/:versionId/restore` — Restore version

## WebSocket (Realtime)
- Namespace: `/documents` (Socket.IO namespace)
- Events:
  - `join_document` — payload `{ documentId }` — joins room `documentId` (requires token via `handshake.auth.token` or query `token`)
  - `block_update` — payload `{ documentId, blockId, content }` — broadcast `block_updated` to room
  - Server emits: `user_joined`, `block_updated`

Notes
- Global prefix: all REST routes are under `/api/v1` (set in `src/main.ts`).
- Authentication: most routes use the global `JwtAuthGuard` — mark routes with `@Public()` to skip.
- For request/response shapes, see DTOs referenced above in `src/**/dto`.

If you want this exported as an OpenAPI (Swagger) JSON or a Postman collection, tell me which format and I'll generate it.
