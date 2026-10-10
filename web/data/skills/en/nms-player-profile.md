# NMS Player Profile

## Purpose

Manipulate player skin (texture) properties through NMS `GameProfile` for NPC appearance injection, fake player entity skins, and custom skull head display.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with trailing `// @1.21.11:` comments)
- Paperweight userdev 2.0.0-beta.24+
- Official Mojang names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### ProfileBuilder.java

```java
// Copy the profile from an existing player
GameProfile profile = ProfileBuilder.copyFrom(player);

// Build a custom profile from a Base64 texture
GameProfile custom = ProfileBuilder.withSkin("NpcName", textureValue, signature);
```

### SkinFetcher.java (async fetch)

```java
SkinFetcher.fetchByName(plugin, "Notch").thenAccept(profile -> {
    Bukkit.getScheduler().runTask(plugin, () -> spawnNpc(location, profile));
});
```

---

## Thread Safety

- `ProfileBuilder` is pure data manipulation and can be called from any thread
- After fetching a skin, switch back to the main thread to apply it to the NPC entity
