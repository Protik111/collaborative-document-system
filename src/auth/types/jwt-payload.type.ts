export interface JwtPayload {
  sub: string; // user ID (standard JWT "subject" claim)
  email?: string;
}

export interface RefreshPayload {
  sub: string; // user ID only for refresh tokens (minimal scope)
}

export interface JwtSignOptions {
  secret: string;
  expiresIn: string | number;
}
