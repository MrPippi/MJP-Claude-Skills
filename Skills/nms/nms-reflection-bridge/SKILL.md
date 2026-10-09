---
name: nms-reflection-bridge
description: "反射式 NMS 存取橋接：避開 CraftBukkit 編譯期依賴（相容 Spigot 的 v1_xx_Rx 套件），透過 reflection 快取取得跨版本相容性 / Reflection-based NMS bridge for cross-version compatibility without Paperweight compile dependency"
---

# NMS Reflection Bridge / NMS 反射橋接器

## 技能名稱 / Skill Name

`nms-reflection-bridge`

## 目的 / Purpose

提供**不依賴 Paperweight userdev** 的 NMS 存取方式，透過 Java reflection + 快取 Method/Field handle，使同一 JAR 可在多個 NMS 版本執行（例如 1.21、1.21.1、1.21.3）。

> 若專案只需單一版本，請使用 Paperweight 的原生 API（`nms-packet-sender` 等）更簡潔。本技能適用於跨版本分發場景。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.20.5+（原生使用 Mojang mappings）
- 不需 Paperweight 編譯依賴
- 僅需 `org.spigotmc:spigot-api` 或 `io.papermc.paper:paper-api`

## 觸發條件 / Triggers

- 「reflection bridge」「反射橋接」「NMS reflection」
- 「跨版本 NMS」「cross-version」「版本無關」
- 「避開 Paperweight」「no paperweight」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.nms` | 產出類別所在 package |
| `bridge_class_name` | `NmsBridge` | 核心反射類 |
| `cache_enabled` | `true` | 是否快取 Method handle |

## 輸出產物 / Outputs

- `NmsBridge.java` — 反射工具核心（含 Method 快取）
- `NmsClasses.java` — NMS 類別名稱常數
- `MethodHandleCache.java` — `java.lang.invoke.MethodHandle` 快取機制

## 代碼範本 / Code Template

### `NmsClasses.java`

```java
package com.example.nms;

/**
 * Mojang-mapped NMS 類別全名常數。
 * Paper 1.20.5+ runtime 原生使用這些名稱，無需 remap。
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
     * 動態取得 CraftBukkit 套件名。
     * Paper 1.20.5+ 為不帶版本號的 "org.bukkit.craftbukkit"；Spigot 與舊版 Paper 為 "org.bukkit.craftbukkit.v1_xx_Rx"。
     */
    public static String craftBukkitPackage() {
        String serverClassName = org.bukkit.Bukkit.getServer().getClass().getName();
        // Paper 1.20.5+: "org.bukkit.craftbukkit.CraftServer"；Spigot: "org.bukkit.craftbukkit.v1_21_R1.CraftServer"
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
            // 逐層往父類查找：例如 send(Packet) 宣告在 ServerCommonPacketListenerImpl，而非 ServerGamePacketListenerImpl
            for (Class<?> c = owner; c != null; c = c.getSuperclass()) {
                try {
                    Method m = c.getDeclaredMethod(name, params);
                    m.setAccessible(true);
                    return LOOKUP.unreflect(m);
                } catch (NoSuchMethodException ignored) {
                    // 繼續查父類
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

    /** 逐層往父類查找欄位（getDeclaredField 不會搜尋父類）。 */
    private static Field findField(Class<?> owner, String name) throws NoSuchFieldException {
        for (Class<?> c = owner; c != null; c = c.getSuperclass()) {
            try {
                Field f = c.getDeclaredField(name);
                f.setAccessible(true);
                return f;
            } catch (NoSuchFieldException ignored) {
                // 繼續查父類
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

    /** 取得 Bukkit Player 對應的 NMS ServerPlayer 物件。 */
    public static Object getHandle(Player player) {
        try {
            MethodHandle handle = MethodHandleCache.method(CRAFT_PLAYER_CLASS, "getHandle");
            return handle.invoke(player);
        } catch (Throwable t) {
            throw new IllegalStateException("getHandle failed", t);
        }
    }

    /** 透過 ServerPlayer 發送 NMS 封包。 */
    public static void sendPacket(Player player, Object packet) {
        try {
            Object serverPlayer = getHandle(player);
            MethodHandle connectionGetter = MethodHandleCache.fieldGetter(SERVER_PLAYER_CLASS, "connection");
            Object connection = connectionGetter.invoke(serverPlayer);
            if (connection == null) return; // 已離線

            MethodHandle sendMethod = MethodHandleCache.method(GAME_LISTENER_CLASS, "send", PACKET_CLASS);
            sendMethod.invoke(connection, packet);
        } catch (Throwable t) {
            throw new IllegalStateException("sendPacket failed", t);
        }
    }

    /** 建立指定類名的 NMS 物件（使用 default constructor）。 */
    public static Object newInstance(String className) {
        try {
            return loadClass(className).getDeclaredConstructor().newInstance();
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException("newInstance failed: " + className, e);
        }
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── nms/
    ├── NmsBridge.java
    ├── NmsClasses.java
    └── MethodHandleCache.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `MethodHandleCache` 使用 `ConcurrentHashMap`，多執行緒安全
- ✅ `MethodHandle` 本身執行緒安全，可跨執行緒重用
- ⚠️ 反射呼叫的方法若非執行緒安全（如 NMS 世界存取），仍需遵守主執行緒規則
- ⚠️ `getHandle()` 應在玩家存活時呼叫，否則可能取到 stale reference

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `ClassNotFoundException: net.minecraft.server.level.ServerPlayer` | Paper < 1.20.5（runtime 仍用 Spigot mappings） | 升級至 Paper 1.20.5+ 或改用 Paperweight |
| `NoSuchMethodException: send` | 方法簽名變更（如新增 optional 參數） | 改用 `getDeclaredMethods()` 迴圈比對 |
| `IllegalAccessException` | JVM module system 阻擋反射 | 在 `build.gradle` 加 `--add-opens java.base/java.lang=ALL-UNNAMED` |
| 效能問題（反射呼叫慢） | 未使用 `MethodHandle` 快取 | 確認所有呼叫走 `MethodHandleCache` |
| CraftBukkit package 錯誤 | hardcode `v1_21_R1`（Paper 1.20.5+ 不存在） | 永遠用 `NmsClasses.craftBukkitPackage()` 動態取得 |
