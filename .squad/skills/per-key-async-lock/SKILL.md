# Skill: Per-key async lock for stateful middleware

Use this pattern when an async workflow must make a multi-step read → mutate → write sequence atomic for one logical entity without serializing unrelated entities.

## Pattern
1. Derive a stable composite key from every scope that can participate in the update.
2. Look up or create an `asyncio.Lock` for that key without awaiting between get and set.
3. Wrap the full critical section with `async with lock`, not just individual storage calls.
4. Let exceptions propagate; `async with` releases the lock and skipped save logic preserves atomic-on-error semantics.
5. Prefer a weak-value or bounded lock map when keys are unbounded.

## Python sketch
```python
import asyncio
import weakref

_locks: weakref.WeakValueDictionary[tuple[str, str], asyncio.Lock] = weakref.WeakValueDictionary()

def get_lock(key: tuple[str, str]) -> asyncio.Lock:
    lock = _locks.get(key)
    if lock is None:
        lock = asyncio.Lock()
        _locks[key] = lock
    return lock

async with get_lock((conversation_key, user_key)):
    loaded = await storage.read(keys)
    await handler()
    await storage.write(changes)
```

## Test heuristic
A regression test should run two `asyncio.gather()` turns for the same key and insert a tiny `await asyncio.sleep(...)` after reading state. Without the lock, both turns read the same old value and the final count is `1`; with the lock, it becomes `2`.
