import adventureSchema from './adventure.schema.json';

/**
 * JSON Schema (draft 2020-12) do documento de aventura.
 *
 * E a fonte unica do contrato estrutural: o backend valida contra ele antes de
 * persistir, o Studio usa-o para checagem em tempo de edicao e ferramentas
 * externas podem referencia-lo pelo `$id`.
 */
export const ADVENTURE_JSON_SCHEMA = adventureSchema as unknown as Record<string, unknown>;

export const ADVENTURE_SCHEMA_ID = (adventureSchema as { $id: string }).$id;

export { CURRENT_SCHEMA_VERSION } from '../types/adventure';
