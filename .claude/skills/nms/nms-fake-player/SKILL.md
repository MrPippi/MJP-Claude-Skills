---
name: nms-fake-player
description: "以真正的 NMS ServerPlayer 建立沒有客戶端的假玩家（機器人／訓練假人）：空連線、皮膚、原版戰鬥與移動物理、NMS 限定在單一套件並在版本不符時只停用該功能（Paper NMS + Paperweight）/ Client-less fake players backed by a real NMS ServerPlayer with vanilla combat and movement, confined NMS and version guard"
---

# NMS Fake Player

## Skill Name

`nms-fake-player`

## Purpose

Create a "real `ServerPlayer` without a client" fake player, for PvP bots, training dummies, and showcase clones.
Unlike NPCs such as Citizens, damage, critical hits, knockback, shield blocking, eating, walking, and step-up jumping all use vanilla logic; the caller only feeds input every tick (forward/strafe/jump/sprint) and head rotation.

This is the NMS code most likely to break across versions, so the template also enforces:
- **NMS appears in a single package only**, exposing only Bukkit types outward
- **Version guard**: on a version mismatch, only this feature (e.g. `/bot`) is disabled; the rest of the plugin works as normal

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev (see [`references/paper-nms-platform.md`](references/paper-nms-platform.md))
- Depends on Paper-patched constructors and methods (`ServerGamePacketListenerImpl`, `CommonListenerCookie.createInitial`, the CraftBukkit overload of `addFreshEntity`); **signatures may change even between Paper builds of the same MC version** -> the first call must catch `LinkageError`

## Triggers

- 「假玩家」「fake player」「機器人」「bot」「訓練假人」「PvP bot」
- 「ServerPlayer NPC」「玩家分身」「不用 Citizens 的 NPC」
- 「EmptyConnection」「沒有客戶端的玩家」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.bot.nms` | Dedicated NMS package (only this package may import NMS) |
| `supported_versions` | `1.21.11`, `26.2` | MC versions allowed to enable the feature |
| `name_rule` | `<player>_Bot` | Fake player name rule (max 16 characters) |
| `skin_source` | the challenger | Player the skin is taken from |

## Outputs

- `NmsGuard.java` - version guard (**touches no NMS types**, so it loads safely even on a version mismatch)
- `EmptyConnection.java` - client-less connection: drops packets, keeping only the knockback velocity addressed to itself
- `FakePlayer.java` - the fake player itself (spawn / tick / input / look / attack / remove), exposing only Bukkit types outward
- `BotService.java` - Bukkit-side management and degradation (catches `LinkageError`, drives every tick, resends skin when a player joins)

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Also add a check to make sure NMS/CraftBukkit classes are **not packaged** into the jar:

```groovy
tasks.register('verifyNoServerClassesInJar') {
    dependsOn tasks.named('jar')
    doLast {
        def forbidden = ['net/minecraft/', 'org/bukkit/craftbukkit/', 'com/mojang/']
        def jarFile = tasks.named('jar').get().archiveFile.get().asFile
        zipTree(jarFile).visit { details ->
            if (!details.isDirectory() && forbidden.any { details.relativePath.pathString.startsWith(it) }) {
                throw new GradleException("Server class packaged into plugin jar: ${details.relativePath}")
            }
        }
    }
}
tasks.named('build') { dependsOn 'verifyNoServerClassesInJar' }
```

## Code Template

### `NmsGuard.java` (version guard, no NMS)

```java
package com.example.bot;

import org.bukkit.Bukkit;

import java.util.Set;

/**
 * The only entry point that may be called when NMS does not match: it compares only Bukkit's version string, and no NMS type appears in signatures or fields.
 * It cannot detect the case where the version is the same but the Paper build changed signatures -> the caller must still catch LinkageError on first contact with FakePlayer.
 */
public final class NmsGuard {

    private static final Set<String> SUPPORTED = Set.of("1.21.11", "26.2");

    private NmsGuard() {}

    public static boolean supported() {
        return SUPPORTED.contains(Bukkit.getMinecraftVersion());
    }
}
```

### `EmptyConnection.java` (NMS package)

```java
package com.example.bot.nms;

import io.netty.channel.ChannelFutureListener;
import io.netty.channel.embedded.EmbeddedChannel;
import net.minecraft.network.Connection;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.PacketFlow;
import net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
import net.minecraft.world.phys.Vec3;

import java.net.InetSocketAddress;

