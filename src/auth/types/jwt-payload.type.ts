// src/auth/types/jwt-payload.type.ts
export interface JwtPayload {
  sub: string; // user ID (standard JWT "subject" claim)
  email?: string; // custom claim
  // Add other claims here as needed (e.g., roles, workspaceId)
}

export interface RefreshPayload {
  sub: string; // user ID only for refresh tokens (minimal scope)
}

export interface JwtSignOptions {
  secret: string;
  expiresIn: string | number;
}
