---
name: nms-reflection-bridge
description: "反射式 NMS 存取橋接：避開 CraftBukkit 編譯期依賴（相容 Spigot 的 v1_xx_Rx 套件），透過 reflection 快取取得跨版本相容性 / Reflection-based NMS bridge for cross-version compatibility without Paperweight compile dependency"
---

# NMS Reflection Bridge

## Skill Name

`nms-reflection-bridge`

## Purpose

Provides NMS access that does **not depend on Paperweight userdev**. It uses Java reflection plus cached Method/Field handles so one JAR can run on multiple NMS versions (for example 26.1, 26.2, 26.3).

> If the project targets a single version, the native Paperweight API (`nms-packet-sender` etc.) is simpler. This skill is for cross-version distribution.

## NMS Version Requirements

- Paper 1.20.5+ (natively uses Mojang mappings)
- No Paperweight compile dependency
- Only `org.spigotmc:spigot-api` or `io.papermc.paper:paper-api` is required

## Triggers

- 「reflection bridge」「反射橋接」「NMS reflection」
- 「跨版本 NMS」「cross-version」「版本無關」
- 「避開 Paperweight」「no paperweight」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.nms` | Package that holds the generated classes |
| `bridge_class_name` | `NmsBridge` | Core reflection class |
| `cache_enabled` | `true` | Whether to cache Method handles |

## Outputs

- `NmsBridge.java` — core reflection utility (with Method cache)
- `NmsClasses.java` — NMS class name constants
- `MethodHandleCache.java` — `java.lang.invoke.MethodHandle` cache

## Code Template

### `NmsClasses.java`

```java
package com.example.nms;

/**
 * Fully qualified Mojang-mapped NMS class name constants.
 * The Paper 1.20.5+ runtime uses these names natively, so no remap is needed.
 */
public final class NmsClasses {
    private NmsClasses() {}

    public static final String SERVER_PLAYER = "net.minecraft.server.level.ServerPlayer";
    public static final String SERVER_LEVEL = "net.minecraft.server.level.ServerLevel";
    public static final String SERVER_GAME_PACKET_LISTENER =
        "net.minecraft.server.network.ServerGamePacketListenerImpl";
    public static final String PACKET = "net.minecraft.network.protocol.Packet";
    public static final String CONNECTION = "net.minecraft.network.Connection";
    public static final String MINECRAFT_SERVER = "net.minecraft.server.MinecraftServer";

    /**
     * Resolves the CraftBukkit package name dynamically.
     * Paper 1.20.5+ uses the unversioned "org.bukkit.craftbukkit"; Spigot and older Paper use "org.bukkit.craftbukkit.v1_xx_Rx".
     */
    public static String craftBukkitPackage() {
        String serverClassName = org.bukkit.Bukkit.getServer().getClass().getName();
        // Paper 1.20.5+: "org.bukkit.craftbukkit.CraftServer"; Spigot: "org.bukkit.craftbukkit.v1_21_R1.CraftServer"
        int lastDot = serverClassName.lastIndexOf('.');
        return serverClassName.substring(0, lastDot);
    }
}
```

### `MethodHandleCache.java`

```java
package com.example.nms;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class MethodHandleCache {

    private static final MethodHandles.Lookup LOOKUP = MethodHandles.lookup();
    private static final Map<String, MethodHandle> METHOD_CACHE = new ConcurrentHashMap<>();
    private static final Map<String, MethodHandle> FIELD_GETTER_CACHE = new ConcurrentHashMap<>();
    private static final Map<String, MethodHandle> FIELD_SETTER_CACHE = new ConcurrentHashMap<>();

    private MethodHandleCache() {}

    public static MethodHandle method(Class<?> owner, String name, Class<?>... params) {
        String key = owner.getName() + "#" + name + "#" + paramKey(params);
        return METHOD_CACHE.computeIfAbsent(key, k -> {
            // Walk up the superclasses: e.g. send(Packet) is declared in ServerCommonPacketListenerImpl, not ServerGamePacketListenerImpl
            for (Class<?> c = owner; c != null; c = c.getSuperclass()) {
                try {
                    Method m = c.getDeclaredMethod(name, params);
                    m.setAccessible(true);
                    return LOOKUP.unreflect(m);
                } catch (NoSuchMethodException ignored) {
                    // Keep searching the superclass
                } catch (IllegalAccessException e) {
                    throw new IllegalStateException("Method not accessible: " + key, e);
                }
            }
            throw new IllegalStateException("Method not found: " + key);
        });
    }

    public static MethodHandle fieldGetter(Class<?> owner, String name) {
        String key = owner.getName() + "#get#" + name;
        return FIELD_GETTER_CACHE.computeIfAbsent(key, k -> {
            try {
                Field f = findField(owner, name);
                return LOOKUP.unreflectGetter(f);
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException("Field not found: " + key, e);
            }
        });
    }

    public static MethodHandle fieldSetter(Class<?> owner, String name) {
        String key = owner.getName() + "#set#" + name;
        return FIELD_SETTER_CACHE.computeIfAbsent(key, k -> {
            try {
                Field f = findField(owner, name);
                return LOOKUP.unreflectSetter(f);
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException("Field not found: " + key, e);
            }
        });
    }

    /** Walks up the superclasses to find the field (getDeclaredField does not search superclasses). */
    private static Field findField(Class<?> owner, String name) throws NoSuchFieldException {
        for (Class<?> c = owner; c != null; c = c.getSuperclass()) {
            try {
                Field f = c.getDeclaredField(name);
                f.setAccessible(true);
                return f;
            } catch (NoSuchFieldException ignored) {
                // Keep searching the superclass
            }
        }
        throw new NoSuchFieldException(owner.getName() + "#" + name);
    }

    private static String paramKey(Class<?>... params) {
        StringBuilder sb = new StringBuilder();
        for (Class<?> p : params) sb.append(p.getName()).append(',');
        return sb.toString();
    }
}
```

### `NmsBridge.java`

```java
package com.example.nms;

