import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdventuresModule } from '../adventures/adventures.module';
import { Adventure } from '../adventures/entities/adventure.entity';
import { CharacterInventoryRow } from './entities/character-inventory.entity';
import { Character } from './entities/character.entity';
import { GameEvent } from './entities/game-event.entity';
import { GameSession } from './entities/game-session.entity';
import { GameController } from './game.controller';
import { GameService } from './game.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSession, GameEvent, Character, CharacterInventoryRow, Adventure]),
    AdventuresModule,
  ],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
