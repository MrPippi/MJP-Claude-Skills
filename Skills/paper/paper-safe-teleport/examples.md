# examples — paper-safe-teleport

## Example 1: `/rtp` command wiring (5-second warmup, 5-minute cooldown, 4-spot pool, blocked in combat)

**Input:**
```
base_package: com.example.teleport
world: world
min_radius: 500
max_radius: 5000
max_attempts: 12
warmup_ticks: 100
cooldown: PT5M
pool_size: 4
```

**Output — main plugin class (wiring, starting the pool, cleanup on disable):**
```java
import org.bukkit.World;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.random.RandomGenerator;

public final class TeleportPlugin extends JavaPlugin {

    private SafeTeleportService service;
    private SafeSpotPool pool;

    @Override
    public void onEnable() {
        World world = getServer().getWorld("world");
        if (world == null) {
            getLogger().severe("World 'world' not found; disabling.");
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        TeleportSettings settings = new TeleportSettings(100, Duration.ofMinutes(5), 500, 5000, 12, 0.5);
        SafeSpotFinder finder = new SafeSpotFinder(RandomGenerator.getDefault());
        pool = new SafeSpotPool(this, finder, world.getUID(), settings, 4);

        // Plug in the service provided by paper-combat-tag here; use allowAll() when it is not installed
        TeleportGuard guard = TeleportGuard.allowAll();

        TeleportCooldowns cooldowns = new TeleportCooldowns(Clock.systemUTC(), Map.of());
        service = new SafeTeleportService(this, settings, guard, cooldowns, finder, pool);
        getServer().getPluginManager().registerEvents(new WarmupListener(service), this);
        pool.start();
    }

    @Override
    public void onDisable() {
        if (service != null) service.shutdown();
        if (pool != null) pool.close();
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Players only.");
            return true;
        }
        World world = getServer().getWorld("world");
        if (world == null) {
            player.sendMessage("The RTP world is unavailable.");
            return true;
        }
        service.requestRandom(player, world);
        return true;
    }
}
```

**plugin.yml:**
```yaml
name: SafeTeleport
main: com.example.teleport.TeleportPlugin
version: '1.0.0'
api-version: '26.2'
commands:
  rtp:
    description: Teleport to a random safe location
    permission: teleport.rtp
permissions:
  teleport.rtp:
    default: true
  teleport.bypass.cooldown:
    default: op
```

Key points:
- The command only issues the request; warmup, search, and re-validation all live in `SafeTeleportService`
- The pool serves only the target world; requests for other worlds naturally fall back to a live search
- After switching to [`paper-combat-tag`](../paper-combat-tag/SKILL.md): `TeleportGuard.blockWhileTagged(combatTagService::isTagged)`

---

## Example 2: Verify the landing spot before teleporting home, and search nearby if it is unsafe

**Input:**
```
base_package: com.example.teleport
scenario: the player's home was rebuilt (floor dug out, flooded with lava), so it must be checked before teleporting
```

**Output — home landing-spot resolution (main thread; make sure the chunk is loaded first):**
```java
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;

import java.util.Optional;
import java.util.UUID;

public final class HomeTeleporter {

    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final int SEARCH_RADIUS = 4;
    private static final int CHUNK_SHIFT = 4;

    private final Plugin plugin;
    private final TeleportGuard guard;

    public HomeTeleporter(Plugin plugin, TeleportGuard guard) {
        this.plugin = plugin;
        this.guard = guard;
    }

    /** home is the player's saved location. Call on the main thread. */
    public void teleportHome(Player player, Location home) {
        World world = home.getWorld();
        if (world == null) {
            player.sendMessage(MM.deserialize("<red>Your home world is not loaded."));
            return;
        }
        UUID id = player.getUniqueId();
        UUID originWorld = player.getWorld().getUID();

        world.getChunkAtAsync(home.getBlockX() >> CHUNK_SHIFT, home.getBlockZ() >> CHUNK_SHIFT)
            .whenComplete((chunk, err) -> plugin.getServer().getScheduler().runTask(plugin, () -> {
                Player p = plugin.getServer().getPlayer(id);
                if (p == null || !p.isOnline()) return;
                Optional<String> denied = guard.denyReason(p);
                if (denied.isPresent()) {
                    p.sendMessage(MM.deserialize(denied.get()));
                    return;
                }
                if (err != null || chunk == null || !p.getWorld().getUID().equals(originWorld)) {
                    p.sendMessage(MM.deserialize("<red>Teleport cancelled."));
                    return;
                }
                // Original spot still safe -> use it; otherwise find the nearest safe spot; if none, refuse instead of forcing the teleport
                Optional<Location> target = SafeLocationRules.evaluate(world, home.getBlockX(), home.getBlockZ())
                    .or(() -> SafeLocationRules.findNearby(world, home, SEARCH_RADIUS));
                if (target.isEmpty()) {
                    p.sendMessage(MM.deserialize("<red>Your home is blocked or unsafe. No safe spot nearby."));
                    return;
                }
                Location dest = target.get();
                dest.setYaw(home.getYaw());
                dest.setPitch(home.getPitch());
                p.teleportAsync(dest, TeleportCause.PLUGIN).whenComplete((ok, tpErr) ->
                    plugin.getServer().getScheduler().runTask(plugin, () -> {
                        Player after = plugin.getServer().getPlayer(id);
                        if (after != null) {
                            after.sendMessage(MM.deserialize(
                                tpErr == null && Boolean.TRUE.equals(ok) ? "<green>Welcome home!" : "<red>Teleport failed."));
                        }
                    }));
            }));
    }
}
```

