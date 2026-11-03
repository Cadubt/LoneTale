import { Injectable, Logger } from '@nestjs/common';
import { CompiledAdventure, compileAdventure, type AdventureDocument } from '@lonetale/engine';

/**
 * Cache de aventuras compiladas, indexado pelo id da versao.
 *
 * Uma versao publicada e imutavel, portanto o documento compilado pode ser
 * reaproveitado entre partidas e entre jogadores sem risco de divergencia.
 * Isso evita reparsear e reindexar um JSON grande a cada acao do jogador.
 *
 * Rascunhos sao invalidados explicitamente a cada gravacao no Studio.
 */
@Injectable()
export class AdventureCacheService {
  private readonly logger = new Logger(AdventureCacheService.name);
  private readonly cache = new Map<string, CompiledAdventure>();
  private readonly maxEntries = 64;

  get(versionId: string): CompiledAdventure | undefined {
    const entry = this.cache.get(versionId);
    if (entry) {
      // Reinsere para aproximar um descarte do menos usado recentemente.
      this.cache.delete(versionId);
      this.cache.set(versionId, entry);
    }
    return entry;
  }

  /** Compila e guarda. O documento ja deve ter sido validado. */
  set(versionId: string, document: AdventureDocument): CompiledAdventure {
    const compiled = compileAdventure(document);
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(versionId, compiled);
    return compiled;
  }

  invalidate(versionId: string): void {
    if (this.cache.delete(versionId)) {
      this.logger.debug(`Cache invalidado para a versao ${versionId}.`);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
