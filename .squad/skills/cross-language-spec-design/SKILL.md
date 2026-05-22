# Cross-Language Spec Design

Pattern for designing features that span .NET, Node.js, and Python in the botas codebase.

## When to Use

- Any new feature that must work identically across all three languages
- Porting concepts from a reference implementation (e.g., TeamsAI, Bot Framework SDK)
- API surface decisions that affect behavioral parity

## Process

### 1. Study the Reference

Before designing, understand the source:

```
Reference Implementation
├── Read core interfaces (what contracts does it define?)
├── Read lifecycle (when do operations happen in the pipeline?)
├── Read data structures (what state is stored?)
└── List language-specific adaptations (generics, async, naming)
```

### 2. Map to botas Pipeline

Identify where the feature integrates:

```
HTTP POST /api/messages
  └─ JWT validation
       └─ [NEW: Feature load?]
            └─ Middleware chain
                 └─ Handler dispatch
       └─ [NEW: Feature save?]
```

### 3. Define Behavioral Invariants First

These MUST be identical across all three languages:

- Data formats (JSON structure, key derivation)
- Timing (when operations happen)
- Error conditions (what throws vs. what returns null)
- Default behaviors (what happens when not configured)

### 4. Allow Idiomatic Differences

These MAY differ:

| Concern | Allow Variation |
|---------|-----------------|
| Generics | .NET `Get<T>()` vs Python `get(key, type_)` |
| Async naming | `ReadAsync` vs `read` |
| Null representation | `T?` vs `T | undefined` vs `T | None` |
| Configuration | Constructor vs method chaining |
| Type systems | Interface vs Protocol vs ABC |

### 5. Spec Structure Template

```markdown
# Feature Spec

**Purpose**: One sentence.
**Status**: Proposed | Implemented

## Overview
What problem does this solve? (2-3 paragraphs)

## API Surface (per language)

### .NET
```csharp
// Full interface/class signatures
```

### Node.js
```typescript
// Full interface/type signatures
```

### Python
```python
# Full class/Protocol signatures
```

## Lifecycle in Pipeline
Where does this fit? Show updated pipeline diagram.

## Behavioral Invariants
Numbered list of things that MUST be identical.

## Language-Specific Differences
Table showing intentional variations.

## Serialization
JSON format, round-tripping rules.

## Error Handling
What throws? What returns null?

## Usage Examples
Show equivalent code in all three languages.

## Out of Scope for v1
What's deferred?

## Open Questions
What needs owner decision?
```

### 6. Simplification Strategies

When porting from a complex reference:

| Reference Pattern | Simplification |
|-------------------|----------------|
| Generic type parameters | Non-generic with runtime typing |
| Inheritance hierarchies | Flat interfaces |
| Multiple configuration modes | Single "golden path" |
| Optimistic concurrency | Last-write-wins |
| Plugin architecture | Fixed implementations |

**Rule**: Ship v1 simple; add complexity when users ask for it.

## Examples

- `specs/turn-state.md` — Simplified from TeamsAI State module
- `specs/observability.md` — Unified OTel patterns across languages
- `specs/invoke-activities.md` — Invoke dispatch with cross-language parity

## References

- [specs/README.md](../../specs/README.md) — Language-Specific Intentional Differences table
- [AGENTS.md](../../AGENTS.md) — Behavioral invariants for all languages
