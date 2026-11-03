import type { MigrationInterface, QueryRunner } from 'typeorm';

import { LONETALE_SCHEMA } from '../../config/configuration';

const S = LONETALE_SCHEMA;

/**
 * Estrutura inicial do LoneTale.
 *
 * Escrita a mao, e nao gerada, por tres razoes ligadas ao ambiente:
 * 1. o banco e compartilhado e pode conter objetos de outras aplicacoes --
 *    tudo aqui e criado com `IF NOT EXISTS` e sempre com o prefixo do schema;
 * 2. nada e criado em `dbo`;
 * 3. o `down` remove apenas o que o `up` criou, na ordem inversa das chaves
 *    estrangeiras, sem tocar no schema se ele contiver outros objetos.
 */
export class InitialLonetaleSchema1793404800000 implements MigrationInterface {
  name = 'InitialLonetaleSchema1793404800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${S}') EXEC('CREATE SCHEMA [${S}]')`,
    );

    // ---------------------------------------------------------------- Users
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[Users]', 'U') IS NULL
      CREATE TABLE [${S}].[Users] (
        [id]            UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Users_id] DEFAULT NEWSEQUENTIALID(),
        [email]         NVARCHAR(320)    NOT NULL,
        [displayName]   NVARCHAR(80)     NOT NULL,
        [role]          NVARCHAR(16)     NOT NULL CONSTRAINT [DF_Users_role] DEFAULT 'player',
        [isActive]      BIT              NOT NULL CONSTRAINT [DF_Users_isActive] DEFAULT 1,
        [emailVerified] BIT              NOT NULL CONSTRAINT [DF_Users_emailVerified] DEFAULT 0,
        [locale]        NVARCHAR(10)     NOT NULL CONSTRAINT [DF_Users_locale] DEFAULT 'pt-BR',
        [lastLoginAt]   DATETIME2        NULL,
        [createdAt]     DATETIME2        NOT NULL CONSTRAINT [DF_Users_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt]     DATETIME2        NOT NULL CONSTRAINT [DF_Users_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Users] PRIMARY KEY ([id]),
        CONSTRAINT [CK_Users_role] CHECK ([role] IN ('player', 'author', 'admin'))
      )
    `);
    await this.createIndex(queryRunner, 'IX_Users_Email', 'Users', '[email]', { unique: true });

    // ------------------------------------------------------ UserCredentials
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[UserCredentials]', 'U') IS NULL
      CREATE TABLE [${S}].[UserCredentials] (
        [userId]            UNIQUEIDENTIFIER NOT NULL,
        [algorithm]         NVARCHAR(32)     NOT NULL CONSTRAINT [DF_UserCredentials_algorithm] DEFAULT 'scrypt',
        [passwordHash]      NVARCHAR(512)    NOT NULL,
        [passwordChangedAt] DATETIME2        NULL,
        [failedAttempts]    INT              NOT NULL CONSTRAINT [DF_UserCredentials_failedAttempts] DEFAULT 0,
        [lockedUntil]       DATETIME2        NULL,
        [updatedAt]         DATETIME2        NOT NULL CONSTRAINT [DF_UserCredentials_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_UserCredentials] PRIMARY KEY ([userId]),
        CONSTRAINT [FK_UserCredentials_Users] FOREIGN KEY ([userId])
          REFERENCES [${S}].[Users] ([id]) ON DELETE CASCADE
      )
    `);

    // -------------------------------------------------------- ExternalLogins
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[ExternalLogins]', 'U') IS NULL
      CREATE TABLE [${S}].[ExternalLogins] (
        [id]          UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_ExternalLogins_id] DEFAULT NEWSEQUENTIALID(),
        [userId]      UNIQUEIDENTIFIER NOT NULL,
        [provider]    NVARCHAR(32)     NOT NULL,
        [subject]     NVARCHAR(255)    NOT NULL,
        [email]       NVARCHAR(320)    NULL,
        [lastLoginAt] DATETIME2        NULL,
        [createdAt]   DATETIME2        NOT NULL CONSTRAINT [DF_ExternalLogins_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_ExternalLogins] PRIMARY KEY ([id]),
        CONSTRAINT [FK_ExternalLogins_Users] FOREIGN KEY ([userId])
          REFERENCES [${S}].[Users] ([id]) ON DELETE CASCADE
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_ExternalLogins_Provider_Subject',
      'ExternalLogins',
      '[provider], [subject]',
      { unique: true },
    );
    await this.createIndex(queryRunner, 'IX_ExternalLogins_UserId', 'ExternalLogins', '[userId]');

    // --------------------------------------------------------- RefreshTokens
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[RefreshTokens]', 'U') IS NULL
      CREATE TABLE [${S}].[RefreshTokens] (
        [id]                UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_RefreshTokens_id] DEFAULT NEWSEQUENTIALID(),
        [userId]            UNIQUEIDENTIFIER NOT NULL,
        [tokenHash]         NVARCHAR(64)     NOT NULL,
        [familyId]          UNIQUEIDENTIFIER NOT NULL,
        [expiresAt]         DATETIME2        NOT NULL,
        [revokedAt]         DATETIME2        NULL,
        [revokedReason]     NVARCHAR(64)     NULL,
        [replacedByTokenId] UNIQUEIDENTIFIER NULL,
        [createdByIp]       NVARCHAR(45)     NULL,
        [userAgent]         NVARCHAR(256)    NULL,
        [createdAt]         DATETIME2        NOT NULL CONSTRAINT [DF_RefreshTokens_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([id]),
        CONSTRAINT [FK_RefreshTokens_Users] FOREIGN KEY ([userId])
          REFERENCES [${S}].[Users] ([id]) ON DELETE CASCADE
      )
    `);
    await this.createIndex(queryRunner, 'IX_RefreshTokens_TokenHash', 'RefreshTokens', '[tokenHash]', {
      unique: true,
    });
    await this.createIndex(
      queryRunner,
      'IX_RefreshTokens_UserId_ExpiresAt',
      'RefreshTokens',
      '[userId], [expiresAt]',
    );

    // ------------------------------------------------------------ Adventures
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[Adventures]', 'U') IS NULL
      CREATE TABLE [${S}].[Adventures] (
        [id]               UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Adventures_id] DEFAULT NEWSEQUENTIALID(),
        [slug]             NVARCHAR(80)     NOT NULL,
        [title]            NVARCHAR(200)    NOT NULL,
        [summary]          NVARCHAR(500)    NULL,
        [ownerId]          UNIQUEIDENTIFIER NOT NULL,
        [status]           NVARCHAR(16)     NOT NULL CONSTRAINT [DF_Adventures_status] DEFAULT 'draft',
        [visibility]       NVARCHAR(16)     NOT NULL CONSTRAINT [DF_Adventures_visibility] DEFAULT 'private',
        [language]         NVARCHAR(10)     NOT NULL CONSTRAINT [DF_Adventures_language] DEFAULT 'pt-BR',
        [currentVersionId] UNIQUEIDENTIFIER NULL,
        [draftVersionId]   UNIQUEIDENTIFIER NULL,
        [coverAssetId]     NVARCHAR(80)     NULL,
        [createdAt]        DATETIME2        NOT NULL CONSTRAINT [DF_Adventures_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt]        DATETIME2        NOT NULL CONSTRAINT [DF_Adventures_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Adventures] PRIMARY KEY ([id]),
        CONSTRAINT [FK_Adventures_Owner] FOREIGN KEY ([ownerId])
          REFERENCES [${S}].[Users] ([id]),
        CONSTRAINT [CK_Adventures_status] CHECK ([status] IN ('draft', 'published', 'archived')),
        CONSTRAINT [CK_Adventures_visibility] CHECK ([visibility] IN ('private', 'unlisted', 'public'))
      )
    `);
    await this.createIndex(queryRunner, 'IX_Adventures_Slug', 'Adventures', '[slug]', { unique: true });
    await this.createIndex(queryRunner, 'IX_Adventures_OwnerId', 'Adventures', '[ownerId]');
    await this.createIndex(
      queryRunner,
      'IX_Adventures_Status_Visibility',
      'Adventures',
      '[status], [visibility]',
    );

    // ----------------------------------------------------- AdventureVersions
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[AdventureVersions]', 'U') IS NULL
      CREATE TABLE [${S}].[AdventureVersions] (
        [id]            UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_AdventureVersions_id] DEFAULT NEWSEQUENTIALID(),
        [adventureId]   UNIQUEIDENTIFIER NOT NULL,
        [version]       NVARCHAR(20)     NOT NULL,
        [schemaVersion] NVARCHAR(20)     NOT NULL,
        [status]        NVARCHAR(16)     NOT NULL CONSTRAINT [DF_AdventureVersions_status] DEFAULT 'draft',
        [document]      NVARCHAR(MAX)    NOT NULL,
        [checksum]      NVARCHAR(64)     NOT NULL,
        [nodeCount]     INT              NOT NULL CONSTRAINT [DF_AdventureVersions_nodeCount] DEFAULT 0,
        [releaseNotes]  NVARCHAR(1000)   NULL,
        [createdBy]     UNIQUEIDENTIFIER NOT NULL,
        [publishedAt]   DATETIME2        NULL,
        [createdAt]     DATETIME2        NOT NULL CONSTRAINT [DF_AdventureVersions_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt]     DATETIME2        NOT NULL CONSTRAINT [DF_AdventureVersions_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_AdventureVersions] PRIMARY KEY ([id]),
        CONSTRAINT [FK_AdventureVersions_Adventures] FOREIGN KEY ([adventureId])
          REFERENCES [${S}].[Adventures] ([id]) ON DELETE CASCADE,
        CONSTRAINT [CK_AdventureVersions_status] CHECK ([status] IN ('draft', 'published', 'deprecated')),
        CONSTRAINT [CK_AdventureVersions_documentIsJson] CHECK (ISJSON([document]) = 1)
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_AdventureVersions_Adventure_Version',
      'AdventureVersions',
      '[adventureId], [version]',
      { unique: true },
    );
    await this.createIndex(queryRunner, 'IX_AdventureVersions_Status', 'AdventureVersions', '[status]');

    // ------------------------------------------------- AdventurePublications
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[AdventurePublications]', 'U') IS NULL
      CREATE TABLE [${S}].[AdventurePublications] (
        [id]                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_AdventurePublications_id] DEFAULT NEWSEQUENTIALID(),
        [adventureId]        UNIQUEIDENTIFIER NOT NULL,
        [adventureVersionId] UNIQUEIDENTIFIER NOT NULL,
        [version]            NVARCHAR(20)     NOT NULL,
        [visibility]         NVARCHAR(16)     NOT NULL,
        [releaseNotes]       NVARCHAR(1000)   NULL,
        [publishedBy]        UNIQUEIDENTIFIER NOT NULL,
        [retiredAt]          DATETIME2        NULL,
        [publishedAt]        DATETIME2        NOT NULL CONSTRAINT [DF_AdventurePublications_publishedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_AdventurePublications] PRIMARY KEY ([id]),
        CONSTRAINT [FK_AdventurePublications_Adventures] FOREIGN KEY ([adventureId])
          REFERENCES [${S}].[Adventures] ([id]),
        CONSTRAINT [FK_AdventurePublications_Versions] FOREIGN KEY ([adventureVersionId])
          REFERENCES [${S}].[AdventureVersions] ([id])
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_AdventurePublications_AdventureId',
      'AdventurePublications',
      '[adventureId]',
    );
    await this.createIndex(
      queryRunner,
      'IX_AdventurePublications_VersionId',
      'AdventurePublications',
      '[adventureVersionId]',
    );

    // ----------------------------------------------------------- MediaAssets
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[MediaAssets]', 'U') IS NULL
      CREATE TABLE [${S}].[MediaAssets] (
        [id]          UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_MediaAssets_id] DEFAULT NEWSEQUENTIALID(),
        [adventureId] UNIQUEIDENTIFIER NOT NULL,
        [assetId]     NVARCHAR(80)     NOT NULL,
        [kind]        NVARCHAR(16)     NOT NULL,
        [src]         NVARCHAR(1000)   NOT NULL,
        [alt]         NVARCHAR(300)    NULL,
        [credit]      NVARCHAR(200)    NULL,
        [contentType] NVARCHAR(100)    NULL,
        [sizeBytes]   BIGINT           NULL,
        [width]       INT              NULL,
        [height]      INT              NULL,
        [durationMs]  INT              NULL,
        [uploadedBy]  UNIQUEIDENTIFIER NOT NULL,
        [createdAt]   DATETIME2        NOT NULL CONSTRAINT [DF_MediaAssets_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_MediaAssets] PRIMARY KEY ([id]),
        CONSTRAINT [FK_MediaAssets_Adventures] FOREIGN KEY ([adventureId])
          REFERENCES [${S}].[Adventures] ([id]) ON DELETE CASCADE,
        CONSTRAINT [CK_MediaAssets_kind] CHECK ([kind] IN ('image', 'audio', 'video', 'model'))
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_MediaAssets_Adventure_AssetId',
      'MediaAssets',
      '[adventureId], [assetId]',
      { unique: true },
    );
    await this.createIndex(queryRunner, 'IX_MediaAssets_Kind', 'MediaAssets', '[kind]');

    // ------------------------------------------------------------ Characters
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[Characters]', 'U') IS NULL
      CREATE TABLE [${S}].[Characters] (
        [id]                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Characters_id] DEFAULT NEWSEQUENTIALID(),
        [userId]             UNIQUEIDENTIFIER NOT NULL,
        [adventureId]        UNIQUEIDENTIFIER NOT NULL,
        [adventureVersionId] UNIQUEIDENTIFIER NOT NULL,
        [name]               NVARCHAR(40)     NOT NULL,
        [classId]            NVARCHAR(80)     NULL,
        [raceId]             NVARCHAR(80)     NULL,
        [level]              INT              NOT NULL CONSTRAINT [DF_Characters_level] DEFAULT 1,
        [experience]         INT              NOT NULL CONSTRAINT [DF_Characters_experience] DEFAULT 0,
        [appearance]         NVARCHAR(MAX)    NULL,
        [description]        NVARCHAR(500)    NULL,
        [createdAt]          DATETIME2        NOT NULL CONSTRAINT [DF_Characters_createdAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt]          DATETIME2        NOT NULL CONSTRAINT [DF_Characters_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_Characters] PRIMARY KEY ([id]),
        CONSTRAINT [FK_Characters_Users] FOREIGN KEY ([userId]) REFERENCES [${S}].[Users] ([id]),
        CONSTRAINT [FK_Characters_Adventures] FOREIGN KEY ([adventureId])
          REFERENCES [${S}].[Adventures] ([id]),
        CONSTRAINT [FK_Characters_Versions] FOREIGN KEY ([adventureVersionId])
          REFERENCES [${S}].[AdventureVersions] ([id]),
        CONSTRAINT [CK_Characters_appearanceIsJson] CHECK ([appearance] IS NULL OR ISJSON([appearance]) = 1)
      )
    `);
    await this.createIndex(queryRunner, 'IX_Characters_UserId', 'Characters', '[userId]');
    await this.createIndex(
      queryRunner,
      'IX_Characters_Adventure',
      'Characters',
      '[adventureId], [userId]',
    );

    // ---------------------------------------------------------- GameSessions
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[GameSessions]', 'U') IS NULL
      CREATE TABLE [${S}].[GameSessions] (
        [id]                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_GameSessions_id] DEFAULT NEWSEQUENTIALID(),
        [userId]             UNIQUEIDENTIFIER NOT NULL,
        [characterId]        UNIQUEIDENTIFIER NOT NULL,
        [adventureId]        UNIQUEIDENTIFIER NOT NULL,
        [adventureVersionId] UNIQUEIDENTIFIER NOT NULL,
        [adventureVersion]   NVARCHAR(20)     NOT NULL,
        [status]             NVARCHAR(16)     NOT NULL CONSTRAINT [DF_GameSessions_status] DEFAULT 'active',
        [currentNodeId]      NVARCHAR(80)     NOT NULL,
        [sequence]           INT              NOT NULL CONSTRAINT [DF_GameSessions_sequence] DEFAULT 0,
        [stateSnapshot]      NVARCHAR(MAX)    NOT NULL,
        [endingId]           NVARCHAR(80)     NULL,
        [playtimeSeconds]    INT              NOT NULL CONSTRAINT [DF_GameSessions_playtime] DEFAULT 0,
        [rngSeed]            NVARCHAR(64)     NOT NULL,
        [completedAt]        DATETIME2        NULL,
        [lastActionAt]       DATETIME2        NULL,
        [startedAt]          DATETIME2        NOT NULL CONSTRAINT [DF_GameSessions_startedAt] DEFAULT SYSUTCDATETIME(),
        [updatedAt]          DATETIME2        NOT NULL CONSTRAINT [DF_GameSessions_updatedAt] DEFAULT SYSUTCDATETIME(),
        [version]            INT              NOT NULL CONSTRAINT [DF_GameSessions_version] DEFAULT 1,
        CONSTRAINT [PK_GameSessions] PRIMARY KEY ([id]),
        CONSTRAINT [FK_GameSessions_Users] FOREIGN KEY ([userId]) REFERENCES [${S}].[Users] ([id]),
        CONSTRAINT [FK_GameSessions_Characters] FOREIGN KEY ([characterId])
          REFERENCES [${S}].[Characters] ([id]),
        CONSTRAINT [FK_GameSessions_Versions] FOREIGN KEY ([adventureVersionId])
          REFERENCES [${S}].[AdventureVersions] ([id]),
        CONSTRAINT [CK_GameSessions_snapshotIsJson] CHECK (ISJSON([stateSnapshot]) = 1),
        CONSTRAINT [CK_GameSessions_sequence] CHECK ([sequence] >= 0)
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_GameSessions_User_Status',
      'GameSessions',
      '[userId], [status]',
    );
    await this.createIndex(
      queryRunner,
      'IX_GameSessions_User_Updated',
      'GameSessions',
      '[userId], [updatedAt] DESC',
    );
    await this.createIndex(
      queryRunner,
      'IX_GameSessions_Adventure',
      'GameSessions',
      '[adventureId], [status]',
    );
    await this.createIndex(queryRunner, 'IX_GameSessions_Character', 'GameSessions', '[characterId]');

    // ----------------------------------------------------- CharacterInventory
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[CharacterInventory]', 'U') IS NULL
      CREATE TABLE [${S}].[CharacterInventory] (
        [id]            UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_CharacterInventory_id] DEFAULT NEWSEQUENTIALID(),
        [gameSessionId] UNIQUEIDENTIFIER NOT NULL,
        [characterId]   UNIQUEIDENTIFIER NOT NULL,
        [itemId]        NVARCHAR(80)     NOT NULL,
        [quantity]      INT              NOT NULL,
        [equipped]      BIT              NOT NULL CONSTRAINT [DF_CharacterInventory_equipped] DEFAULT 0,
        [slot]          NVARCHAR(40)     NULL,
        [updatedAt]     DATETIME2        NOT NULL CONSTRAINT [DF_CharacterInventory_updatedAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_CharacterInventory] PRIMARY KEY ([id]),
        CONSTRAINT [FK_CharacterInventory_Sessions] FOREIGN KEY ([gameSessionId])
          REFERENCES [${S}].[GameSessions] ([id]) ON DELETE CASCADE,
        CONSTRAINT [CK_CharacterInventory_quantity] CHECK ([quantity] > 0)
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_CharacterInventory_Session',
      'CharacterInventory',
      '[gameSessionId]',
    );
    await this.createIndex(
      queryRunner,
      'IX_CharacterInventory_Session_Item',
      'CharacterInventory',
      '[gameSessionId], [itemId]',
      { unique: true },
    );
    await this.createIndex(queryRunner, 'IX_CharacterInventory_Item', 'CharacterInventory', '[itemId]');

    // ------------------------------------------------------------ GameEvents
    await queryRunner.query(`
      IF OBJECT_ID('[${S}].[GameEvents]', 'U') IS NULL
      CREATE TABLE [${S}].[GameEvents] (
        [id]             UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_GameEvents_id] DEFAULT NEWSEQUENTIALID(),
        [gameSessionId]  UNIQUEIDENTIFIER NOT NULL,
        [sequence]       INT              NOT NULL,
        [ordinal]        INT              NOT NULL CONSTRAINT [DF_GameEvents_ordinal] DEFAULT 0,
        [kind]           NVARCHAR(40)     NOT NULL,
        [nodeId]         NVARCHAR(80)     NULL,
        [actionType]     NVARCHAR(40)     NULL,
        [payload]        NVARCHAR(MAX)    NOT NULL,
        [idempotencyKey] NVARCHAR(100)    NULL,
        [createdAt]      DATETIME2        NOT NULL CONSTRAINT [DF_GameEvents_createdAt] DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_GameEvents] PRIMARY KEY ([id]),
        CONSTRAINT [FK_GameEvents_Sessions] FOREIGN KEY ([gameSessionId])
          REFERENCES [${S}].[GameSessions] ([id]) ON DELETE CASCADE,
        CONSTRAINT [CK_GameEvents_payloadIsJson] CHECK (ISJSON([payload]) = 1)
      )
    `);
    await this.createIndex(
      queryRunner,
      'IX_GameEvents_Session_Sequence',
      'GameEvents',
      '[gameSessionId], [sequence]',
    );
    await this.createIndex(queryRunner, 'IX_GameEvents_Kind', 'GameEvents', '[kind]');
    // Indice unico filtrado: a chave de idempotencia e opcional, mas quando
    // enviada garante que a mesma acao nunca seja aplicada duas vezes.
    await this.createIndex(
      queryRunner,
      'IX_GameEvents_Session_Idempotency',
      'GameEvents',
      '[gameSessionId], [idempotencyKey]',
      { unique: true, where: '[idempotencyKey] IS NOT NULL' },
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa das dependencias. Apenas objetos criados pelo `up`.
    const tables = [
      'GameEvents',
      'CharacterInventory',
      'GameSessions',
      'Characters',
      'MediaAssets',
      'AdventurePublications',
      'AdventureVersions',
      'Adventures',
      'RefreshTokens',
      'ExternalLogins',
      'UserCredentials',
      'Users',
    ];

    for (const table of tables) {
      await queryRunner.query(
        `IF OBJECT_ID('[${S}].[${table}]', 'U') IS NOT NULL DROP TABLE [${S}].[${table}]`,
      );
    }

    // O schema so e removido se nada mais restar nele: o banco e compartilhado.
    await queryRunner.query(`
      IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${S}')
         AND NOT EXISTS (
           SELECT 1 FROM sys.objects o
             JOIN sys.schemas s ON s.schema_id = o.schema_id
            WHERE s.name = '${S}'
         )
      EXEC('DROP SCHEMA [${S}]')
    `);
  }

  private async createIndex(
    queryRunner: QueryRunner,
    name: string,
    table: string,
    columns: string,
    options: { unique?: boolean; where?: string } = {},
  ): Promise<void> {
    const unique = options.unique ? 'UNIQUE ' : '';
    const filter = options.where ? ` WHERE ${options.where}` : '';
    await queryRunner.query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
         WHERE name = '${name}' AND object_id = OBJECT_ID('[${S}].[${table}]')
      )
      CREATE ${unique}INDEX [${name}] ON [${S}].[${table}] (${columns})${filter}
    `);
  }
}
