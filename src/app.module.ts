import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SquardleModule } from './squardle/squardle.module';

@Module({
  imports: [SquardleModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