Key points:
- A home is a location the player chose, so **keep the original spot first**; only search nearby when it is unsafe
- `findNearby` only looks at loaded chunks, so call `getChunkAtAsync` first
- RTP and homes share the same rules class and do not reimplement it

---

## Example 3: Paired / queued RTP (two players per group, landing near each other)

**Input:**
```
base_package: com.example.teleport
scenario: a player enters /rtp pair; once two players are matched, they teleport together to the same random area
```

**Output — the queue stores only UUIDs; one search runs once two players are matched, and their spots are adjacent:**
```java
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;
import java.util.UUID;

public final class PairRtpQueue {

    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final int PARTNER_RADIUS = 3;

    private final Plugin plugin;
    private final TeleportSettings settings;
    private final TeleportGuard guard;
    private final SafeSpotFinder finder;
    private final Deque<UUID> waiting = new ArrayDeque<>();

    public PairRtpQueue(Plugin plugin, TeleportSettings settings, TeleportGuard guard, SafeSpotFinder finder) {
        this.plugin = plugin;
        this.settings = settings;
        this.guard = guard;
        this.finder = finder;
    }

    /** Main thread. The first player queues; when the second joins, both depart together. */
    public void join(Player player, World world) {
        UUID id = player.getUniqueId();
        Optional<String> denied = guard.denyReason(player);
        if (denied.isPresent()) {
            player.sendMessage(MM.deserialize(denied.get()));
            return;
        }
        if (waiting.contains(id)) {
            player.sendMessage(MM.deserialize("<yellow>You are already in the queue."));
            return;
        }
        UUID partnerId = pollOnlinePartner();
        if (partnerId == null) {
            waiting.addLast(id);
            player.sendMessage(MM.deserialize("<yellow>Waiting for a partner..."));
            return;
        }
        dispatch(partnerId, id, world);
    }

    public void leave(UUID playerId) {
        waiting.remove(playerId);
    }

    /** Takes the first waiting player who is still online; offline players are simply dropped. */
    private UUID pollOnlinePartner() {
        while (!waiting.isEmpty()) {
            UUID candidate = waiting.pollFirst();
            Player p = plugin.getServer().getPlayer(candidate);
            if (p != null && p.isOnline()) return candidate;
        }
        return null;
    }

    private void dispatch(UUID first, UUID second, World world) {
        finder.find(world, settings.minRadius(), settings.maxRadius(), settings.maxAttempts())
            .whenComplete((found, err) -> plugin.getServer().getScheduler().runTask(plugin, () -> {
                Player a = plugin.getServer().getPlayer(first);
                Player b = plugin.getServer().getPlayer(second);
                if (err != null || found.isEmpty() || a == null || b == null) {
                    tell(a, "<red>Pair teleport failed. Please queue again.");
                    tell(b, "<red>Pair teleport failed. Please queue again.");
                    return;
                }
                // If either player entered combat during the search -> cancel for both, so nobody is left alone
                if (guard.denyReason(a).isPresent() || guard.denyReason(b).isPresent()) {
                    tell(a, "<red>Pair teleport cancelled.");
                    tell(b, "<red>Pair teleport cancelled.");
                    return;
                }
                Location anchor = found.get();
                // The second spot is another safe point near the anchor; if none is found, use the same spot as the first player
                Location partnerSpot = SafeLocationRules.findNearby(world, anchor, PARTNER_RADIUS)
                    .filter(loc -> loc.getBlockX() != anchor.getBlockX() || loc.getBlockZ() != anchor.getBlockZ())
                    .orElse(anchor);
                a.teleportAsync(anchor, TeleportCause.PLUGIN);
                b.teleportAsync(partnerSpot, TeleportCause.PLUGIN);
                tell(a, "<green>Teleported with your partner!");
                tell(b, "<green>Teleported with your partner!");
            }));
    }

    private static void tell(Player player, String message) {
        if (player != null) player.sendMessage(MM.deserialize(message));
    }
}
```

Key points:
- The queue stores only `UUID`s; call `getPlayer` only when matching, and skip anyone who is offline
- Search only **once**; the second player uses `findNearby` to get an adjacent safe spot, so distant chunks are not loaded twice
- Both players must pass the gate before departure, otherwise the whole group is cancelled (nobody is left alone)
- The example skips cooldown and warmup; in production, reuse the same stages as `SafeTeleportService` (warmup -> re-validate -> teleport -> record cooldown)
