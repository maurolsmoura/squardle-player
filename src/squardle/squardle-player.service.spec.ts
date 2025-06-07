import { Test, TestingModule } from '@nestjs/testing';
import { SquardlePlayerService } from './squardle-player.service';

describe('SquardlePlayerService', () => {
  let service: SquardlePlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SquardlePlayerService],
    }).compile();

    service = module.get<SquardlePlayerService>(SquardlePlayerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
