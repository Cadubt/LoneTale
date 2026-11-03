/** Expressao de dados normalizada, ex.: 2d6+3. */
export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
  expression: string;
}

export interface DiceRoll {
  expression: string;
  /** Faces sorteadas, na ordem. */
  dice: number[];
  modifier: number;
  /** Soma das faces, sem modificadores. */
  natural: number;
  /** natural + modifier + bonus externos informados. */
  total: number;
  /** Bonus externos (atributo, pericia, item) somados ao total. */
  bonus?: number;
}

/** Gerador de numeros aleatorios reproduzivel. */
export interface Rng {
  /** Float em [0, 1). */
  next(): number;
  /** Inteiro em [min, max] inclusivo. */
  int(min: number, max: number): number;
  /** Quantidade de valores consumidos desde a semente. */
  readonly cursor: number;
  readonly seed: string;
}
