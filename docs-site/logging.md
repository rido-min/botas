---
outline: deep
---

# Logging

botas logs operational events — incoming activities, token acquisition, handler errors — using each language's standard logging framework. You control the verbosity and destination by configuring the logger before your bot starts.

---

## Quick Start

Enable debug logs to see what your bot is doing:

::: code-group
```json [.NET (appsettings.json)]
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Botas": "Debug"         // ← all botas components at Debug level
    }
  }
}
```

```bash [Node.js (environment)]
# Enable all botas logs
DEBUG=botas:* node index.js

# Or just errors and warnings
DEBUG=botas:error,botas:warn node index.js
```

```python [Python (code)]
import logging

logging.basicConfig(
    level=logging.DEBUG,      # ← show all levels including botas.* loggers
    format="%(levelname)s %(name)s: %(message)s"
)
```
:::

---

## .NET Logging

botas uses ASP.NET Core's `ILogger<T>` for all logging. The `BotApp.Create(args)` helper wires up dependency injection automatically so `ILogger` is injected into `BotApplication`.

### Log levels

| Level | When botas logs |
|-------|----------------|
| **Trace** | Received activity type and payload details |
| **Information** | Started bot listener, finished processing activity |
| **Error** | Error processing activity (includes exception) |

### Configure via `appsettings.json`

```json
{
  "$schema": "https://json.schemastore.org/appsettings.json",
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Botas": "Information"      // ← all botas namespaces
    }
  }
}
```

### Configure via `launchSettings.json`

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "local": {
      "commandName": "Project",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "Logging__LogLevel__Botas": "Debug"   // ← override for development
      }
    }
  }
}
```

### Configure with code

If you're not using `BotApp`, configure logging when building your `WebApplication`:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddConsole();
builder.Logging.SetMinimumLevel(LogLevel.Debug);    // ← global minimum
builder.Services.AddBotApplication<BotApplication>();
```

For more details, see the [ASP.NET Core logging docs](https://learn.microsoft.com/aspnet/core/fundamentals/logging/).

---

## Node.js Logging

botas defines a minimal `Logger` interface with five levels: `trace`, `debug`, `info`, `warn`, `error`. Three built-in loggers are available, or you can implement the `Logger` interface to integrate with pino, winston, etc.

### Built-in loggers

| Logger | Description |
|--------|-------------|
| **`debugLogger`** (default) | Uses the [`debug`](https://www.npmjs.com/package/debug) package with `botas:*` namespaces. Enable via `DEBUG=botas:*`. |
| **`consoleLogger`** | Writes to `console` with a level prefix (`[INFO]`, `[ERROR]`, etc.). |
| **`noopLogger`** | Discards all messages (useful in tests). |

### Log levels

Each level maps to a separate `debug` namespace so you can filter precisely:

```bash
DEBUG=botas:*                         # all levels
DEBUG=botas:info,botas:warn,botas:error  # info and above
DEBUG=botas:error                     # errors only
```

### Configure the logger

Call `configure()` once at application startup, **before** creating a `BotApplication`:

::: code-group
```typescript [debugLogger (default)]
import { configure, debugLogger } from 'botas-core'

configure(debugLogger)      // ← optional: debugLogger is the default
```

```typescript [consoleLogger]
import { configure, consoleLogger } from 'botas-core'

configure(consoleLogger)    // ← always logs to console (no DEBUG env var needed)
```

```typescript [noopLogger (tests)]
import { configure, noopLogger } from 'botas-core'

configure(noopLogger)       // ← silence all logs (useful in tests)
```

```typescript [OTel logger]
import { configure, consoleLogger, createOtelLogger } from 'botas-core'

// Use OTel logger when available, fall back to console
configure(createOtelLogger() ?? consoleLogger)
```
:::

### Custom logger (pino, winston, etc.)

Implement the `Logger` interface to integrate with any logging framework:

```typescript
import { configure, type Logger } from 'botas-core'
import pino from 'pino'

const pinoInstance = pino({ level: 'debug' })

const pinoLogger: Logger = {
  trace: (msg, ...args) => pinoInstance.trace(msg, ...args),
  debug: (msg, ...args) => pinoInstance.debug(msg, ...args),
  info: (msg, ...args) => pinoInstance.info(msg, ...args),
  warn: (msg, ...args) => pinoInstance.warn(msg, ...args),
  error: (msg, ...args) => pinoInstance.error(msg, ...args),
}

configure(pinoLogger)
```

### MSAL (token acquisition) logs

MSAL logs are automatically wired through to the botas logger via the token manager. You'll see messages like:

```
[INFO]  Acquired token for https://api.botframework.com/.default (expires in 3599s)
```

---

## Python Logging

botas uses Python's stdlib `logging` module. Each module creates its own logger with `logging.getLogger(__name__)`. Namespaces follow the module path: `botas.bot_auth`, `botas.bot_http_client`, etc.

### Log levels

botas logs at the following levels:

| Level | When botas logs |
|-------|----------------|
| **DEBUG** | Token acquisition, JWKS refresh, HTTP request details |
| **INFO** | Activity received, handler dispatched, response sent |
| **WARNING** | Recoverable issues, unexpected responses |
| **ERROR** | Handler exceptions, auth failures, network errors |

### Configure with `basicConfig`

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,                          # ← show all levels
    format="%(levelname)s %(name)s: %(message)s"  # ← include logger name
)
```

### Configure specific loggers

```python
import logging

# Show debug logs from botas only
logging.getLogger("botas").setLevel(logging.DEBUG)

# Or filter to specific modules
logging.getLogger("botas.bot_auth").setLevel(logging.DEBUG)
logging.getLogger("botas.bot_http_client").setLevel(logging.INFO)
```

### Configure with `dictConfig` (production)

For more control (handlers, formatters, propagation), use `logging.config.dictConfig`:

```python
import logging.config

logging.config.dictConfig({
    "version": 1,
    "formatters": {
        "standard": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
        }
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "standard",
        }
    },
    "loggers": {
        "botas": {
            "level": "INFO",
            "handlers": ["console"],
            "propagate": False,
        }
    }
})
```

For more details, see the [Python logging docs](https://docs.python.org/3/library/logging.html).

---

## What botas logs

### Activity processing

Every incoming activity is logged at **Info** level (**.NET / Node**) or **INFO** (**Python**):

```
INFO: Received activity type=message from=user-id-123
INFO: Handler for 'message' completed in 42ms
```

### Token acquisition (outbound auth)

When botas acquires an OAuth2 token for outbound API calls, you'll see:

```
DEBUG: Acquiring token for https://api.botframework.com/.default
INFO: Token acquired (expires in 3599s)
```

### JWT validation (inbound auth)

When the Bot Service sends a JWT bearer token, botas validates it and logs:

```
DEBUG: Fetching JWKS from https://login.botframework.com/v1/.well-known/openid-configuration
DEBUG: Validating JWT signature with kid=abc123
```

### Errors

Handler exceptions are logged at **Error** level (**.NET / Node**) or **ERROR** (**Python**):

```
ERROR: Error processing activity type=message: ArgumentNullException: Value cannot be null
```

---

## When to use middleware for logging

If you need to log **custom data** (user IDs, conversation IDs, handler latency), use middleware instead of relying on botas's built-in logs:

::: code-group
```csharp [.NET]
using Botas;

