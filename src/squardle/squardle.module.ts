import { Module } from '@nestjs/common';
import { SquardleController } from './squardle.controller';
import { SquardleScraperService } from './squardle-scraper.service';

@Module({
  controllers: [SquardleController],
  providers: [SquardleScraperService],
})
export class SquardleModule {}
