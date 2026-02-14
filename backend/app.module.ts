import { Module } from '@nestjs/common';
import { GeminiAudioGateway } from './app.gateway';

@Module({
  providers: [GeminiAudioGateway],
})
export class AppModule {}