import java.lang.invoke.MethodHandle;
import org.bukkit.entity.Player;

public final class NmsBridge {

    private NmsBridge() {}

    private static final Class<?> SERVER_PLAYER_CLASS = loadClass(NmsClasses.SERVER_PLAYER);
    private static final Class<?> PACKET_CLASS = loadClass(NmsClasses.PACKET);
    private static final Class<?> GAME_LISTENER_CLASS = loadClass(NmsClasses.SERVER_GAME_PACKET_LISTENER);
    private static final Class<?> CRAFT_PLAYER_CLASS =
        loadClass(NmsClasses.craftBukkitPackage() + ".entity.CraftPlayer");

    private static Class<?> loadClass(String name) {
        try {
            return Class.forName(name);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("NMS class not found: " + name, e);
        }
    }

    /** Gets the NMS ServerPlayer object for a Bukkit Player. */
    public static Object getHandle(Player player) {
        try {
            MethodHandle handle = MethodHandleCache.method(CRAFT_PLAYER_CLASS, "getHandle");
            return handle.invoke(player);
        } catch (Throwable t) {
            throw new IllegalStateException("getHandle failed", t);
        }
    }

    /** Sends an NMS packet through the ServerPlayer. */
    public static void sendPacket(Player player, Object packet) {
        try {
            Object serverPlayer = getHandle(player);
            MethodHandle connectionGetter = MethodHandleCache.fieldGetter(SERVER_PLAYER_CLASS, "connection");
            Object connection = connectionGetter.invoke(serverPlayer);
            if (connection == null) return; // Already offline

            MethodHandle sendMethod = MethodHandleCache.method(GAME_LISTENER_CLASS, "send", PACKET_CLASS);
            sendMethod.invoke(connection, packet);
        } catch (Throwable t) {
            throw new IllegalStateException("sendPacket failed", t);
        }
    }

    /** Creates an NMS object of the given class name (using the default constructor). */
    public static Object newInstance(String className) {
        try {
            return loadClass(className).getDeclaredConstructor().newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("newInstance failed: " + className, e);
        }
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── nms/
    ├── NmsBridge.java
    ├── NmsClasses.java
    └── MethodHandleCache.java
```

## Thread Safety

- ✅ `MethodHandleCache` uses `ConcurrentHashMap`, so it is thread-safe
- ✅ `MethodHandle` itself is thread-safe and can be reused across threads
- ⚠️ If the reflected method is not thread-safe (such as NMS world access), the main thread rules still apply
- ⚠️ Call `getHandle()` while the player is online, otherwise you may get a stale reference

## Fallback

| Error | Cause | Fix |
|------|------|------|
| `ClassNotFoundException: net.minecraft.server.level.ServerPlayer` | Paper < 1.20.5 (runtime still uses Spigot mappings) | Upgrade to Paper 1.20.5+ or use Paperweight |
| `NoSuchMethodException: send` | Method signature changed (e.g. new optional parameter) | Loop over `getDeclaredMethods()` and match manually |
| `IllegalAccessException` | JVM module system blocks reflection | Add `--add-opens java.base/java.lang=ALL-UNNAMED` in `build.gradle` |
| Performance problems (slow reflective calls) | `MethodHandle` cache not used | Make sure every call goes through `MethodHandleCache` |
| Wrong CraftBukkit package | Hardcoded `v1_21_R1` (does not exist on Paper 1.20.5+) | Always resolve it with `NmsClasses.craftBukkitPackage()` |
