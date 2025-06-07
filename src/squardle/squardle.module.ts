import { Module } from '@nestjs/common';
import { SquardleController } from './squardle.controller';
import { SquardleAutoPlayerController } from './squardle-auto-player.controller';
import { SquardleScraperService } from './squardle-scraper.service';
import { SquardlePlayerService } from './squardle-player.service';
import { SquardleInteractionService } from './squardle-interaction.service';

@Module({
  controllers: [SquardleController, SquardleAutoPlayerController],
  providers: [
    SquardleScraperService,
    SquardlePlayerService,
    SquardleInteractionService,
  ],
})
export class SquardleModule {}
