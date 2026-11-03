/**
 * Semeadura de desenvolvimento.
 *
 * Cria (de forma idempotente) um autor, um jogador e importa a aventura de
 * exemplo ja publicada, para que seja possivel jogar logo depois de rodar as
 * migrations.
 *
 *   npm run seed -w @lonetale/api
 */
import 'reflect-metadata';

import { validateAdventure, type AdventureDocument } from '@lonetale/engine';
import { config as loadDotEnv } from 'dotenv';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';

import { loadConfiguration } from '../config/configuration';
import { AdventurePublication } from '../adventures/entities/adventure-publication.entity';
import { AdventureVersion } from '../adventures/entities/adventure-version.entity';
import { Adventure } from '../adventures/entities/adventure.entity';
import { buildDataSourceOptions } from './data-source';
import { User } from '../users/entities/user.entity';
import { UserCredential } from '../users/entities/user-credential.entity';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

loadDotEnv({ path: join(ROOT, '.env') });

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64'), derived.toString('base64')].join('$');
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalStringify(entryValue)}`);
  return `{${entries.join(',')}}`;
}

async function main(): Promise<void> {
  const configuration = loadConfiguration();
  const dataSource = new DataSource(
    buildDataSourceOptions(configuration.database, { forMigrations: true }),
  );
  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);
    const credentials = dataSource.getRepository(UserCredential);

    const seedUsers: Array<{ email: string; displayName: string; role: 'author' | 'player' }> = [
      { email: 'autor@lonetale.local', displayName: 'Autor de Exemplo', role: 'author' },
      { email: 'jogador@lonetale.local', displayName: 'Jogador de Exemplo', role: 'player' },
    ];

    const created: Record<string, User> = {};

    for (const seed of seedUsers) {
      let user = await users.findOne({ where: { email: seed.email } });
      if (!user) {
        user = await users.save(
          users.create({
            email: seed.email,
            displayName: seed.displayName,
            role: seed.role,
            isActive: true,
            emailVerified: true,
            locale: 'pt-BR',
            lastLoginAt: null,
          }),
        );
        await credentials.save(
          credentials.create({
            userId: user.id,
            algorithm: 'scrypt',
            // Senha de desenvolvimento. Troque-a (ou remova a conta) em qualquer
            // ambiente que nao seja a sua maquina.
            passwordHash: hashPassword('lonetale-dev-2026'),
            passwordChangedAt: new Date(),
            failedAttempts: 0,
            lockedUntil: null,
          }),
        );
        process.stdout.write(`[seed] usuario criado: ${seed.email}\n`);
      } else {
        process.stdout.write(`[seed] usuario ja existia: ${seed.email}\n`);
      }
      created[seed.role] = user;
    }

    const author = created.author as User;

    const documentPath = join(ROOT, 'examples', 'adventures', 'a-ponte-quebrada.json');
    const document = JSON.parse(readFileSync(documentPath, 'utf8')) as AdventureDocument;

    const validation = validateAdventure(document);
    if (!validation.valid) {
      throw new Error(
        `A aventura de exemplo esta invalida:\n${validation.errors
          .map((issue) => `  - ${issue.path}: ${issue.message}`)
          .join('\n')}`,
      );
    }

    const adventures = dataSource.getRepository(Adventure);
    const versions = dataSource.getRepository(AdventureVersion);
    const publications = dataSource.getRepository(AdventurePublication);

    let adventure = await adventures.findOne({ where: { slug: document.metadata.id } });
    if (adventure) {
      process.stdout.write(`[seed] aventura ja existia: ${document.metadata.id}\n`);
    } else {
      adventure = await adventures.save(
        adventures.create({
          slug: document.metadata.id,
          title: document.metadata.title,
          summary: document.metadata.summary ?? null,
          ownerId: author.id,
          status: 'published',
          visibility: 'public',
          language: document.metadata.language ?? 'pt-BR',
          currentVersionId: null,
          draftVersionId: null,
          coverAssetId: document.metadata.coverImage ?? null,
        }),
      );

      const publishedAt = new Date();
      const version = await versions.save(
        versions.create({
          adventureId: adventure.id,
          version: document.metadata.version,
          schemaVersion: document.schemaVersion,
          status: 'published',
          document: JSON.stringify(document),
          checksum: createHash('sha256').update(canonicalStringify(document)).digest('hex'),
          nodeCount: document.nodes.length,
          releaseNotes: 'Importada pela semeadura de desenvolvimento.',
          createdBy: author.id,
          publishedAt,
        }),
      );

      await adventures.update(adventure.id, { currentVersionId: version.id });
      await publications.save(
        publications.create({
          adventureId: adventure.id,
          adventureVersionId: version.id,
          version: version.version,
          visibility: 'public',
          releaseNotes: 'Importada pela semeadura de desenvolvimento.',
          publishedBy: author.id,
          retiredAt: null,
        }),
      );

      process.stdout.write(
        `[seed] aventura publicada: ${document.metadata.title} v${version.version}\n`,
      );
    }

    if (validation.warnings.length > 0) {
      process.stdout.write(`[seed] avisos de validacao: ${validation.warnings.length}\n`);
    }
    process.stdout.write('[seed] concluido.\n');
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error) => {
  process.stderr.write(`[seed] falhou: ${(error as Error).message}\n`);
  process.exit(1);
});
