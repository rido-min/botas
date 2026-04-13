# Turn Context Spec

**Purpose**: Define the `TurnContext` abstraction that simplifies handler and middleware authoring.  
**Status**: Draft

---

## Problem

Today, handlers receive a raw `CoreActivity` and must manually construct replies:

```ts
bot.on('message', async (activity) => {
  const reply = new CoreActivityBuilder()
    .withConversationReference(activity)
    .withText(`You said: ${activity.text}`)
    .build()
  await bot.sendActivityAsync(activity.serviceUrl, activity.conversation.id, reply)
})
```

This requires importing `CoreActivityBuilder`, knowing to call `withConversationReference`, and passing `serviceUrl`/`conversationId` explicitly. The same applies to middleware, which receives `(app, activity, next)` as three separate arguments.

## Solution

Introduce a `TurnContext` object that bundles the incoming activity, the bot application, and a scoped `send()` method into a single handler argument.

```ts
bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})
```

---

## TurnContext Interface

```ts
interface TurnContext {
  /** The incoming activity being processed. */
  readonly activity: CoreActivity

  /** The BotApplication instance processing this turn. */
  readonly app: BotApplication

  /**
   * Send a reply to the conversation that originated this turn.
   *
   * Accepts either a plain text string (sent as a message activity) or
   * a partial CoreActivity for full control over the reply payload.
   *
   * Routing fields (serviceUrl, conversation, from, recipient) are
   * automatically populated from the incoming activity.
   */
  send(activityOrText: string | Partial<CoreActivity>): Promise<ResourceResponse | undefined>

  /**
   * Send a typing indicator to show the bot is composing a reply.
   *
   * Typing indicators are ephemeral presence signals, not persistent messages.
   * Routing fields are automatically populated from the incoming activity.
   */
  sendTyping(): Promise<void>
}
```

### `send()` Behavior

When called with a **string**:
1. Creates a new activity with `type: 'message'` and `text` set to the string.
2. Copies routing fields from the incoming activity using `CoreActivityBuilder.withConversationReference()`.
3. Sends via `conversationClient.sendCoreActivityAsync()`.

When called with a **`Partial<CoreActivity>`**:
1. Merges the provided fields with routing fields from the incoming activity.
2. The caller's fields take precedence over auto-populated routing fields.
3. Sends via `conversationClient.sendCoreActivityAsync()`.

Returns the `ResourceResponse` from the Bot Framework (contains the new activity ID), or `undefined` if the send was skipped (e.g. trace activities).

### `sendTyping()` Behavior

Creates and sends a typing activity with:
1. `type: 'typing'`
2. Routing fields copied from the incoming activity (same as `send()`)
3. No text or other content fields

Returns `Promise<void>` on success. Typing activities are ephemeral signals; callers don't need the activity ID.

### Constraints

- `send()` is only valid during the lifetime of the turn (i.e. while the handler or middleware is executing).
- Multiple calls to `send()` within a single turn are allowed (e.g. sending multiple replies).
- `send()` from middleware is allowed both before and after calling `next()`.
- `sendTyping()` follows the same lifetime and middleware constraints.

---

## Handler Signature Change

```ts
// Before
type CoreActivityHandler = (activity: CoreActivity) => Promise<void>

// After
type CoreActivityHandler = (context: TurnContext) => Promise<void>
```

This is a breaking change. Acceptable at library version 0.1.x.

---

## Middleware Signature Change

```ts
// Before
interface ITurnMiddleware {
  onTurnAsync(app: unknown, activity: CoreActivity, next: NextTurn): Promise<void>
}

// After
type TurnMiddleware = (context: TurnContext, next: NextTurn) => Promise<void>
```

> The `ITurnMiddleware` interface still exists as a deprecated alias for backward compatibility.

Middleware accesses the activity via `context.activity` and the app via `context.app`. The `send()` method is also available to middleware.

---

## Pipeline Changes

The `BotApplication.runPipelineAsync` method constructs a `TurnContext` once per turn and passes it through the middleware chain and into the handler.

```
HTTP POST /api/messages
  └─ JWT validation
       └─ Parse activity
            └─ Construct TurnContext(app, activity)
                 └─ Middleware[0](context, next)
                      └─ Middleware[1](context, next)
                           └─ Handler(context)
```

The `TurnContext` instance is shared across middleware and the handler within a single turn. This allows middleware to inspect or wrap `send()` calls if needed.

---

## Implementation Notes (Node.js)

### File: `src/turn-context.ts`

- Export the `TurnContext` interface.
- Export a concrete `DefaultTurnContext` class (or just a factory) that implements `send()` using `CoreActivityBuilder` and `ConversationClient`.

### Changes to `bot-application.ts`

- `CoreActivityHandler` type updated.
- `runPipelineAsync(activity)` creates a `TurnContext` and passes it instead of raw activity.
- `handleCoreActivityAsync(context)` calls `handler(context)` instead of `handler(activity)`.

### Changes to `i-turn-middleware.ts`

- `ITurnMiddleware` interface deprecated; new `TurnMiddleware` function type: `(context: TurnContext, next: NextTurn) => Promise<void>`.
- `ITurnMiddleware` kept as a deprecated alias for backward compatibility.

### Exports

- `TurnContext` added to `index.ts` exports.

---

## Cross-Language Parity

This spec is Node.js-first. Equivalent abstractions for .NET and Python will follow, respecting language idioms:

| Language | Equivalent |
|----------|-----------|
| .NET | `TurnContext` record/class passed to `OnActivity` callback |
| Python | `TurnContext` dataclass passed to handler functions |

---

## Acceptance Criteria

1. Handler receives `TurnContext` with `activity`, `app`, and `send()`.
2. `ctx.send('text')` sends a correctly routed message reply.
3. `ctx.send({ type: 'typing' })` sends a custom activity with auto-populated routing.
4. Middleware receives `TurnContext` and can call `send()` before/after `next()`.
5. Multiple `send()` calls in a single turn all succeed.
6. Existing tests updated and passing.
7. Existing samples updated to use the new signature.
