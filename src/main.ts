import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './auth/guards/jwt-auth-guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable CORS with explicit config
    cors: {
      origin: [
        'http://localhost:3000', // Next.js dev server
        'http://127.0.0.1:3000',
        'http://localhost:4000', // Next.js dev server
        'http://127.0.0.1:4000',
      ],
      credentials: true, // Allow Authorization headers & cookies
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // Global guard: ensure @Public() is on login/register routes!
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3001);
  console.log(`Server running on http://localhost:${process.env.PORT ?? 3001}`);
}
bootstrap();
