# Paper PacketEvents Filter

## Purpose

Filter or rewrite packets sent to specific players without using NMS or injecting into the Netty pipeline: hide / rewrite system chat, inject per-viewer item lore, hide particles and sounds for a single player. The packet library is provided by PacketEvents (primary) or ProtocolLib installed on the server; this plugin only uses `compileOnly`, does not shade, and declares it with `softdepend`.

If you need NMS packet classes or to rewrite the Netty pipeline yourself, use `nms-packet-interceptor`; for the general soft-dependency approach see `paper-softdepend-hook`.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both compile-verified, same code on both)
- Pure Paper API, no Paperweight needed
- Server has packetevents installed (compiled against 2.13.0) or ProtocolLib (5.3.0)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### PacketEventsHook.java (soft-dependency attachment point, no packet types)

```java
import java.util.logging.Level;

public boolean install(FilterState state) {
    if (handles != null) return true;
    if (!Bukkit.getPluginManager().isPluginEnabled("packetevents")) {
        log.warning("packetevents is not installed: packet filters are disabled.");
        return false;
    }
    try {
        handles = PacketEventsBridge.register(state, log);   // only the Bridge touches PacketEvents types
        return true;
    } catch (LinkageError | RuntimeException e) {
        log.log(Level.WARNING, "Could not register packet filters.", e);
        return false;
    }
}
```

### ChatPacketFilter.java (Netty thread, snapshot reads only, fail-open)

```java
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSystemChatMessage;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;

public final class ChatPacketFilter extends PacketListenerAbstract {
    @Override
    public void onPacketSend(PacketSendEvent event) {
        if (!guard.active() || event.getPacketType() != PacketType.Play.Server.SYSTEM_CHAT_MESSAGE) return;
        try {
            UUID recipient = event.getUser() == null ? null : event.getUser().getUUID();
            FilterSnapshot snapshot = state.current();          // immutable snapshot
            if (recipient == null || !snapshot.chatHidden().contains(recipient)) return;
            WrapperPlayServerSystemChatMessage wrapper = new WrapperPlayServerSystemChatMessage(event);
            if (wrapper.isOverlay()) return;
            String plain = PlainTextComponentSerializer.plainText().serialize(wrapper.getMessage());
            if (!plain.startsWith(snapshot.allowedPrefix())) event.setCancelled(true);
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);                                      // let it through and disable, log only once
        }
    }
}
```

### Lifecycle

```java
// onEnable
packetEvents = new PacketEventsHook(getLogger());
if (!packetEvents.install(state)) {          // PacketEvents first, ProtocolLib as fallback
    protocolLib = new ProtocolLibHook(this);
    protocolLib.install(state);
}
// onDisable
packetEvents.uninstall();
```

---

## Rules

- Packet library types appear only in the listener and Bridge; they must not appear in fields or method signatures of the Hook, Plugin or Bukkit Listener
- The Netty thread only reads `FilterState#current()` and does not call `Bukkit.*` / `Player.*` (UUID is the exception); items are modified only on clones
- Any exception is fail-open: let the original packet through, `guard.trip(e)` disables that filter and logs only once
- Put `setCancelled(true)` / `markForReEncode(true)` on the last line of the try
- Do not inject lore for creative-mode viewers, and strip the marker line on `CREATIVE_INVENTORY_ACTION`
- Do not call PacketEvents' `load()` / `init()` / `terminate()`; always unregister in `onDisable`

---

## Thread Safety

- PacketEvents / ProtocolLib listeners run on the Netty thread, not the main thread
- Config and player state are assembled into a new `FilterSnapshot` on the main thread and published with `FilterState#update`
- Resending packets (`updateInventory()` or `PlayerManager#sendPacket`) is called on the main thread, and state is changed before resending
