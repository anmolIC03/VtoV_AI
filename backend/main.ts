import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import * as dotenv from 'dotenv';

async function bootstrap() {
    dotenv.config(); 
  if (!process.env.GEMINI_API_KEY) {
    console.error("ERROR: API Key is still missing. Check your .env file!");
  } else {
    console.log("API Key loaded successfully!");
  }

  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app)); 
  
  const port = process.env.PORT || 8081;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend WebSocket listening on port ${port}`);
}
bootstrap();