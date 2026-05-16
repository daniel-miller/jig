---
name: dotnet-conventions
description: Applies the org's .NET coding conventions. Use when writing or
  reviewing C# code, designing classes, or structuring projects in any repo
  under this org. Triggers on .cs files, .csproj edits, or questions about
  C#/.NET style.
---

# .NET Conventions

Target framework, SDK pin, and ASP.NET specifics live in the `aspnet-api-stack` skill. This file is the language-level baseline that applies to *every* C# project in the org (API, worker, SDK, console).

## SDK and project shape

- .NET 10. Pin the SDK via `global.json` at the repo root with `rollForward: latestFeature`.
- One `.sln` at the repo root. Project files under `src/<Name>/<Name>.csproj`. Tests under `tests/<Name>.Tests/<Name>.Tests.csproj` when present.
- `<Nullable>enable</Nullable>` and `<ImplicitUsings>enable</ImplicitUsings>` on every project.
- `<GenerateDocumentationFile>true</GenerateDocumentationFile>` on libraries and API hosts; `<NoWarn>$(NoWarn);1591</NoWarn>` to silence missing-XML-comment noise without losing the file.
- Set `<RootNamespace>` explicitly when the folder structure does not already match the desired namespace.

## Language style

- File-scoped namespaces (`namespace Bump.Api;`), never block-scoped.
- `sealed` by default on every class that is not deliberately designed for inheritance. Mark public types `sealed` even when the impulse is to leave them open.
- Prefer primary constructors when a class only stores its constructor arguments. Drop them when the constructor needs validation, logging, or guard clauses — then a regular constructor is clearer.
- Records for data transport (`sealed record Foo(...)`); classes for behaviour.
- `readonly` on every backing field that isn't reassigned.
- No `var` for primitive returns where the type isn't obvious from the right-hand side. Use `var` freely when the type is on the line (`var rows = await conn.QueryAsync<App>(...)`).
- Raw string literals (`"""..."""`) for any SQL, JSON, or multi-line text. Interpolated raw strings (`$"""..."""`) when composing SQL fragments — see `aspnet-api-stack` for the standard Cols/Returning pattern.
- `using` declarations (no braces) for `IDisposable`/`IAsyncDisposable` locals.

## Async

- Every async-returning method ends in `Async`.
- Accept `CancellationToken ct = default` as the last parameter on every async method that does I/O. Repository methods, HTTP calls, file reads — all take a token. Forward it; never swallow it.
- Never `.Result`, `.Wait()`, or `.GetAwaiter().GetResult()` inside request-pipeline or background-service code. Allowed only in `Main` for one-shot bootstrap work (e.g. running migrations before `app.Run()`).
- Use `ConfigureAwait` defaults — do not sprinkle `.ConfigureAwait(false)` in ASP.NET apps. It's noise without value on .NET 8+.

## Error handling

- Throw `InvalidOperationException` for "this code path should not have been hit" / "config missing" cases discovered at startup. Throw `ArgumentException`/`ArgumentNullException` for caller mistakes at API boundaries inside library code.
- In request-pipeline code, do not throw to signal a 4xx — return an `IActionResult` built from `JsonResults.*` (see `aspnet-api-stack`). Exceptions are reserved for actual failures.
- Catch the narrowest exception type that makes sense. `catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)` is the idiom for translating a constraint violation to a 409.

## Logging

- Serilog, configured in `Program.cs` via `builder.Host.UseSerilog((ctx, sp, cfg) => cfg.ReadFrom.Configuration(ctx.Configuration).ReadFrom.Services(sp).Enrich.FromLogContext())`. Bootstrap logger goes to console only.
- Use structured logging: `_logger.LogInformation("Applying migration {Name}", name);` — never `$"Applying migration {name}"`.
- One `ILogger<T>` per class, injected by the framework. Don't pass `ILogger` around as a generic.

## Configuration

- Bind configuration with nested keys under a single product prefix (`"Bump:Database:ConnectionString"`, `"Bump:Mailgun:ApiKey"`).
- Validate required config at startup. If a key is missing, throw `InvalidOperationException` with a message naming the key and how to set it (file *and* environment-variable form):
  > `Bump:Database:ConnectionString is empty. Set it via appsettings.local.json or the Bump__Database__ConnectionString environment variable.`
- Local-only overrides live in `appsettings.local.json` next to the project. The file is gitignored and the csproj marks it `<CopyToOutputDirectory>Never</CopyToOutputDirectory>` and `<CopyToPublishDirectory>Never</CopyToPublishDirectory>` so it never ships.
- `appsettings.json` is committed and only contains schema-shaped placeholders (empty strings, empty arrays).

## DI

- Singletons by default. Use scoped lifetimes only when a service genuinely needs per-request state.
- Register repositories, filters, and option records as singletons. `NpgsqlDataSource` is a singleton (it owns its own connection pool).
- `IHttpClientFactory` via `AddHttpClient<TInterface, TImpl>()` for typed clients; `AddHttpClient(nameof(Foo))` for ad-hoc named clients.

## What not to do

- No AutoMapper. Hand-written mappers (static `From(...)` methods on response records).
- No FluentValidation. Inline `Validate()` methods on request DTOs returning `IResult?` (null = valid).
- No EF Core in new projects — Dapper + raw SQL. Migrating an existing EF project is a separate decision the user makes.
- No MediatR. Controllers call repositories directly.
- No `Result<T, Error>` types. Use exceptions for exceptional cases and `IActionResult` from `JsonResults.*` for HTTP responses.
- No System.Text.Json on API projects — Newtonsoft.Json via `AddNewtonsoftJson` (the SDK consumers and existing serialization assumptions depend on it). New libraries that aren't bound to the API surface may use System.Text.Json.
