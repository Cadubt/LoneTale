#!/usr/bin/env node
/**
 * Validador de aventuras em linha de comando.
 *
 *   node dist/cli/validate-adventure.js examples/adventures/*.json
 *
 * Sai com codigo 1 quando ha erros, permitindo usar em CI e em ganchos de
 * pre-commit do Studio.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { formatIssues, validateAdventure } from '../validation/validate-adventure';

function main(argv: string[]): number {
  const files = argv.filter((argument) => !argument.startsWith('-'));
  if (files.length === 0) {
    process.stderr.write('Uso: validate-adventure <arquivo.json> [...]\n');
    return 2;
  }

  let failed = 0;

  for (const file of files) {
    const path = resolve(process.cwd(), file);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch (error) {
      failed += 1;
      process.stderr.write(`[ERRO] ${file}: JSON invalido - ${(error as Error).message}\n`);
      continue;
    }

    const result = validateAdventure(parsed);

    if (result.warnings.length > 0) {
      process.stdout.write(`[AVISOS] ${file}\n`);
      for (const warning of result.warnings) {
        process.stdout.write(`  - ${warning.path}: ${warning.message}\n`);
      }
    }

    if (result.valid) {
      process.stdout.write(`[OK] ${file}\n`);
    } else {
      failed += 1;
      process.stderr.write(`[ERRO] ${file}\n${formatIssues(result.errors, 50)}\n`);
    }
  }

  return failed > 0 ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
