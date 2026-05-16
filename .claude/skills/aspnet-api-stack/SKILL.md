---
name: aspnet-api-stack
description: ASP.NET Core API conventions for this org — Program.cs wiring,
  RFC 7807 problem+json responses, JsonResults helper, Dapper repositories on
  NpgsqlDataSource, Newtonsoft.Json + camelCase, controllers with idempotency
  + rate limiting + CSRF, three-scheme auth (Apps bearer / Problems bearer /
  session cookie). Use when adding endpoints, wiring filters, creating
  repositories, or designing a new ASP.NET Core project in this org.
---

# ASP.NET Core API Stack

The reference implementation is `Bump.Api`. Read it for live examples before reaching for a different pattern.

## NuGet packages (baseline)

```xml
<PackageReference Include="Dapper" Version="2.1.66" />
<PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="10.0.0" />
<PackageReference Include="Microsoft.AspNetCore.Mvc.NewtonsoftJson" Version="10.0.0" />
<PackageReference Include="Newtonsoft.Json" Version="13.0.3" />
<PackageReference Include="Npgsql" Version="9.0.3" />
<PackageReference Include="Polly" Version="8.5.0" />
<PackageReference Include="Serilog.AspNetCore" Version="9.0.0" />
<PackageReference Include="Serilog.Sinks.File" Version="6.0.0" />
<PackageReference Include="Swashbuckle.AspNetCore" Version="7.2.0" />
<PackageReference Include="Swashbuckle.AspNetCore.Newtonsoft" Version="7.2.0" />
```

Add when the surface needs them:

- `Konscious.Security.Cryptography.Argon2` — password hashing.
- `Otp.NET` — TOTP MFA.

## Program.cs shape

`Program.cs` is the only place wiring happens. Order it as:

1. Optional CLI sub-commands (`hash`, etc.) — short-circuit before WebApplication is built.
2. Bootstrap Serilog logger (console only) wrapped in a try/finally so fatal startup errors are logged.
3. `WebApplication.CreateBuilder(args)`.
4. `builder.Configuration.AddJsonFile("appsettings.local.json", optional: true, reloadOnChange: true);`
5. `builder.Host.UseSerilog(...)` reading from configuration.
6. Read + validate the DB connection string; `builder.Services.AddSingleton(NpgsqlDataSource.Create(cs))`.
7. Register repositories (one `AddSingleton<TRepo>()` line per type, grouped under a `// ---- Repositories ----` comment).
8. Auth schemes, filters, mailers, CAPTCHA, CORS, rate limiting (one section per concern, each with a single-line comment header).
9. `AddControllers(mvc => mvc.Filters.AddService<CsrfFilter>()).AddNewtonsoftJson(opts => opts.SerializerSettings.ContractResolver = new CamelCasePropertyNamesContractResolver());`
10. Swagger via `AddSwaggerGen` + `AddSwaggerGenNewtonsoftSupport`, with `IncludeXmlComments` guarded by `File.Exists`.
11. Build, run migrations inside `using (var scope = app.Services.CreateScope())`, then middleware order: `ProblemJsonExceptionHandler` → `UseSerilogRequestLogging` → optional `UsePathBase` → Swagger → `UseDefaultFiles` + `UseStaticFiles` → `UseRouting` → `UseCors` → `UseAuthentication` → `UseAuthorization` → `UseRateLimiter` → `MapControllers` → `MapFallbackToFile("index.html")` → `app.Run()`.

The SPA fallback at the bottom serves `wwwroot/index.html` for any unmatched route; `/api/**` and `/swagger/**` are already handled, so client-side routing just works.

## Repositories

One file per aggregate. `sealed class FooRepository(NpgsqlDataSource dataSource)` using primary-constructor syntax. Singleton-registered in `Program.cs`.

