# examples — nms-reflection-bridge

## 範例 1：無 Paperweight 依賴發送封包

**Input:**
```
package_name: com.example.nms
bridge_class_name: NmsBridge
cache_enabled: true
```

**build.gradle（不使用 Paperweight）:**
```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
}
```

**使用端：動態建構並發送 ClientboundSetActionBarTextPacket:**
```java
// 透過反射建構封包
Class<?> packetClass = Class.forName(
    "net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket");
Class<?> componentClass = Class.forName("net.minecraft.network.chat.Component");

// Component.literal("Hello")
Method literalMethod = componentClass.getMethod("literal", String.class);
Object component = literalMethod.invoke(null, "Hello via reflection");

// new ClientboundSetActionBarTextPacket(component)
Object packet = packetClass.getDeclaredConstructor(componentClass).newInstance(component);

// 發送
NmsBridge.sendPacket(player, packet);
```

---

## 範例 2：讀取玩家網路延遲（connection.latency()）

**Input:**
```
package_name: com.example.nms
bridge_class_name: NmsBridge
cache_enabled: true
```

**使用端：取得玩家網路延遲（ms）:**
```java
public static int getLatency(Player player) {
    try {
        Object serverPlayer = NmsBridge.getHandle(player);
        // 1.20.2+ latency 位於 ServerCommonPacketListenerImpl（ServerPlayer.connection 的父類），不在 ServerPlayer
        Object connection = MethodHandleCache.fieldGetter(serverPlayer.getClass(), "connection")
            .invoke(serverPlayer);
        MethodHandle latencyGetter = MethodHandleCache.method(connection.getClass(), "latency");
        return (int) latencyGetter.invoke(connection);
    } catch (Throwable t) {
        return -1;
    }
}
```

---

## 範例 3：快取多個 Method 用於熱路徑

**Input:**
```
package_name: com.example.nms
bridge_class_name: NmsBridge
cache_enabled: true
```

**使用端：高頻呼叫場景（每 tick 更新玩家）:**
```java
public class PacketHotpath {

    private static final Class<?> PACKET_CLASS = loadClass("net.minecraft.network.protocol.Packet");
    private static final Class<?> GAME_LISTENER = loadClass(
        "net.minecraft.server.network.ServerGamePacketListenerImpl");
    private static final Class<?> SERVER_PLAYER = loadClass(
        "net.minecraft.server.level.ServerPlayer");

    // 啟動時一次性載入
    private static final MethodHandle SEND = MethodHandleCache.method(
        GAME_LISTENER, "send", PACKET_CLASS);
    private static final MethodHandle CONNECTION_FIELD = MethodHandleCache.fieldGetter(
        SERVER_PLAYER, "connection");

    public static void fastSend(Object serverPlayer, Object packet) throws Throwable {
        Object connection = CONNECTION_FIELD.invoke(serverPlayer);
        if (connection != null) SEND.invoke(connection, packet);
    }
}
```

---

## 範例 4：模組系統開啟反射存取（Java 17+）

**build.gradle 片段:**
```groovy
tasks.withType(JavaCompile).configureEach {
    options.compilerArgs += [
        '--add-exports=java.base/jdk.internal.misc=ALL-UNNAMED'
    ]
}

// Runtime args（若伺服器啟動參數需要）
// --add-opens java.base/java.lang=ALL-UNNAMED
// --add-opens java.base/java.lang.reflect=ALL-UNNAMED
```

**Fallback 流程：當反射失敗時優雅降級:**
```java
public void broadcastActionBar(Component message) {
    try {
        Object packet = buildActionBarPacket(message);
        for (Player p : Bukkit.getOnlinePlayers()) {
            NmsBridge.sendPacket(p, packet);
        }
    } catch (Throwable t) {
        getLogger().warning("NMS reflection failed, falling back to Adventure API");
        // 降級：使用 Bukkit/Adventure API
        for (Player p : Bukkit.getOnlinePlayers()) {
            p.sendActionBar(message);
        }
    }
}
```
