import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AdventureDocument } from '../../types/adventure';

/** Caminho da aventura demonstrativa, relativo a raiz do monorepo. */
export const DEMO_ADVENTURE_PATH = 'adventures/ponte-das-sombras/aventura.json';

/**
 * Carrega uma aventura do diretorio `adventures/`.
 *
 * Tenta alguns caminhos relativos ao diretorio de execucao para funcionar tanto
 * com `npm test -w @lonetale/engine` quanto a partir da raiz do monorepo.
 */
export function loadAdventure(relativePath: string = DEMO_ADVENTURE_PATH): AdventureDocument {
  const candidates = [
    resolve(process.cwd(), '../..', relativePath),
    resolve(process.cwd(), relativePath),
    resolve(process.cwd(), '../../..', relativePath),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return JSON.parse(readFileSync(candidate, 'utf8')) as AdventureDocument;
    }
  }

  throw new Error(
    `Nao foi possivel localizar a aventura "${relativePath}". Caminhos tentados:\n${candidates.join('\n')}`,
  );
}

/** Atalho para a aventura demonstrativa "A Ponte das Sombras". */
export function loadDemoAdventure(): AdventureDocument {
  return loadAdventure(DEMO_ADVENTURE_PATH);
}
