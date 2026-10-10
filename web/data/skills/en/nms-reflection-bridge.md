# NMS Reflection Bridge

## Purpose

Provide NMS access that does not depend on Paperweight userdev, using Java reflection with cached `MethodHandle`s for cross-version compatibility. Suited to plugins released across multiple MC versions.

> If you only need a single version, prefer the native Paperweight API (simpler and type-safe).

---

## Platform Requirements

- Paper 1.20.5+ (uses Mojang mappings natively, no remap needed)
- No Paperweight compile dependency
- Only `paper-api` or `spigot-api` is required

---

## Generated Code

### MethodHandleCache.java

```java
public final class MethodHandleCache {
    private static final Map<String, MethodHandle> METHOD_CACHE = new ConcurrentHashMap<>();

    public static MethodHandle method(Class<?> owner, String name, Class<?>... params) {
        return METHOD_CACHE.computeIfAbsent(key, k -> {
            Method m = owner.getDeclaredMethod(name, params);
            m.setAccessible(true);
            return LOOKUP.unreflect(m);
        });
    }

    public static MethodHandle fieldGetter(Class<?> owner, String name) {
        // Similar to method(), returns a field getter handle
    }
}
```

### NmsBridge.java

```java
// Get the NMS ServerPlayer
Object nmsPlayer = NmsBridge.getHandle(player);

// Send a packet (calls connection.send via reflection)
NmsBridge.sendPacket(player, nmsPacket);

// Create an NMS object dynamically
Object packet = NmsBridge.newInstance("net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket");
```

---

## Thread Safety

- `MethodHandleCache` uses `ConcurrentHashMap` and is thread-safe
- `MethodHandle` itself is thread-safe and can be reused across threads
- NMS methods invoked via reflection must still follow the main thread rules
