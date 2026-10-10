# NMS NBT Manipulation

## Purpose

Read and write NBT data on items, entities, and block entities directly through NMS `CompoundTag`, bypassing the limits of the Bukkit PersistentDataContainer API for low-level persistence and data manipulation.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with trailing `// @1.21.11:` comments)
- Paperweight userdev 2.0.0-beta.24+
- Official Mojang names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### ItemNbtHelper.java

```java
// Read string NBT
Optional<String> getString(ItemStack item, String key)

// Write string NBT (returns an immutable copy)
ItemStack setString(ItemStack item, String key, String value)

// Read integer NBT
int getInt(ItemStack item, String key, int def)

// Write integer NBT
ItemStack setInt(ItemStack item, String key, int value)
```

### EntityNbtHelper.java

```java
// Read the entity's full CompoundTag
CompoundTag getTag(Entity entity)

// Merge a patch into the entity's NBT
void mergeTag(Entity entity, CompoundTag patch)
```

---

## Thread Safety

- `ItemNbtHelper` operates on an NMS copy and can be called from any thread
- `EntityNbtHelper` accesses entity state and **must be called on the main thread**
