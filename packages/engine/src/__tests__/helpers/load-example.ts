import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AdventureDocument } from '../../types/adventure';

/**
 * Carrega uma aventura de `examples/adventures`.
 *
 * Tenta alguns caminhos relativos ao diretorio de execucao para funcionar tanto
 * com `npm test -w @lonetale/engine` quanto a partir da raiz do monorepo.
 */
export function loadExampleAdventure(fileName: string): AdventureDocument {
  const candidates = [
    resolve(process.cwd(), '../../examples/adventures', fileName),
    resolve(process.cwd(), 'examples/adventures', fileName),
    resolve(process.cwd(), '../../../examples/adventures', fileName),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as AdventureDocument;
    }
  }

  throw new Error(
    `Nao foi possivel localizar a aventura de exemplo "${fileName}". Caminhos tentados:\n${candidates.join('\n')}`,
  );
}

export const BRIDGE_ADVENTURE_FILE = 'a-ponte-quebrada.json';