/**
 * The fake player's connection: every packet the server sends to it is dropped, except "velocity packets addressed to itself".
 *
 * <p>When vanilla melee hits a player, the knockback is wrapped in a ClientboundSetEntityMotionPacket and sent to the victim's client, then the server-side velocity is restored -
 * for a real player, knockback only happens once the client receives the packet. A fake player has no client, so FakePlayer#tick() applies the velocity left here on the next tick
 * (dropping this packet means no knockback).
 *
 * <p>ServerGamePacketListenerImpl reads the channel and address, so give it an EmbeddedChannel that connects nowhere and a loopback address.
 */
final class EmptyConnection extends Connection {

    private int ownerId = Integer.MIN_VALUE;
    private Vec3 pendingMotion;

    EmptyConnection() {
        super(PacketFlow.SERVERBOUND);
        this.channel = new EmbeddedChannel();
        this.address = new InetSocketAddress("127.0.0.1", 0);
    }

    void owner(int entityId) {
        this.ownerId = entityId;
    }

    /** The velocity to apply since the last tick; taking it clears it, null if none. */
    Vec3 takePendingMotion() {
        Vec3 motion = pendingMotion;
        pendingMotion = null;
        return motion;
    }

    @Override
    public void send(Packet<?> packet) {
        capture(packet);
    }

    @Override
    public void send(Packet<?> packet, ChannelFutureListener listener) {
        capture(packet);
    }

    @Override
    public void send(Packet<?> packet, ChannelFutureListener listener, boolean flush) {
        capture(packet);
    }

    private void capture(Packet<?> packet) {
        if (packet instanceof ClientboundSetEntityMotionPacket motion
                && motion.id() == ownerId) { // @1.21.11:                 && motion.getId() == ownerId) {
            pendingMotion = motion.movement(); // @1.21.11:             pendingMotion = motion.getMovement();
        }
    }

    @Override
    public void flushChannel() {
        // No client
    }

    @Override
    public boolean isConnected() {
        return true;
    }
}
```

### `FakePlayer.java` (NMS package, exposes only Bukkit types outward)

```java
package com.example.bot.nms;

import com.mojang.authlib.GameProfile;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoRemovePacket;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket;
import net.minecraft.network.protocol.game.ServerboundPlayerLoadedPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ClientInformation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.CommonListenerCookie;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.Vec3;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.craftbukkit.entity.CraftEntity;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.entity.CreatureSpawnEvent;

import java.util.List;
import java.util.UUID;

/**
 * A client-less fake player: a real ServerPlayer that skips the login flow and does not enter PlayerList (no PlayerJoinEvent, not in tab or getOnlinePlayers()).
 * Main thread only; the caller invokes tick() once per tick - a real player's doTick is driven by the connection, so a fake player does not move unless it is called.
 *
 * <p>Wherever this class is first touched, catch LinkageError (not Exception): when a Paper build changes constructor/method signatures, the error only appears on the first call.
 */
@SuppressWarnings("UnstableApiUsage")
public final class FakePlayer {

    private final ServerPlayer handle;
    private final EmptyConnection connection;

    private FakePlayer(ServerPlayer handle, EmptyConnection connection) {
        this.handle = handle;
        this.connection = connection;
    }

    /** Spawn a fake player named name at "at" with the skin taken from skinFrom, and send the skin info to all online players. */
    public static FakePlayer spawn(Location at, String name, Player skinFrom) {
        ServerLevel level = ((CraftWorld) at.getWorld()).getHandle();
        MinecraftServer server = level.getServer();
        ServerPlayer skinOwner = ((CraftPlayer) skinFrom).getHandle();
        GameProfile profile = new GameProfile(UUID.randomUUID(), name, skinOwner.getGameProfile().properties());

        // Reuse the skin source player's appearance settings (skin layers, main hand); createDefault() turns off outer layers such as hat and cape
        ServerPlayer handle = new Body(server, level, profile, skinOwner.clientInformation());
        // Construction registers it with the global advancement listeners; if not removed it leaks memory and may announce the fake player's advancements server-wide
        handle.getAdvancements().clearTriggers(); // @1.21.11:         handle.getAdvancements().stopListening();

        EmptyConnection connection = new EmptyConnection();
        connection.owner(handle.getId());
        handle.connection = new ServerGamePacketListenerImpl(server, connection, handle,
            CommonListenerCookie.createInitial(profile, false));
        handle.snapTo(at.getX(), at.getY(), at.getZ(), at.getYaw(), at.getPitch());
        handle.setYHeadRot(at.getYaw());

        FakePlayer fake = new FakePlayer(handle, connection);
        // The client must receive the player info first, or it will not draw the spawn packet that follows
        for (Player viewer : Bukkit.getOnlinePlayers()) {
            fake.showTo(viewer);
        }
        if (!level.addFreshEntity(handle, CreatureSpawnEvent.SpawnReason.CUSTOM)) {
            fake.hideFromAll(); // Cancelled by another plugin: retract the player info already sent so clients do not keep a ghost UUID
            throw new IllegalStateException("Fake player spawn was cancelled: " + name);
        }
        // Do not treat it as a real player: mob targeting, sleeping player counts, and World#getPlayers() all read level.players()
        level.players().remove(handle);
        return fake;
    }

