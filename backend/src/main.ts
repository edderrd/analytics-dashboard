import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { env } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // The dashboard is served from a different origin in development.
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(env.PORT);
  console.log(
    `Relay analytics API listening on http://localhost:${env.PORT} ` +
      `(${env.NODE_ENV}, database "${env.DATABASE_NAME}" on ${env.DATABASE_HOST}:${env.DATABASE_PORT})`,
  );
}

void bootstrap();