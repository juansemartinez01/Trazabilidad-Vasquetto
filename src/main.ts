import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3000', 'https://trazabilidad-frontend-production-1a88.up.railway.app'],
    credentials: true, // si usás cookies o auth con headers
  });
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Listening on ${port}`);
}
bootstrap();
