# NMS Fake Player

## Purpose

Create a fake player that is a real `ServerPlayer` but has no client. Damage, critical hits, knockback, shield blocking, walking, and stepping up ledges all use vanilla logic; the caller only needs to feed input and head rotation each tick.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### FakePlayer.java (only in the `nms/` package)

```java
FakePlayer bot = FakePlayer.spawn(location, "Steve_Bot", challenger);
bot.clearSpawnInvulnerability();

// Every tick (main thread)
bot.look(yaw, pitch);
bot.input(1f, 0f, false, true);   // forward + sprint
bot.attack(target);               // vanilla melee
bot.tick();
```

### BotService.java (Bukkit side)

```java
public Optional<Player> spawn(Location at, String name, Player skinFrom) {
    if (!available) return Optional.empty();
    try {
        FakePlayer bot = FakePlayer.spawn(at, name, skinFrom);
        bots.add(bot);
        return Optional.of(bot.bukkit());
    } catch (LinkageError e) {   // Paper build changed a signature: disable only the bot
        disable(e);
        return Optional.empty();
    }
}
```

---

## Key Techniques

- `EmptyConnection`: drops packets sent to the fake player, keeping only its own knockback velocity, applied on the next tick
- Does not go through the `PlayerList` login flow: no `PlayerJoinEvent` is fired, and the bot is absent from the tab list and `getOnlinePlayers()`
- Before spawning, send player info to everyone (`listed=false`), and resend it to players who join later
- Override `isClientAuthoritative()` so the server computes physics
- Remove the advancement listeners on construction and removal to avoid memory leaks

---

## Thread Safety

- All operations must run on the main thread; `tick()` is called once per server tick