- Open + dispose a connection per method: `await using var conn = await dataSource.OpenConnectionAsync(ct);`
- Map columns explicitly via `AS PascalCase` aliases on every column. Define a `private const string Cols = """SELECT ... FROM table"""` and a `private const string Returning = """RETURNING ..."""` block reused across read/insert/update methods.
- Use raw-string interpolation to splice `Cols`/`Returning` into queries — Dapper still parameterises the bind sites:

  ```csharp
  return await conn.QuerySingleAsync<App>(
      $"""
      INSERT INTO app (app_slug, app_name)
      VALUES (@Slug, @Name)
      {Returning}
      """,
      new { Slug = slug, Name = name });
  ```

- Translate `PostgresException` with `SqlState == PostgresErrorCodes.UniqueViolation` to a 409 *in the controller*, not the repository. The repository surfaces the raw exception.

## Controllers

- `[ApiController]`, `[Route("api/<resource>")]`, `[Tags("Resource")]`.
- One attribute block at the top declaring every status code the controller can produce: `[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]` etc. Per-action `[ProducesResponseType]` lines add the success shape and any action-specific 4xx.
- Bearer-key controllers carry `[ApiKeyAuthorize]` + `[BypassCsrf]` + `[EnableRateLimiting(RateLimiting.AppsPolicy)]`. Session-cookie controllers omit `[BypassCsrf]` so the global CSRF filter runs.
- Every POST that should be safe to retry carries `[Idempotent]` and `[RequestSizeLimit(Limits.<Surface>BodyBytes)]`.
- Action methods return `Task<IActionResult>` and always end with `.AsAction()` — the small adapter that lets `IResult` (from `JsonResults`) be returned from an MVC action.
- XML `<summary>` on every action; first sentence becomes the Swagger summary. `<remarks>` carries auth requirements + idempotency notes.

## RFC 7807 problem+json everywhere

- Non-2xx responses use `application/problem+json` with the body `{ type?, title, status, detail?, instance? }`. Fields not relevant to the error are omitted (NullValueHandling.Ignore).
- Build them via `JsonResults.Problem`, `JsonResults.BadRequest`, `JsonResults.NotFound`, `JsonResults.Conflict`, `JsonResults.UnprocessableEntity`, `JsonResults.TooManyRequests`, `JsonResults.Unauthorized`. Never new up `ProblemDetails` inline.
- 401 carries `WWW-Authenticate: Bearer`.
- 429 carries `Retry-After`; the rate limiter's `OnRejected` sets it.
- A top-of-pipeline `ProblemJsonExceptionHandler` middleware catches `JsonException` (malformed body → 400), `BadHttpRequestException` (Kestrel parse errors → its status), and everything else → 500. In Development the 500 body carries the full exception; in Production it carries only `"An unexpected error occurred."`.

## Serialization

- Newtonsoft.Json on the wire. `CamelCasePropertyNamesContractResolver` for the response side. Newtonsoft's case-insensitive deserialize means existing PascalCase SDK consumers continue to bind.
- Wire shape is camelCase. DTOs are PascalCase records with `From(...)` static factories.

## Auth

Three schemes coexist; pick the right one per surface:

| Surface                                | Scheme                                       | Notes |
| :------------------------------------- | :------------------------------------------- | :---- |
| Programmatic write APIs (e.g. `/api/apps/**`) | `[ApiKeyAuthorize]` + `[BypassCsrf]`            | Pre-shared bearer keys array; SHA-256 of the token is the rate-limit + idempotency partition key. |
| Ingestion endpoints (e.g. `/api/problems` write) | `[ProblemsApiKeyAuthorize]` + `[BypassCsrf]` | Single pre-shared bearer key. |
| Browser-facing reads + admin            | Custom `SessionAuthHandler` cookie scheme    | Established by `POST /api/auth/login`; signed-cookie session id. Double-submit CSRF via `CsrfFilter` against `bump_csrf` cookie + `X-Bump-Csrf` header. JWT signing for tokens that escape the cookie (password-reset links, etc.). |

