import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './auth/guards/jwt-auth-guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1'); // All routes will be prefixed with /api/v1

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips properties that aren't in the DTO
      transform: true, // Converts plain JS objects to DTO class instances
      forbidNonWhitelisted: true, // Throws 400 if unknown properties are passed
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
