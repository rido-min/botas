# Node.js API Reference

API reference for the **botas** Node.js/TypeScript library, extracted from TypeScript types and JSDoc comments in [`node/packages/botas/src/`](https://github.com/rido-min/botas/tree/main/node/packages/botas/src).

**Package:** `botas` (npm)  
**Entry point:** `import { BotApplication, ... } from 'botas'`

---

## BotApplication

Central bot class that manages the middleware pipeline, handler dispatch, and outbound messaging.

```typescript
class BotApplication
```

### Constructor

```typescript
new BotApplication(options?: BotApplicationOptions)
```

Options are resolved from environment variables (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`) when not provided.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `version` | `static readonly string` | SDK version string. |
| `options` | `readonly BotApplicationOptions` | Resolved configuration. |
| `conversationClient` | `readonly ConversationClient` | Client for outbound API calls. |
| `onActivity` | `CoreActivityHandler \| undefined` | Catch-all handler (legacy API). |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `on` | `on(type: string, handler: CoreActivityHandler): this` | Register a handler for a specific activity type. |
| `use` | `use(middleware: TurnMiddleware): this` | Add middleware to the pipeline. |
| `onInvoke` | `onInvoke(name: string, handler: InvokeActivityHandler): this` | Register a named invoke handler. |
| `processAsync` | `processAsync(req: IncomingMessage, res: ServerResponse): Promise<void>` | HTTP request entry point — reads body, validates auth, processes activity. |
| `processBody` | `processBody(body: string): Promise<InvokeResponse \| undefined>` | Process a raw JSON body without HTTP response handling. |
| `sendActivityAsync` | `sendActivityAsync(serviceUrl: string, conversationId: string, activity: Partial<CoreActivity>): Promise<ResourceResponse \| undefined>` | Send a proactive activity to a conversation. |

---

## BotApplicationOptions

Configuration options for `BotApplication`. Extends `TokenManagerOptions`.

```typescript
interface BotApplicationOptions extends TokenManagerOptions
```

All fields are optional — values resolve from environment variables when omitted.

| Field | Type | Env Variable | Description |
|-------|------|-------------|-------------|
| `clientId` | `string?` | `CLIENT_ID` | Azure AD app/client ID. |
| `clientSecret` | `string?` | `CLIENT_SECRET` | Azure AD client secret. |
| `tenantId` | `string?` | `TENANT_ID` | Azure AD tenant ID. |
| `managedIdentityClientId` | `string?` | `MANAGED_IDENTITY_CLIENT_ID` | Managed identity client ID. |
| `token` | `(scope, tenantId) => Promise<string>` | — | Custom token provider. |

---

## TurnContext

Per-turn context passed to handlers and middleware.

```typescript
interface TurnContext
```

| Member | Type | Description |
|--------|------|-------------|
| `activity` | `CoreActivity` | The incoming activity for this turn. |
| `app` | `BotApplication` | The bot application processing this turn. |
| `send` | `(activityOrText: string \| Partial<CoreActivity>) => Promise<ResourceResponse \| undefined>` | Reply with text or a full activity. |
| `sendTyping` | `() => Promise<void>` | Send a typing indicator. |

---

## ConversationClient

Typed client for the Bot Framework Conversation REST API.

```typescript
class ConversationClient
```

### Constructor

```typescript
new ConversationClient(getToken?: TokenProvider)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `sendCoreActivityAsync` | `(serviceUrl, conversationId, activity) => Promise<ResourceResponse \| undefined>` | Send an activity to a conversation. |
| `updateCoreActivityAsync` | `(serviceUrl, conversationId, activityId, activity) => Promise<ResourceResponse \| undefined>` | Update an existing activity. |
| `deleteCoreActivityAsync` | `(serviceUrl, conversationId, activityId) => Promise<void>` | Delete an activity. |
| `getConversationMembersAsync` | `(serviceUrl, conversationId) => Promise<ChannelAccount[]>` | List conversation members. |
| `getConversationMemberAsync` | `(serviceUrl, conversationId, memberId) => Promise<ChannelAccount \| undefined>` | Get a single member. |
| `getConversationPagedMembersAsync` | `(serviceUrl, conversationId, pageSize?, continuationToken?) => Promise<PagedMembersResult<ChannelAccount>>` | Get members with pagination. |
| `deleteConversationMemberAsync` | `(serviceUrl, conversationId, memberId) => Promise<void>` | Remove a member. |
| `createConversationAsync` | `(serviceUrl, parameters) => Promise<ConversationResourceResponse \| undefined>` | Create a proactive conversation. |
| `getConversationsAsync` | `(serviceUrl, continuationToken?) => Promise<ConversationsResult>` | List conversations. |
| `sendConversationHistoryAsync` | `(serviceUrl, conversationId, transcript) => Promise<ResourceResponse \| undefined>` | Upload a conversation transcript. |
| `getConversationAsync` | `(serviceUrl, conversationId) => Promise<Conversation \| undefined>` | Get conversation details. |

---

## CoreActivity

Bot Framework activity payload interface.

```typescript
interface CoreActivity
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Activity type (e.g. `"message"`, `"typing"`). |
| `serviceUrl` | `string` | Bot Framework service URL for replies. |
| `from` | `ChannelAccount` | Sender account. |
| `recipient` | `ChannelAccount` | Recipient account. |
| `conversation` | `Conversation` | Conversation reference. |
| `text` | `string?` | Text content. |
| `name` | `string?` | Activity name (for invoke/event). |
| `value` | `unknown?` | Activity value payload. |
| `entities` | `Entity[]?` | Entity metadata (mentions, etc.). |
| `attachments` | `Attachment[]?` | File/card attachments. |
| `properties` | `Record<string, unknown>?` | Additional properties (round-trip safe). |

---

## CoreActivityBuilder

Fluent builder for constructing outbound `CoreActivity` instances.

```typescript
class CoreActivityBuilder
```

| Method | Returns | Description |
|--------|---------|-------------|
| `withConversationReference(source)` | `this` | Copy conversation reference from a source activity. |
| `withType(type)` | `this` | Set the activity type. |
| `withServiceUrl(serviceUrl)` | `this` | Set the service URL. |
| `withConversation(conversation)` | `this` | Set the conversation. |
| `withFrom(from)` | `this` | Set the sender. |
| `withRecipient(recipient)` | `this` | Set the recipient. |
| `withText(text)` | `this` | Set the text content. |
| `withEntities(entities)` | `this` | Set entities. |
| `withAttachments(attachments)` | `this` | Set attachments. |
| `build()` | `Partial<CoreActivity>` | Build the activity. |

---

## ActivityType

Constants for known Bot Framework activity types.

```typescript
const ActivityType: {
  Message: 'message'
  Typing: 'typing'
  Event: 'event'
  Invoke: 'invoke'
  InvokeResponse: 'invokeResponse'
  ConversationUpdate: 'conversationUpdate'
  MessageUpdate: 'messageUpdate'
  MessageDelete: 'messageDelete'
  MessageReaction: 'messageReaction'
  InstallationUpdate: 'installationUpdate'
  HandOff: 'handoff'
  Trace: 'trace'
  EndOfConversation: 'endOfConversation'
  Command: 'command'
  CommandResult: 'commandResult'
}
```

---

## ChannelAccount

Represents a user or bot account on a channel.

```typescript
interface ChannelAccount
```

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Account identifier. |
| `name` | `string?` | Display name. |
| `aadObjectId` | `string?` | Azure AD object ID. |
| `role` | `string?` | Account role. |
| `properties` | `Record<string, unknown>?` | Extension properties. |

---

## TeamsChannelAccount

Teams-specific channel account with email and UPN.

```typescript
interface TeamsChannelAccount extends ChannelAccount
```

| Property | Type | Description |
|----------|------|-------------|
| `userPrincipalName` | `string?` | Azure AD user principal name. |
| `email` | `string?` | Email address. |

---

## Conversation

Conversation reference.

```typescript
interface Conversation
```

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Conversation identifier. |

---

## Entity

Bot Framework entity metadata.

```typescript
interface Entity
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Entity type (e.g. `"mention"`). |

Supports index signature for additional properties.

---

## Attachment

File or card attachment.

```typescript
interface Attachment
```

| Property | Type | Description |
|----------|------|-------------|
| `contentType` | `string` | MIME type. |
| `contentUrl` | `string?` | URL to content. |
| `content` | `unknown?` | Inline content (e.g. Adaptive Card JSON). |
| `name` | `string?` | Attachment name. |
| `thumbnailUrl` | `string?` | Thumbnail URL. |

---

## SuggestedActions & CardAction

### CardAction

```typescript
interface CardAction
```

| Property | Type | Description |
|----------|------|-------------|
| `type` | `string` | Action type (e.g. `"imBack"`, `"openUrl"`). |
| `title` | `string?` | Button text. |
| `value` | `string?` | Value sent on click. |
| `text` | `string?` | Text sent to bot. |
| `displayText` | `string?` | Text shown in chat. |
| `image` | `string?` | Icon URL. |

### SuggestedActions

```typescript
interface SuggestedActions
```

| Property | Type | Description |
|----------|------|-------------|
| `to` | `string[]?` | Recipient IDs. |
| `actions` | `CardAction[]` | Action buttons. |

---

## TeamsActivity

Teams-specific activity with channel data and helpers.

```typescript
interface TeamsActivity extends CoreActivity
```

### Additional Properties

| Property | Type | Description |
|----------|------|-------------|
| `channelData` | `TeamsChannelData?` | Teams-specific channel data. |
| `timestamp` | `string?` | Activity timestamp. |
| `localTimestamp` | `string?` | Local timestamp. |
| `locale` | `string?` | User locale. |
| `localTimezone` | `string?` | User timezone. |
| `suggestedActions` | `SuggestedActions?` | Suggested actions. |

### Static Methods

| Method | Description |
|--------|-------------|
| `TeamsActivity.fromActivity(activity: CoreActivity)` | Shallow copy cast to `TeamsActivity`. |

---

## TeamsActivityBuilder

Fluent builder for Teams activities with mention, Adaptive Card, and channel data helpers.

```typescript
class TeamsActivityBuilder
```

| Method | Returns | Description |
|--------|---------|-------------|
| `withConversationReference(source)` | `this` | Copy conversation reference. |
| `withType(type)` | `this` | Set activity type. |
| `withServiceUrl(serviceUrl)` | `this` | Set service URL. |
| `withConversation(conversation)` | `this` | Set conversation. |
| `withFrom(from)` | `this` | Set sender. |
| `withRecipient(recipient)` | `this` | Set recipient. |
| `withText(text)` | `this` | Set text. |
| `withChannelData(channelData?)` | `this` | Set channel data. |
| `withSuggestedActions(actions?)` | `this` | Set suggested actions. |
| `withEntities(entities?)` | `this` | Set entities. |
| `withAttachments(attachments?)` | `this` | Set attachments. |
| `addEntity(entity)` | `this` | Append entity. |
| `addAttachment(attachment)` | `this` | Append attachment. |
| `addMention(account, mentionText?)` | `this` | Add @mention entity. |
| `addAdaptiveCardAttachment(card)` | `this` | Append Adaptive Card. |
| `withAdaptiveCardAttachment(card)` | `this` | Replace attachments with Adaptive Card. |
| `build()` | `Partial<TeamsActivity>` | Build the activity. |

---

## TeamsChannelData

Teams-specific channel data.

```typescript
interface TeamsChannelData
```

| Property | Type | Description |
|----------|------|-------------|
| `tenant` | `TenantInfo?` | Tenant info. |
| `channel` | `ChannelInfo?` | Channel info. |
| `team` | `TeamInfo?` | Team info. |
| `meeting` | `MeetingInfo?` | Meeting info. |
| `notification` | `NotificationInfo?` | Notification settings. |

---

## Middleware

### TurnMiddleware

```typescript
type TurnMiddleware = (context: TurnContext, next: NextTurn) => Promise<void>
type NextTurn = () => Promise<void>
```

A function that participates in the turn pipeline. Call `next()` to continue, or skip it to short-circuit.

### removeMentionMiddleware

```typescript
function removeMentionMiddleware(): TurnMiddleware
```

Returns middleware that strips the bot's own `@mention` text from incoming messages.

---

## Authentication

### validateBotToken

```typescript
function validateBotToken(authHeader: string | undefined, appId?: string): Promise<void>
```

Validates the inbound JWT bearer token against Bot Framework issuers and JWKS endpoints. Throws `BotAuthError` on failure.

### validateServiceUrl

```typescript
function validateServiceUrl(serviceUrl: string): void
```

Validates the service URL against the Bot Framework allowlist. Throws `BotAuthError` for disallowed URLs.

### BotAuthError

```typescript
class BotAuthError extends Error
```

Thrown on authentication or token validation failure. HTTP layer should return 401.

---

## TokenManager

Acquires and caches OAuth2 client-credentials tokens for outbound Bot Framework API calls.

```typescript
class TokenManager
```

### Constructor

```typescript
new TokenManager(options?: TokenManagerOptions)
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `getBotToken` | `() => Promise<string \| null>` | Get cached/fresh bot token. Returns `null` when auth is not configured. |

---

## Error Types

### BotHandlerException

```typescript
class BotHandlerException extends Error
```

Wraps exceptions thrown inside activity handlers with the originating activity.

| Property | Type | Description |
|----------|------|-------------|
| `cause` | `unknown` | Original exception. |
| `activity` | `CoreActivity` | Activity being processed. |

### RequestBodyTooLargeError

```typescript
class RequestBodyTooLargeError extends Error
```

Thrown when the request body exceeds 1 MB.

---

## Logger

Configurable logging interface used internally.

```typescript
interface Logger {
  trace(message: string, ...args: unknown[]): void
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
```

| Export | Description |
|--------|-------------|
| `noopLogger` | Silent logger (default). |
| `debugLogger` | Uses the `debug` package with `botas:*` namespace. |
| `consoleLogger` | Logs to `console.*`. |
| `configure(logger)` | Set the global logger. |

---

## Utility Types

### InvokeResponse

```typescript
interface InvokeResponse {
  status: number
  body?: unknown
}
```

### ResourceResponse

```typescript
interface ResourceResponse {
  id: string
}
```

### ConversationResourceResponse

```typescript
interface ConversationResourceResponse extends ResourceResponse {
  serviceUrl: string
  activityId: string
}
```

### PagedMembersResult&lt;T&gt;

```typescript
interface PagedMembersResult<T> {
  members: T[]
  continuationToken?: string
}
```

### BotHttpClient

Low-level authenticated HTTP client for Bot Framework REST calls.

```typescript
class BotHttpClient {
  constructor(getToken?: TokenProvider)
  send<T>(method, url, body?, options?): Promise<T | undefined>
  get<T>(baseUrl, endpoint, params?, options?): Promise<T | undefined>
  post<T>(baseUrl, endpoint, body?, options?, params?): Promise<T | undefined>
  put<T>(baseUrl, endpoint, body?, options?, params?): Promise<T | undefined>
  delete(baseUrl, endpoint, params?, options?): Promise<void>
}
```

---

See also: [Node.js Language Guide](/languages/nodejs) · [Getting Started](/getting-started) · [Source on GitHub](https://github.com/rido-min/botas/tree/main/node/packages/botas/src)
