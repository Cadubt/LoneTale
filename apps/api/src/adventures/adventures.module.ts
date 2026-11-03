import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdventureCacheService } from './adventure-cache.service';
import { AdventuresController } from './adventures.controller';
import { AdventuresService } from './adventures.service';
import { CatalogController } from './catalog.controller';
import { AdventurePublication } from './entities/adventure-publication.entity';
import { AdventureVersion } from './entities/adventure-version.entity';
import { Adventure } from './entities/adventure.entity';
import { MediaAsset } from './entities/media-asset.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Adventure, AdventureVersion, AdventurePublication, MediaAsset]),
  ],
  controllers: [AdventuresController, CatalogController],
  providers: [AdventuresService, AdventureCacheService],
  exports: [AdventuresService, AdventureCacheService],
})
export class AdventuresModule {}
