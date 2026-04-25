# User Stories

> Gherkin-style behavioral scenarios for botas implementations.

**Status:** Draft

---

## US-001: Echo Bot

```
Feature: Bot responds to user messages
  Scenario: Simple message response
    Given a running bot
    When user sends "hello"
    Then bot responds with "you said hello"

  Scenario: Empty message handling
    Given a running bot
    When user sends empty message
    Then bot handles gracefully (no crash)

  Scenario: Authentication
    Given a running bot
    When Bot Service sends activity
    Then JWT token is validated
```

---

## US-002: Proactive Messaging

```
Feature: Bot sends messages outside turn
  Scenario: Send to stored conversation
    Given a stored conversation reference
    When bot sends proactive message
    Then user receives the message

  Scenario: Invalid reference
    Given an invalid conversation reference
    When bot sends message
    Then error is returned
```

---

## US-003: Middleware Pipeline

```
Feature: Custom middleware processes activities
  Scenario: Middleware executes before handler
    Given middleware is registered
    When activity is received
    Then middleware runs before handler

  Scenario: Multiple middleware order
    Given multiple middleware registered
    When activity is received
    Then execute in registration order

  Scenario: Middleware short-circuit
    Given middleware does not call next()
    Then subsequent middleware and handler are skipped
```

---

## US-004: Teams Activity Features

```
Feature: Rich Teams interactions
  Scenario: Adaptive Card
    Given a running bot
    When user sends "cards"
    Then bot replies with an Adaptive Card

  Scenario: Suggested Actions
    Given a running bot
    When user sends "actions"
    Then bot replies with suggested action buttons

  Scenario: Mention
    Given a running bot
    When user sends any other text
    Then bot echoes back with an @mention of sender
```

---

## Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC-001 | Implementation passes all user story acceptance scenarios |
| AC-002 | Protocol-compliant serialization/deserialization |
| AC-003 | JWT validation and OAuth client credentials work |
| AC-004 | Code follows target language idioms |
