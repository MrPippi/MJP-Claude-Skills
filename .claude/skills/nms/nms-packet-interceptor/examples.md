# examples — nms-packet-interceptor

## Example 1: Log all packets (for debugging)

**Input:**
```
package_name: com.example.debug
handler_name: PacketLogger
manager_name: LoggerManager
handler_id: debug_packet_logger
```

**Usage:**
```java
// In onEnable()
LoggerManager manager = new LoggerManager(
    (player, inbound) -> {
        // Serverbound: packet sent by the client
        getLogger().fine("[IN ] " + player.getName() + " → " + inbound.getClass().getSimpleName());
        return inbound;
    },
    (player, outbound) -> {
        // Clientbound: packet sent by the server
        getLogger().fine("[OUT] " + player.getName() + " ← " + outbound.getClass().getSimpleName());
        return outbound;
    }
);
Bukkit.getPluginManager().registerEvents(new InterceptorListener(manager), this);

// Manually inject for players already online (reload scenario)
Bukkit.getOnlinePlayers().forEach(manager::inject);
```

---

## Example 2: Cancel a player's chat packets (mute system)

**Input:**
```
package_name: com.example.mute
handler_name: MuteInterceptor
manager_name: MuteManager
handler_id: mute_interceptor
```

**Usage:**
```java
import net.minecraft.network.protocol.game.ServerboundChatPacket;

Set<UUID> mutedPlayers = ConcurrentHashMap.newKeySet();

MuteManager manager = new MuteManager(
    (player, packet) -> {
        // Intercept the Serverbound chat packet
        if (packet instanceof ServerboundChatPacket chat &&
            mutedPlayers.contains(player.getUniqueId())) {
            // Notify the player (switch back to the main thread)
            Bukkit.getScheduler().runTask(plugin, () ->
                player.sendMessage(Component.text("You have been muted", NamedTextColor.RED)));
            return null; // cancel the packet
        }
        return packet;
    },
    null // outbound not handled
);
```

---

## Example 3: Modify a Clientbound Scoreboard packet (hide a specific score)

**Input:**
```
package_name: com.example.hidden
handler_name: HiddenScoreInterceptor
manager_name: HiddenScoreManager
handler_id: hidden_score
```

**Usage:**
```java
import net.minecraft.network.protocol.game.ClientboundSetScorePacket;

HiddenScoreManager manager = new HiddenScoreManager(
    null, // inbound not handled
    (player, packet) -> {
        if (packet instanceof ClientboundSetScorePacket scorePacket) {
            // Hide a specific player's score
            if (scorePacket.owner().equals("[HIDDEN]")) {
                return null; // do not let the player see this entry
            }
        }
        return packet;
    }
);
```

---

## Example 4: Swing rate limiting (anti-cheat)

**Input:**
```
package_name: com.example.anticheat
handler_name: RateLimitInterceptor
manager_name: RateLimitManager
handler_id: rate_limit
```

**Usage: detect an excessive ServerboundSwingPacket rate per time window:**
```java
import net.minecraft.network.protocol.game.ServerboundSwingPacket;
import java.util.concurrent.ConcurrentHashMap;

Map<UUID, Deque<Long>> swingTimes = new ConcurrentHashMap<>();
long WINDOW_MS = 1000L;
int MAX_SWINGS = 20;

RateLimitManager manager = new RateLimitManager(
    (player, packet) -> {
        if (packet instanceof ServerboundSwingPacket) {
            Deque<Long> times = swingTimes.computeIfAbsent(
                player.getUniqueId(), k -> new ConcurrentLinkedDeque<>());
            long now = System.currentTimeMillis();
            times.add(now);
            while (!times.isEmpty() && now - times.peek() > WINDOW_MS) times.poll();

            if (times.size() > MAX_SWINGS) {
                // Trigger the anti-cheat action (safe call from async)
                Bukkit.getScheduler().runTask(plugin, () ->
                    player.kick(Component.text("Auto-Clicker detected")));
                return null;
            }
        }
        return packet;
    },
    null
);
```
