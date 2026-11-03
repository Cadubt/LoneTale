import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(AppConfigService);

  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
  app.setGlobalPrefix(config.globalPrefix);
  app.enableShutdownHooks();

  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Propriedades desconhecidas sao erro, nao silencio: o cliente descobre
      // de imediato que mandou um campo errado.
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('LoneTale API')
        .setDescription(
          'Plataforma de aventuras solo de RPG narrativo. O motor de aventuras e autoritativo: ' +
            'o cliente envia acoes e recebe o estado projetado, com as escolhas ja avaliadas no servidor.',
        )
        .setVersion('0.1.0')
        .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
        .addTag('Autenticacao')
        .addTag('Catalogo')
        .addTag('Adventure Studio')
        .addTag('Partidas')
        .addTag('Saude')
        .build(),
    );
    SwaggerModule.setup(`${config.globalPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  await app.listen(config.port, '0.0.0.0');

  logger.log(`LoneTale API em http://localhost:${config.port}/${config.globalPrefix}`);
  if (config.swaggerEnabled) {
    logger.log(`Documentacao em http://localhost:${config.port}/${config.globalPrefix}/docs`);
  }
  if (!config.google.enabled) {
    logger.warn('Login com Google desativado (credenciais OIDC ausentes).');
  }
}

void bootstrap().catch((error) => {
  // Falhas de configuracao devem derrubar o processo com uma mensagem clara,
  // em vez de deixar a API no ar sem saber conversar com o banco.
  new Logger('Bootstrap').error(`Falha ao iniciar a API: ${(error as Error).message}`, (error as Error).stack);
  process.exit(1);
});
