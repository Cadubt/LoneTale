import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { AdventurePublication } from '../adventures/entities/adventure-publication.entity';
import { AdventureVersion } from '../adventures/entities/adventure-version.entity';
import { Adventure } from '../adventures/entities/adventure.entity';
import { MediaAsset } from '../adventures/entities/media-asset.entity';
import { CharacterInventoryRow } from '../game/entities/character-inventory.entity';
import { Character } from '../game/entities/character.entity';
import { GameEvent } from '../game/entities/game-event.entity';
import { GameSession } from '../game/entities/game-session.entity';
import { ExternalLogin } from '../users/entities/external-login.entity';
import { UserCredential } from '../users/entities/user-credential.entity';
import { User } from '../users/entities/user.entity';

/**
 * Lista unica das entidades do LoneTale.
 *
 * Todas declaram `schema: 'lonetale'`: nenhum objeto da aplicacao e criado em
 * `dbo` nem em schemas de outros sistemas que compartilhem o banco.
 */
export const LONETALE_ENTITIES = [
  User,
  UserCredential,
  ExternalLogin,
  RefreshToken,
  Adventure,
  AdventureVersion,
  AdventurePublication,
  MediaAsset,
  Character,
  CharacterInventoryRow,
  GameSession,
  GameEvent,
];
