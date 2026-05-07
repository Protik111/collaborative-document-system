import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super(); // Call parent AuthGuard constructor
  }

  // Override canActivate to check for @Public() decorator
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Method handler (e.g., login())
      context.getClass(), // Controller class (e.g., AuthController)
    ]);

    if (isPublic) {
      return true; // Skip authentication for public routes
    }

    // Run default JWT validation for protected routes
    return super.canActivate(context);
  }

  // Customize error handling
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      // You can customize the error message based on `info`
      // info.message might be: "No auth token", "jwt expired", etc.
      throw err || new UnauthorizedException('Invalid or missing token');
    }
    return user; // This becomes `req.user`
  }
}
