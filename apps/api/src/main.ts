import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { CONFIG } from './config.js';
import type { Config } from './config.js';
import { ApiErrorFilter } from './errors.js';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new ApiErrorFilter());
  app.enableShutdownHooks();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('PokéLab API').setVersion('0.1.0').build(),
    ),
  );
  await app.listen(app.get<Config>(CONFIG).PORT, '127.0.0.1');
}
void bootstrap();