    public Player bukkit() {
        return handle.getBukkitEntity();
    }

    /** Still in the world and alive. Returns false if removed, its chunk unloaded, or dead. */
    public boolean isValid() {
        return !handle.isRemoved() && handle.isAlive();
    }

    /**
     * Call once per tick. First applies the knockback received during the previous tick, then hands off to vanilla doTick().
     * It may return to level.players() on world change or re-tracking, so remove it again at the start of every tick.
     */
    public void tick() {
        if (!isValid()) return;
        if (handle.level() instanceof ServerLevel level) {
            level.players().remove(handle);
        }
        Vec3 knockback = connection.takePendingMotion();
        if (knockback != null) {
            handle.setDeltaMovement(knockback);
        }
        handle.doTick();
    }

    /** Movement input, handed to vanilla travel() on the next tick(). forward/strafe range from -1 to 1. */
    public void input(float forward, float strafe, boolean jump, boolean sprint) {
        handle.zza = forward;
        handle.xxa = strafe;
        handle.setJumping(jump);
        handle.setSprinting(sprint);
    }

    public void look(float yaw, float pitch) {
        handle.setYRot(yaw);
        handle.setXRot(pitch);
        handle.setYHeadRot(yaw);
    }

    /**
     * Become attackable immediately: the post-spawn invulnerability comes from a timeout waiting for "the client reports loading complete"; here we send the loaded packet in place of the nonexistent client
     * (this triggers Paper's PlayerClientLoadedWorldEvent).
     */
    public void clearSpawnInvulnerability() {
        handle.connection.handleAcceptPlayerLoad(new ServerboundPlayerLoadedPacket());
    }

    /** Vanilla melee: swing + Player#attack; damage, crits, knockback, and shield breaking are all computed by vanilla. */
    public void attack(Entity target) {
        handle.swing(InteractionHand.MAIN_HAND);
        handle.attack(((CraftEntity) target).getHandle());
    }

    /** Make it visible to viewer (listed=false, not shown in tab); resend for players who joined after spawn. */
    public void showTo(Player viewer) {
        send(viewer, ClientboundPlayerInfoUpdatePacket.createSinglePlayerInitializing(handle, false));
    }

    public void remove() {
        handle.discard();
        handle.getAdvancements().clearTriggers(); // @1.21.11:         handle.getAdvancements().stopListening();
        hideFromAll();
    }

    private void hideFromAll() {
        ClientboundPlayerInfoRemovePacket packet = new ClientboundPlayerInfoRemovePacket(List.of(handle.getUUID()));
        for (Player viewer : Bukkit.getOnlinePlayers()) {
            send(viewer, packet);
        }
    }

    private static void send(Player viewer, Packet<?> packet) {
        ((CraftPlayer) viewer).getHandle().connection.send(packet);
    }

    /**
     * A player whose physics are computed by the server. A real player's position is reported by the client (isClientAuthoritative is true),
     * so the server skips some vertical collision; a fake player has no client and must be computed by the server like a mob.
     * For real players getKnownMovement/getKnownSpeed come from client movement packets and are always zero for a fake player; vanilla melee uses them to decide sweeping, so they are switched back to the server velocity.
     */
    private static final class Body extends ServerPlayer {

        Body(MinecraftServer server, ServerLevel level, GameProfile profile, ClientInformation info) {
            super(server, level, profile, info);
        }

        @Override
        public boolean isClientAuthoritative() {
            return false;
        }

        @Override
        public Vec3 getKnownMovement() {
            return getDeltaMovement();
        }

