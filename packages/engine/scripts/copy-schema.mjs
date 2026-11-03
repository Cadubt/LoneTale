// Copia os arquivos de schema para o diretorio de saida.
// O JSON Schema e a fonte unica do contrato e vive em src/schema; o tsc nao
// garante a copia de arquivos .json, portanto a copia e explicita aqui.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '..', 'src', 'schema');
const destination = join(here, '..', 'dist', 'schema');

await mkdir(destination, { recursive: true });

const entries = await readdir(source);
let copied = 0;
for (const entry of entries) {
  if (!entry.endsWith('.json')) {
    continue;
  }
  await copyFile(join(source, entry), join(destination, entry));
  copied += 1;
}

process.stdout.write(`copy-schema: ${copied} arquivo(s) para dist/schema\n`);
