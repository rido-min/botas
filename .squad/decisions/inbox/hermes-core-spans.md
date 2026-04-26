# Decision: Python Core OTel Spans Implementation

**Date:** 2025-07-25
**Author:** Hermes (Python Dev)
**Status:** Implemented (feat/python-core-spans branch)

## Context

PR 2 requires adding `botas.turn`, `botas.middleware`, and `botas.handler` spans to the Python `BotApplication` pipeline.

## Decision

Used a synchronous `@contextmanager` helper (`_span()`) instead of if/else branching for tracer None checks. This keeps span instrumentation as a single line at each call site while maintaining zero overhead when OTel is not installed.

Also created `tracer_provider.py` in this PR since PR 1 hasn't merged yet — the module is needed for the import.

## Key Details

- `_span()` is a sync context manager wrapping `tracer.start_as_current_span()` — works fine with async code since OTel span start/end are synchronous operations.
- Added `opentelemetry-sdk>=1.20` to dev deps for test infrastructure (SDK v1.41 removed `InMemorySpanExporter`, so tests use a custom `SpanExporter` subclass).
- 7 new OTel tests + all 118 existing tests pass (11 skipped).
