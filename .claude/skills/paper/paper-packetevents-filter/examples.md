# examples — paper-packetevents-filter

## Example 1: Rewrite (rather than hide) the system chat a specific player sees

**Input:**
```
backend: packetevents
recipes: chat
requirement: In system messages seen by "kid mode" players, replace the listed words with ***; other players are unaffected
```

**Output: reuse the `chatHidden` set in `FilterState` as the "kid mode" list; the word list is an immutable `Pattern` fixed at construction time:**
```java
import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterState;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSystemChatMessage;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextReplacementConfig;

import java.util.UUID;
import java.util.regex.Pattern;

public final class ChatRewriteFilter extends PacketListenerAbstract {

    private final FilterState state;
    private final FailOpenGuard guard;
    private final TextReplacementConfig censor;

    public ChatRewriteFilter(FilterState state, FailOpenGuard guard, Pattern badWords) {
        super(PacketListenerPriority.NORMAL);
        this.state = state;
        this.guard = guard;
        this.censor = TextReplacementConfig.builder().match(badWords).replacement("***").build();
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        if (!guard.active() || event.getPacketType() != PacketType.Play.Server.SYSTEM_CHAT_MESSAGE) {
            return;
        }
        try {
            User user = event.getUser();
            UUID recipient = user == null ? null : user.getUUID();
            if (recipient == null || !state.current().chatHidden().contains(recipient)) {
                return;
            }
            WrapperPlayServerSystemChatMessage wrapper = new WrapperPlayServerSystemChatMessage(event);
            Component original = wrapper.getMessage();
            Component rewritten = original.replaceText(censor);   // Components are immutable: a new value
            if (!rewritten.equals(original)) {
                wrapper.setMessage(rewritten);
                event.markForReEncode(true);   // without this the client still receives the old bytes
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);   // fail-open: the original packet goes out unchanged
        }
    }
}
```

Register it the same way as `ChatPacketFilter`: add one line inside `PacketEventsBridge.register`:
`registered.add(events.registerListener(new ChatRewriteFilter(state, new FailOpenGuard(log, "rewrite"), pattern)));`.
If both `ChatPacketFilter` (cancel) and the rewrite are enabled, give the cancelling filter a lower priority or register it first, so no work is wasted on packets that are already cancelled.

---

## Example 2: Resend a single slot so the lore updates immediately

**Input:**
```
backend: packetevents
recipes: lore
requirement: After a player toggles "show value" or an item price changes, make the client redraw one slot immediately instead of resending everything with updateInventory()
```

**Output: map the inventory index to the window 0 container slot (`toContainerSlot`) and send SET_SLOT on the main thread (`stateId=0` means server-initiated, so the client leaves the cursor and prediction queue alone):**

```java
import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetSlot;
import io.github.retrooper.packetevents.util.SpigotConversionUtil;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * MAIN THREAD ONLY (reads the player's inventory). Touches PacketEvents types, so only call it through
 * the Hook-guarded path (e.g. from the Bridge side), never when packetevents is absent.
 */
public final class SlotResender {

    private final Logger log;

    public SlotResender(Logger log) {
        this.log = log;
    }

    /**
     * Sends the ORIGINAL item through the normal listener chain: the injector adds its lore exactly as
     * for any server-sent packet, so state must be changed first and the resend done second.
     */
    public void resend(Player player, int bukkitSlot) {
        int container = toContainerSlot(bukkitSlot);
        if (container < 0) {
            return;
        }
        ItemStack item = player.getInventory().getItem(bukkitSlot);
        ItemStack source = item == null ? new ItemStack(Material.AIR) : item;
        WrapperPlayServerSetSlot packet =
                new WrapperPlayServerSetSlot(0, 0, container, SpigotConversionUtil.fromBukkitItemStack(source));
        try {
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, packet);
        } catch (RuntimeException e) {
            log.log(Level.WARNING, "Could not resend slot " + bukkitSlot + " to " + player.getUniqueId(), e);
        }
    }

    /**
     * Bukkit PlayerInventory index -> container slot of window 0.
     * Hotbar 0-8 -> 36-44, main 9-35 unchanged, armor 36-39 -> 8-5, offhand 40 -> 45.
     *
     * @return the container slot, or -1 when the index is not a player slot
     */
    static int toContainerSlot(int slot) {
        if (slot < 0) {
            return -1;
        }
        if (slot <= 8) {
            return slot + 36;
        }
        if (slot <= 35) {
            return slot;
        }
        if (slot <= 39) {
            return 44 - slot;
        }
        return slot == 40 ? 45 : -1;
    }
}
```

ProtocolLib equivalent: create the packet with `ProtocolLibrary.getProtocolManager().createPacket(PacketType.Play.Server.SET_SLOT)`,
fill the fields with `getIntegers().write(0, 0)`, `write(1, 0)`, `write(2, container)` and `getItemModifier().write(0, item)`,
then call `sendServerPacket(player, packet, true)` (the third argument `true` sends the packet through the listener chain).

---

## Example 3: Boundary test when packetevents is not installed

**Input:**
```
requirement: Make sure classes that are always loaded do not blow up through reflection when packetevents is not on the classpath
```

**Output: the test classpath deliberately excludes packetevents (`compileOnly` does not reach the test runtime, so this matches what a server without the plugin sees). `Bukkit.registerEvents` calls `getDeclaredMethods()` on a Listener, and any member signature that references a packet type throws `NoClassDefFoundError`:**
```java
import java.util.List;

public final class PacketBoundaryCheck {

    private PacketBoundaryCheck() {
    }

    /** Classes that are loaded even when packetevents is absent: none of their members may mention packet types. */
    private static final List<String> ALWAYS_LOADED = List.of(
            "com.example.filter.FilterPlugin",
            "com.example.filter.GameModeTracker",
            "com.example.filter.integration.PacketEventsHook",
            "com.example.filter.integration.ProtocolLibHook",
            "com.example.filter.state.FilterSnapshot",
            "com.example.filter.state.FilterState",
            "com.example.filter.state.FailOpenGuard",
            "com.example.filter.packet.LorePainter");

    /** Call it from a JUnit test; throws AssertionError describing the first offender. */
    public static void verify() throws ClassNotFoundException {
        try {
            Class.forName("com.github.retrooper.packetevents.event.PacketListener");
            throw new AssertionError("packetevents is on the test classpath: this test cannot detect leaks");
        } catch (ClassNotFoundException expected) {
            // good: same view as a server without the plugin
        }
        for (String name : ALWAYS_LOADED) {
            Class<?> type = Class.forName(name);
            try {
                type.getDeclaredConstructors();
                type.getDeclaredFields();
                type.getDeclaredMethods();
            } catch (LinkageError e) {
                throw new AssertionError(name + " exposes a packet-library type in a member signature", e);
            }
        }
    }
}
```

Another test worth writing is for `FailOpenGuard`: call `trip(...)` twice and verify that `active()` becomes `false` and only one WARNING is logged.
