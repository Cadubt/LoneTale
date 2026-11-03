import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

/** Parametros atuais. Guardados junto do hash para permitir re-hash gradual. */
const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Derivacao de senha com scrypt (`node:crypto`).
 *
 * Escolhido de proposito em vez de bcrypt/argon2 nativos: nao exige compilacao
 * de modulo nativo (o que costuma quebrar em Windows e em imagens enxutas) e e
 * uma funcao de derivacao resistente a hardware dedicado.
 *
 * Os parametros viajam dentro do hash, de modo que um aumento futuro de custo
 * nao invalida as senhas existentes.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
      ...PARAMS,
      maxmem: 64 * 1024 * 1024,
    });
    return [
      'scrypt',
      PARAMS.N,
      PARAMS.r,
      PARAMS.p,
      salt.toString('base64'),
      derived.toString('base64'),
    ].join('$');
  }

  /** Comparacao em tempo constante. Nunca lanca por hash malformado. */
  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }
    const [, rawN, rawR, rawP, rawSalt, rawHash] = parts;
    const N = Number.parseInt(rawN as string, 10);
    const r = Number.parseInt(rawR as string, 10);
    const p = Number.parseInt(rawP as string, 10);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
      return false;
    }

    try {
      const salt = Buffer.from(rawSalt as string, 'base64');
      const expected = Buffer.from(rawHash as string, 'base64');
      const derived = await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
        N,
        r,
        p,
        maxmem: 256 * 1024 * 1024,
      });
      return derived.length === expected.length && timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  /** `true` quando o hash foi gerado com parametros mais fracos que os atuais. */
  needsRehash(stored: string): boolean {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return true;
    }
    return Number.parseInt(parts[1] as string, 10) < PARAMS.N;
  }
}