public class CustomLoggingMiddleware : ITurnMiddleWare
{
    private readonly ILogger<CustomLoggingMiddleware> _logger;

    public CustomLoggingMiddleware(ILogger<CustomLoggingMiddleware> logger)
    {
        _logger = logger;
    }

    public async Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        var start = DateTime.UtcNow;
        _logger.LogInformation("▶ {Type} from {User}",
            context.Activity.Type, context.Activity.From?.Id);

        await next(cancellationToken);

        var duration = (DateTime.UtcNow - start).TotalMilliseconds;
        _logger.LogInformation("◀ {Type} completed in {Duration}ms",
            context.Activity.Type, duration);
    }
}
```

```typescript [Node.js]
import { getLogger } from 'botas-core'
import type { TurnMiddleware } from 'botas-express'

const customLoggingMiddleware: TurnMiddleware = async (context, next) => {
  const logger = getLogger()
  const start = Date.now()

  logger.info(`▶ ${context.activity.type} from ${context.activity.from?.id}`)
  await next()

  const duration = Date.now() - start
  logger.info(`◀ ${context.activity.type} completed in ${duration}ms`)
}
```

```python [Python]
import logging
import time
from botas import TurnMiddleware
from botas.turn_context import TurnContext

_logger = logging.getLogger(__name__)

class CustomLoggingMiddleware(TurnMiddleware):
    async def on_turn(self, context: TurnContext, next) -> None:
        start = time.time()
        _logger.info(f"▶ {context.activity.type} from {context.activity.from_.id}")

        await next()

        duration = (time.time() - start) * 1000
        _logger.info(f"◀ {context.activity.type} completed in {duration:.0f}ms")
```
:::

For more on middleware, see the [Middleware guide](middleware).

---

## Troubleshooting

### Logs not appearing (.NET)

Check that `appsettings.json` exists and is set to **Copy to Output Directory** (in your `.csproj`):

```xml
<ItemGroup>
  <Content Include="appsettings.json" CopyToOutputDirectory="PreserveNewest" />
</ItemGroup>
```

### Logs not appearing (Node.js)

If using `debugLogger` (the default), make sure the `DEBUG` environment variable is set:

```bash
DEBUG=botas:* node index.js
```

Or switch to `consoleLogger` to always log to console:

```typescript
import { configure, consoleLogger } from 'botas-core'
configure(consoleLogger)
```

### Logs not appearing (Python)

Call `logging.basicConfig()` **before** creating your bot application:

```python
import logging

logging.basicConfig(level=logging.DEBUG)   # ← call FIRST

from botas_fastapi import BotApp
app = BotApp()
```

### Too many logs

Reduce the log level to show only warnings and errors:

::: code-group
```json [.NET]
{
  "Logging": {
    "LogLevel": {
      "Botas": "Warning"
    }
  }
}
```

```bash [Node.js]
DEBUG=botas:warn,botas:error node index.js
```

```python [Python]
logging.getLogger("botas").setLevel(logging.WARNING)
```
:::

---

## Learn More

- **Middleware**: [Middleware guide](middleware) — write custom logging middleware
- **Authentication**: [Authentication guide](authentication) — what botas logs during JWT validation and token acquisition
- **Architecture**: [specs/architecture.md](https://github.com/rido-min/botas/blob/main/specs/architecture.md) — component diagram and logging touchpoints