        @Override
        public Vec3 getKnownSpeed() {
            return getDeltaMovement();
        }
    }
}
```

### `BotService.java` (Bukkit side: driving, degradation, skin resend)

```java
package com.example.bot;

import com.example.bot.nms.FakePlayer;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;

/**
 * Bukkit-side management of fake players. FakePlayer appears only inside method bodies, so this class still loads safely on a version mismatch.
 * Any LinkageError disables the whole feature (affecting only bots) and is logged only once.
 */
public final class BotService implements Listener {

    private final JavaPlugin plugin;
    private final List<FakePlayer> bots = new ArrayList<>();
    private boolean available;
    private BukkitTask ticker;

    public BotService(JavaPlugin plugin) {
        this.plugin = plugin;
        this.available = NmsGuard.supported();
        if (!available) {
            plugin.getLogger().warning("Unsupported Minecraft version for bots; /bot is disabled.");
        }
    }

    public boolean available() {
        return available;
    }

    public void start() {
        if (!available) return;
        ticker = plugin.getServer().getScheduler().runTaskTimer(plugin, this::tickAll, 1L, 1L);
    }

    /** Call on the main thread. Returns empty when the feature is disabled or the version does not match. */
    public Optional<Player> spawn(Location at, String name, Player skinFrom) {
        if (!available) return Optional.empty();
        try {
            FakePlayer bot = FakePlayer.spawn(at, name, skinFrom);
            bot.clearSpawnInvulnerability();
            bots.add(bot);
            return Optional.of(bot.bukkit());
        } catch (LinkageError e) {
            disable(e);
            return Optional.empty();
        } catch (IllegalStateException e) {
            plugin.getLogger().warning(e.getMessage());
            return Optional.empty();
        }
    }

    private void tickAll() {
        try {
            bots.removeIf(bot -> {
                if (!bot.isValid()) {
                    bot.remove();
                    return true;
                }
                bot.tick();
                return false;
            });
        } catch (LinkageError e) {
            disable(e);
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (!available) return;
        try {
            for (FakePlayer bot : bots) {
                bot.showTo(event.getPlayer()); // Players who join after spawn must also receive the skin info
            }
        } catch (LinkageError e) {
            disable(e);
        }
    }

    public void shutdown() {
        if (ticker != null) ticker.cancel();
        try {
            bots.forEach(FakePlayer::remove);
        } catch (LinkageError ignored) {
            // Already in the disable flow
        }
        bots.clear();
    }

    private void disable(LinkageError e) {
        if (!available) return;
        available = false;
        plugin.getLogger().log(Level.WARNING,
            "Fake player NMS signatures do not match this server build; bots disabled.", e);
        shutdown();
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/bot/
├── BotService.java          ← Bukkit side; does not import NMS
├── NmsGuard.java            ← compares version string only; does not import NMS
├── brain/                   ← AI decisions (Bukkit types only, unit-testable)
└── nms/                     ← the only package that may import net.minecraft / craftbukkit
    ├── EmptyConnection.java
    └── FakePlayer.java
```

Use ArchUnit or a simple source-scan test to enforce that "only `nms/` may import `net.minecraft`".

## Thread Safety

- ⚠️ All `FakePlayer` methods **must be called on the main thread only** (spawn, tick, attack, remove)
- Call `tick()` **once** per server tick; calling it twice means double speed
- AI decisions may precompute paths async, but the results must return to the main thread before being applied to `input()` / `look()`
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| `NoSuchMethodError` / `NoClassDefFoundError` | The Paper build changed a constructor or method signature | `BotService` catches `LinkageError` and disables bots; recompile against the new dev bundle |
| Fake player cannot be knocked back | `EmptyConnection` also dropped the velocity packet | Keep the owner's `ClientboundSetEntityMotionPacket` and apply it on the next tick |
| Spectators see the opponent hitting air | Viewers did not receive the player info packet | `showTo` everyone before spawning, and resend on join for newly joined players |
| Fake player appears in tab / `getOnlinePlayers()` | Went through `PlayerList.placeNewPlayer` | Use `addFreshEntity` and remove it from `level.players()` |
| Memory grows every match | Advancement listeners not removed | Call `getAdvancements().clearTriggers()` after construction and on removal (1.21.11: `stopListening()`) |
| Cannot hit it for a few seconds after spawn | Timeout waiting for the client to finish loading | `clearSpawnInvulnerability()` |
| Outer skin layers (hat, cape) not shown | Used `ClientInformation.createDefault()` | Reuse the source player's `clientInformation()` |
