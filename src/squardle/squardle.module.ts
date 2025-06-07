import { Module } from '@nestjs/common';
import { SquardleController } from './squardle.controller';
import { SquardleScraperService } from './squardle-scraper.service';
import { SquardlePlayerService } from './squardle-player.service';

@Module({
  controllers: [SquardleController],
  providers: [SquardleScraperService, SquardlePlayerService],
})
export class SquardleModule {}
