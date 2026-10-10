# examples — paper-client-side-effects

## Example 1: Player toggles a preference on the settings page, applied immediately

**Input:**
```
base_package: com.example.effects
effects: border, time, weather, night-vision
preference_source: SettingsApi
```

**Output — after the settings page writes the preference it only calls `refresh`; `reconcile()` decides whether to apply or restore:**
```java
import com.example.effects.EffectState;
import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;

/** Called by the settings page on the main thread after the preference is written. Preferences are re-read from SettingsHook; no effect is applied manually here. */
public final class SettingsPageActions {

    private final EffectState state;

    public SettingsPageActions(EffectState state) {
        this.state = state;
    }

    public void onToggled(Player player) {
        state.refresh(player);
        player.sendMessage(Component.text("Your visual settings were updated."));
    }
}
```

**Why not call `addPotionEffect` directly when toggling:** when night vision is turned off, `reconcile()` removes only the infinite night vision, so a finite potion the player drank themselves is not deleted by mistake; when turned on, a finite night vision already on the player is overwritten with a permanent one.

---

## Example 2: Hide non-friends only in the lobby, restored automatically when leaving

**Input:**
```
effects: visibility
visibility_rule: In the lobby only friends are visible; in other worlds everyone is visible
```

**Output — the rule only answers "should this player be hidden"; the service only touches players whose state changed:**
```java
import com.example.effects.PlayerVisibilityService;
import org.bukkit.World;
import org.bukkit.entity.Player;

import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;

public final class LobbyFriendsPolicy implements PlayerVisibilityService.Policy {

    private final Predicate<World> isLobby;
    private final Function<UUID, Set<UUID>> friendsOf;

    public LobbyFriendsPolicy(Predicate<World> isLobby, Function<UUID, Set<UUID>> friendsOf) {
        this.isLobby = isLobby;
        this.friendsOf = friendsOf;
    }

    @Override
    public boolean shouldHide(Player viewer, Player target) {
        if (!isLobby.test(viewer.getWorld())) return false;
        return !friendsOf.apply(viewer.getUniqueId()).contains(target.getUniqueId());
    }
}
```

**Wiring:** `new PlayerVisibilityService(plugin, new LobbyFriendsPolicy(world -> world.getName().equals("lobby"), friendsLookup))`.
When the friends list or the "lobby" definition changes without an event, call `refreshAll()` from a timer of about 20 ticks; it calls `hidePlayer`/`showPlayer` only for differences, costing a quadratic number of cache lookups in the online player count and sending no packets.

**Note:** `hidePlayer` also removes the hidden player from the TAB list.

---

## Example 3: When the real border shrinks, the low-health vignette updates with it

**Input:**
```
effects: border
```

**Output — an admin shrinks the border with a command; the vignette is corrected by `WorldBorderBoundsChangeEvent` together with the periodic scan, so the command never touches players:**
```java
import org.bukkit.World;

import java.time.Duration;

public final class BorderCommands {

    private BorderCommands() {}

    /** Shrinks the border. EffectListener re-copies each player's virtual border on the next tick, and tick() then follows the gradual change. */
    public static void shrink(World world, double newSize, Duration over) {
        world.getWorldBorder().setSize(newSize, over.toSeconds());
    }
}
```

**Verification (manual):** run `/effect give @s instant_damage` on yourself until health drops below the threshold -> the vignette appears -> `/worldborder set 100 30` -> the vignette's warning distance changes gradually with the border instead of staying at the old size -> after healing the vignette disappears and the player returns to the real border.
