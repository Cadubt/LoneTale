import type { Rng } from '../types/dice';
import type { RngState } from '../types/state';

/** Hash de 128 bits (cyrb128) usado para expandir a semente textual. */
function cyrb128(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i += 1) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ];
}

/**
 * Gerador seeded (sfc32).
 *
 * As rolagens acontecem exclusivamente no backend. O estado guardado e apenas
 * `{ seed, cursor }`: ao retomar a partida o gerador e reconstruido e avancado
 * `cursor` vezes, o que torna toda a partida reproduzivel e permite testes
 * deterministicos sem persistir o estado interno do PRNG.
 */
export class SeededRng implements Rng {
  readonly seed: string;

  private a: number;
  private b: number;
  private c: number;
  private d: number;
  private consumed = 0;

  constructor(seed: string, advanceBy = 0) {
    this.seed = seed;
    const [a, b, c, d] = cyrb128(seed);
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    for (let i = 0; i < advanceBy; i += 1) {
      this.rawNext();
    }
    this.consumed = advanceBy;
  }

  static fromState(state: RngState): SeededRng {
    return new SeededRng(state.seed, state.cursor);
  }

  get cursor(): number {
    return this.consumed;
  }

  toState(): RngState {
    return { seed: this.seed, cursor: this.consumed };
  }

  next(): number {
    this.consumed += 1;
    return this.rawNext();
  }

  int(min: number, max: number): number {
    if (max < min) {
      throw new RangeError(`Intervalo invalido: [${min}, ${max}]`);
    }
    const lo = Math.ceil(min);
    const hi = Math.floor(max);
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  /** Escolhe um indice por peso. Retorna -1 quando a lista esta vazia. */
  weightedIndex(weights: number[]): number {
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
    if (total <= 0) {
      return weights.length > 0 ? 0 : -1;
    }
    let roll = this.next() * total;
    for (let i = 0; i < weights.length; i += 1) {
      roll -= Math.max(0, weights[i] ?? 0);
      if (roll < 0) {
        return i;
      }
    }
    return weights.length - 1;
  }

  /** `true` com probabilidade `chance` (0..1). */
  chance(probability: number): boolean {
    if (probability <= 0) {
      return false;
    }
    if (probability >= 1) {
      // Consome um valor mesmo assim, para manter a sequencia estavel.
      this.next();
      return true;
    }
    return this.next() < probability;
  }

  private rawNext(): number {
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }
}

/** Gera uma semente opaca para uma nova partida. */
export function createSeed(prefix = 'lt'): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}
