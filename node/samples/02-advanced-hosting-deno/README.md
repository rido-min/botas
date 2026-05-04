# Advanced Hosting — Deno

**Category:** 2 — Advanced Hosting  
**Language:** Deno  
**Complexity:** Intermediate

## What This Sample Demonstrates

- Using botas-core with **Deno's native HTTP server** for full web server control
- Custom auth middleware pattern for Deno
- That botas-core is web server agnostic — works with any runtime

## Prerequisites

- Deno 2+
- No Azure credentials needed for local testing

## Run

```bash
deno run --allow-net --allow-env --allow-read --allow-sys main.ts
```

## Key Files

- `main.ts` — Deno native HTTP server with botas-core integration

## Learn More

- [Deno docs](https://deno.land/)
- [Other hosting samples](../) — Express, Hono, Koa, Deno
