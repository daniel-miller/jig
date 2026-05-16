---
name: postgres-dapper-migrations
description: PostgreSQL + Dapper + raw-SQL migration conventions for this org.
  Snake_case schemas, slug + serial-key + timestamp columns, idempotent
  forward-only migrations in db/NNN-create-<entity>.sql, applied at API
  startup by Migrator. Use when authoring SQL, designing tables, writing
  Dapper queries, or wiring a new entity into a project.
---

# PostgreSQL + Dapper + Migrations

The reference is `bump/db/` + `Bump.Api/Migrations/Migrator.cs`.

## Engine + driver

- PostgreSQL 13+.
- `Npgsql` 9.x. One `NpgsqlDataSource` per process, registered as a singleton in DI. The data source owns the connection pool.
- `Dapper` 2.x for query mapping. Connections opened per repository call (`await using var conn = await dataSource.OpenConnectionAsync(ct)`).

## Naming

- Tables: singular, snake_case (`app`, `account_session`, `service_state`, `subscriber`).
- Surrogate primary key: `<table>_key serial PRIMARY KEY`. Use `bigserial` only when the table is genuinely high-volume (problem reports, request logs).
- Natural unique key: `<table>_slug varchar(50) NOT NULL` plus `CREATE UNIQUE INDEX IF NOT EXISTS ix_<table>_slug ON <table> (<table>_slug)`. Slug = lowercase letters, digits, single hyphens, starts and ends with letter/digit.
- Human-readable name: `<table>_name varchar(<n>) NOT NULL`.
- Long-text description: `<table>_description varchar(500) NULL`.
- FKs use the referenced table's key column verbatim: `account_key integer NOT NULL REFERENCES account(account_key)`.

## Required timestamp columns

Every persisted entity carries:

```sql
created_at  timestamptz NOT NULL DEFAULT now(),
updated_at  timestamptz
```

`updated_at` is nullable on insert and set to `now()` only on update. Repository UPDATE statements always include `updated_at = now()` in the SET list.

`timestamptz`, never `timestamp without time zone`. Storage is UTC; the client picks a display zone.

## Idempotent forward-only migrations

- One file per logical change: `db/NNN-<action>-<entity>.sql`. Three-digit zero-padded prefix, lexicographic ordering. Gaps in numbering are fine and intentional (`004`, `006`, `010`).
- Every statement is wrapped in `IF NOT EXISTS` / `IF EXISTS` guards so re-running the file is a no-op:

  ```sql
  CREATE TABLE IF NOT EXISTS app (...);
  CREATE UNIQUE INDEX IF NOT EXISTS ix_app_slug ON app (app_slug);
  ALTER TABLE app ADD COLUMN IF NOT EXISTS app_description varchar(500);
  ```

- No `DROP` without an explicit reason in a comment. No destructive changes that lose data without an inline note explaining the migration path.
- Seed data goes in `db/seed-<topic>.sql`. Seeds are never picked up by the auto-applier — they're applied manually.
- A `db/seed-admin.sql` exists alongside a `dotnet run --project src/<Api> -- hash <password>` command that prints the matching INSERT.

## Migrator

`src/<Api>/Migrations/Migrator.cs` mirrors the Bump version exactly:

- Records applied filenames in a `_migration_history(name text PRIMARY KEY, applied_at timestamptz)` table.
- Enumerates `*.sql` lexicographically, excludes anything starting with `seed`, skips already-applied names, and runs each remaining file in its own transaction.
- Looks for the `db/` folder next to the binary first (production: `COPY db ./db` in the publish output), then walks up to find the repo's `db/` folder during local development. A sentinel file (e.g. `004-create-app.sql`) confirms the directory.

Wire SQL files into publish output via the API csproj:

```xml
<ItemGroup>
  <Content Include="..\..\db\*.sql" Exclude="..\..\db\seed*.sql">
    <Link>db\%(Filename)%(Extension)</Link>
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
    <CopyToPublishDirectory>PreserveNewest</CopyToPublishDirectory>
  </Content>
</ItemGroup>
```

Run the migrator from `Program.cs` inside a DI scope immediately after `app = builder.Build()` and before middleware registration:

```csharp
using (var scope = app.Services.CreateScope())
{
    var migrator = scope.ServiceProvider.GetRequiredService<Migrator>();
    migrator.ApplyAsync().GetAwaiter().GetResult();
}
```

`Migrator.ApplyAsync(CancellationToken)` is the only async member.

## Dapper repositories

See `aspnet-api-stack` for the full repository pattern. Schema-relevant rules:

- One file per aggregate. Singleton in DI.
- Map columns explicitly with `AS PascalCase` aliases on every selected column — no implicit name matching, even when Dapper would handle it. The aliases double as the wire-shape contract.
- Define `private const string Cols = """SELECT ... FROM <table>"""` and `private const string Returning = """RETURNING ..."""` once and splice them into every method with raw-string interpolation (`$"""..."""`). The interpolation only touches static SQL; bind values still go through `@Param` parameters.

## Domain-specific column patterns

- Money: `numeric(19, 4)`. Never `float`/`real`/`double precision`.
- Counts: `integer` unless saturation is genuinely possible, then `bigint`.
- Booleans: `boolean NOT NULL DEFAULT false`.
- Enums: `varchar(<n>) NOT NULL` with a `CHECK` constraint listing allowed values. No native PG enums — they're harder to evolve.
- JSON blobs: `jsonb` (never `json`). Add a GIN index when the column is queried.
- Email: `varchar(255) NOT NULL`, lowercased in the application layer before insert. Unique index when the table represents an account.

## Idempotency table

POSTs that honour `Idempotency-Key` use a shared `idempotency` table:

```sql
CREATE TABLE IF NOT EXISTS idempotency
(
    api_key_hash         bytea       NOT NULL,
    idempotency_key      varchar(255) NOT NULL,
    request_fingerprint  bytea       NOT NULL,
    response_status      integer     NOT NULL,
    response_content_type varchar(100),
    response_body        bytea       NOT NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (api_key_hash, idempotency_key)
);
```

`api_key_hash` = SHA-256 of the raw bearer token; the secret never sits in the table. Worker sweeps rows older than 24h.

## What not to do

- No camelCase or PascalCase column names. Always snake_case.
- No EF Core migrations. SQL files only.
- No surrogate `uuid` PK by default. `serial`/`bigserial` keeps joins narrow. Use `uuid` only for tokens that escape into URLs/emails (password reset, subscriber confirm, recovery code).
- No `DROP COLUMN` in a migration without a comment explaining the data path.
- No application-managed `id INT AUTO_INCREMENT` patterns. Use `serial`.
- No untyped `TEXT` columns for short fields with a known maximum. `varchar(<n>)` with an explicit width — the DTO validation enforces it and 422 surfaces overruns.
