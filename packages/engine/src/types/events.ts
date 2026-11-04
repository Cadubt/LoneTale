import type { Effect } from './effects';
import type { Id, JsonPrimitive } from './json';
import type { DiceRoll } from './dice';

/**
 * Eventos emitidos pelo motor a cada passo.
 * Sao o log autoritativo da partida: persistidos em `lonetale.GameEvents`
 * e usados pelo cliente para animar o que aconteceu.
 */
export type GameEvent =
  | { type: 'nodeEntered'; nodeId: Id; visitCount: number }
  | { type: 'nodeExited'; nodeId: Id }
  | { type: 'choiceTaken'; nodeId: Id; choiceId: Id; label: string }
  | { type: 'effectApplied'; effect: Effect; detail?: string }
  | { type: 'effectSkipped'; effect: Effect; reason: string }
  | { type: 'itemGained'; itemId: Id; itemName: string; quantity: number }
  | { type: 'itemLost'; itemId: Id; itemName: string; quantity: number }
  | { type: 'itemEquipped'; itemId: Id; itemName: string; slot: string }
  | { type: 'itemUnequipped'; itemId: Id; itemName: string; slot: string }
  | { type: 'goldChanged'; delta: number; total: number }
  | { type: 'resourceChanged'; resourceId: Id; delta: number; current: number; max: number }
  | { type: 'attributeChanged'; attributeId: Id; delta: number; value: number }
  | { type: 'experienceGained'; amount: number; total: number }
  | { type: 'leveledUp'; level: number; attributePoints: number }
  | { type: 'skillUnlocked'; skillId: Id; skillName: string }
  | { type: 'flagChanged'; flag: Id; value: JsonPrimitive }
  | { type: 'questChanged'; questId: Id; questName: string; status: string; stage: number }
  | { type: 'npcRelationChanged'; npcId: Id; delta: number; value: number }
  | { type: 'diceRolled'; purpose: string; roll: DiceRoll }
  | {
      type: 'skillCheckResolved';
      nodeId: Id;
      success: boolean;
      critical: 'success' | 'failure' | null;
      total: number;
      difficulty: number;
      roll?: DiceRoll;
    }
  | { type: 'combatStarted'; nodeId: Id; enemyIds: Id[] }
  | {
      type: 'combatAttack';
      source: 'player' | 'enemy';
      actorName: string;
      targetName: string;
      hit: boolean;
      damage: number;
      roll?: DiceRoll;
    }
  | { type: 'combatSkillUsed'; skillId: Id; targetName?: string; damage?: number; healing?: number }
  | { type: 'combatantDefeated'; instanceId: string; enemyId: Id; name: string }
  | { type: 'combatRoundEnded'; round: number }
  | { type: 'combatEnded'; nodeId: Id; resolution: 'victory' | 'defeat' | 'fled' }
  | { type: 'checkpointSaved'; nodeId: Id; label?: string }
  | { type: 'checkpointRestored'; nodeId: Id }
  | { type: 'adventureEnded'; endingId: Id; kind?: string }
  | { type: 'characterDied'; resourceId: Id }
  | { type: 'warning'; message: string; code?: string };

export type GameEventType = GameEvent['type'];
