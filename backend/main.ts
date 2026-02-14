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
  
  await app.listen(8081);
  console.log('🚀 Backend WebSocket listening on ws://localhost:8081');
}
bootstrap();