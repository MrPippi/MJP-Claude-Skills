# examples — nms-reflection-bridge

## Example 1: Send a packet without a Paperweight dependency

**Input:**
```
package_name: com.example.nms
bridge_class_name: NmsBridge
cache_enabled: true
```

**build.gradle (no Paperweight):**
```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
}
```

**Caller: build and send a ClientboundSetActionBarTextPacket dynamically:**
```java
// Build the packet via reflection
Class<?> packetClass = Class.forName(
    "net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket");
Class<?> componentClass = Class.forName("net.minecraft.network.chat.Component");

// Component.literal("Hello")
Method literalMethod = componentClass.getMethod("literal", String.class);
Object component = literalMethod.invoke(null, "Hello via reflection");

// new ClientboundSetActionBarTextPacket(component)
Object packet = packetClass.getDeclaredConstructor(componentClass).newInstance(component);

// Send
NmsBridge.sendPacket(player, packet);
```

---

## Example 2: Read a player's network latency (connection.latency())

**Input:**
```
package_name: com.example.nms
bridge_class_name: NmsBridge
cache_enabled: true
```

**Caller: get the player's network latency (ms):**
```java
public static int getLatency(Player player) {
    try {
        Object serverPlayer = NmsBridge.getHandle(player);
        // Since 1.20.2, latency lives in ServerCommonPacketListenerImpl (the superclass of ServerPlayer.connection), not in ServerPlayer
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

## Example 3: Cache multiple Methods for a hot path

**Input:**
```
package_name: com.example.nms
bridge_class_name: NmsBridge
cache_enabled: true
```

**Caller: high-frequency scenario (updating players every tick):**
```java
public class PacketHotpath {

    private static final Class<?> PACKET_CLASS = loadClass("net.minecraft.network.protocol.Packet");
    private static final Class<?> GAME_LISTENER = loadClass(
        "net.minecraft.server.network.ServerGamePacketListenerImpl");
    private static final Class<?> SERVER_PLAYER = loadClass(
        "net.minecraft.server.level.ServerPlayer");

    // Loaded once at startup
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

## Example 4: Open reflective access in the module system (Java 17+)

**build.gradle snippet:**
```groovy
tasks.withType(JavaCompile).configureEach {
    options.compilerArgs += [
        '--add-exports=java.base/jdk.internal.misc=ALL-UNNAMED'
    ]
}

// Runtime args (if the server launch arguments need them)
// --add-opens java.base/java.lang=ALL-UNNAMED
// --add-opens java.base/java.lang.reflect=ALL-UNNAMED
```

**Fallback flow: degrade gracefully when reflection fails:**
```java
public void broadcastActionBar(Component message) {
    try {
        Object packet = buildActionBarPacket(message);
        for (Player p : Bukkit.getOnlinePlayers()) {
            NmsBridge.sendPacket(p, packet);
        }
    } catch (Throwable t) {
        getLogger().warning("NMS reflection failed, falling back to Adventure API");
        // Degrade: use the Bukkit/Adventure API
        for (Player p : Bukkit.getOnlinePlayers()) {
            p.sendActionBar(message);
        }
    }
}
```