Passwords: Argon2id via `Konscious.Security.Cryptography.Argon2`. TOTP: `Otp.NET`. Recovery codes hashed at rest. Sessions stored in DB with sliding expiry.

## Idempotency

- `[Idempotent]` on every POST that mutates state and could be safely retried.
- Filter is registered as a singleton service filter (`IAsyncResourceFilter`). It buffers the request body, SHA-256s it, hashes the bearer token, and looks up `(api_key_hash, idempotency_key)`. Match + same body → replay cached response with `Idempotent-Replayed: true`. Match + different body → 422. No match → run the action, cache the 2xx response.
- Cached rows live 24h; the worker sweeps them.
- Reuse with a different body returns `422 Unprocessable Entity`.

## Rate limiting

- One static `RateLimiting` class exposes `AddBumpRateLimiting()` (call it once in `Program.cs`) and policy-name constants (`AppsPolicy`, `ProblemsPolicy`, `AuthPolicy`, `AuthLoginPolicy`, `StatusPolicy`, `SubscribePolicy`).
- Per-bearer-key partitioning for authenticated surfaces; per-IP for unauthenticated (`/auth/login`, `/subscribers`, `/status`). Fixed-window limiter.
- Auth-login window is 5 attempts per 15 minutes per IP. Per-account lockout in the auth controller is the complement.
- Rejection emits `application/problem+json` with `Retry-After`. Limits are documented in the README.

## Input limits

- `[RequestSizeLimit(Limits.<Surface>BodyBytes)]` on every POST/PATCH. Constants live in a single `Limits` static class.
- Slug regex: `^[a-z0-9]+(-[a-z0-9]+)*$`, max 50 chars. Out-of-range or invalid input returns 422.
- String column widths in `db/*.sql` are the source of truth; DTO validation enforces them.

## SSRF protection

Any feature that fetches user-supplied URLs (uptime probes, webhook delivery, oEmbed) re-resolves DNS at connect time and rejects private/loopback/link-local/CGNAT/ULA/multicast addresses. Auto-redirect off so a 30x cannot bypass the guard. URL validation at create time is best-effort because DNS can change.

## Migrations

The API runs SQL migrations at boot. See `postgres-dapper-migrations` for schema + Migrator details.

## Background work

- A separate `Bump.Worker` project, `<Project Sdk="Microsoft.NET.Sdk.Worker">`, hosts long-running background services as `BackgroundService` subclasses.
- The API owns migrations; the worker assumes the API has already migrated. The worker logs and exits non-zero if its expected schema isn't present.
- Health: the worker writes a heartbeat row; the API's `/api/health` flips unhealthy after `3 × PollMinutes` without a tick.

## Swagger

- One `SwaggerDoc("v1", ...)` with a markdown description of the auth + idempotency + rate-limit story.
- One Bearer security scheme (`Type = Http, Scheme = "bearer", BearerFormat = "Opaque"`) plus `AddSecurityRequirement`. The "Authorize" button takes the raw key (no `Bearer ` prefix).
- `OperationFilter<IdempotencyKeyOperationFilter>()` documents the optional header on every `[Idempotent]` action.
- `IncludeXmlComments(includeControllerXmlComments: true)` — controller `<summary>` lines drive operation summaries.

## What not to do

- No minimal APIs in new endpoints. MVC controllers carry the attribute surface (`[ProducesResponseType]`, `[Idempotent]`, `[EnableRateLimiting]`) the rest of the system depends on.
- No `IExceptionFilter`/`IExceptionHandler` — middleware (`ProblemJsonExceptionHandler`) is the single error edge.
- No `Ok(value)` / `BadRequest(error)` from `ControllerBase`. Always go through `JsonResults.*` → `.AsAction()` so the wire shape is uniform.
- No EF Core in new APIs.
- No `Console.WriteLine` in pipeline code. Serilog.
