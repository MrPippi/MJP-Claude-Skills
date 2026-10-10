# Bukkit ↔ NMS Bridge Reference

Applicable versions: Paper 1.21.11 / 26.2 (Mojang official names; vanilla is no longer obfuscated since 26.1). Where the two versions differ, the code is marked with an end-of-line `// @1.21.11:` comment or a `// @only <version>` block.
Bridge package: `org.bukkit.craftbukkit.*`

> Paper 1.20.5+ removed CraftBukkit's version relocation, so the package is fixed as `org.bukkit.craftbukkit` (no `v1_21_R1` suffix); `v1_xx_Rx` exists only on Spigot and Paper 1.20.4 and earlier.
> For Spigot / older version compatibility, use together with `Skills/nms/nms-reflection-bridge/SKILL.md`.

---

## Core Conversion Tables

### Bukkit → NMS (getHandle)

```java
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.craftbukkit.entity.CraftEntity;
import org.bukkit.craftbukkit.entity.CraftLivingEntity;
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.craftbukkit.inventory.CraftItemStack;
```

| Bukkit type | NMS type | Conversion |
|-------------|---------|---------|
| `Player` | `ServerPlayer` | `((CraftPlayer) player).getHandle()` |
| `LivingEntity` | `LivingEntity` (NMS) | `((CraftLivingEntity) entity).getHandle()` |
| `Entity` (generic) | `Entity` (NMS) | `((CraftEntity) entity).getHandle()` |
| `World` | `ServerLevel` | `((CraftWorld) world).getHandle()` |
| `ItemStack` (Bukkit) | `ItemStack` (NMS) | `CraftItemStack.asNMSCopy(item)` |
| `ItemStack` (Bukkit, may be a CraftItemStack) | `ItemStack` (NMS, shared) | `CraftItemStack.unwrap(item)` |

### NMS → Bukkit (getBukkitEntity)

| NMS type | Bukkit type | Conversion |
|---------|-------------|---------|
| `ServerPlayer` | `Player` | `(Player) serverPlayer.getBukkitEntity()` |
| `Entity` (NMS) | `Entity` (Bukkit) | `nmsEntity.getBukkitEntity()` |
| `LivingEntity` (NMS) | `LivingEntity` (Bukkit) | `(LivingEntity) nmsLiving.getBukkitEntity()` |
| `ItemStack` (NMS) | `ItemStack` (Bukkit) | `CraftItemStack.asBukkitCopy(nmsItem)` |
| `ServerLevel` | `World` | `nmsLevel.getWorld()` |

---

## Full Conversion Examples

### Player Conversion

```java
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

// Bukkit → NMS
Player bukkit = Bukkit.getPlayer("Steve");
ServerPlayer nms = ((CraftPlayer) bukkit).getHandle();

// Get the connection
ServerGamePacketListenerImpl conn = nms.connection;

// Common NMS-only fields
int latency = nms.connection.latency();      // Latency (ms)
int entityId = nms.getId();                  // NMS entity ID
java.util.UUID uuid = nms.getUUID();         // UUID (same as Bukkit)
```

---

### World / Level Conversion

```java
import net.minecraft.server.level.ServerLevel;
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.World;

// Bukkit → NMS
World bukkit = Bukkit.getWorld("world");
ServerLevel nms = ((CraftWorld) bukkit).getHandle();

// NMS world operations
nms.addFreshEntity(mob, CreatureSpawnEvent.SpawnReason.CUSTOM);
net.minecraft.world.level.block.state.BlockState state =
    nms.getBlockState(new net.minecraft.core.BlockPos(0, 64, 0));

// NMS → Bukkit
World back = nms.getWorld();
```

---

### ItemStack Conversion

```java
import net.minecraft.world.item.ItemStack;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

// Bukkit → NMS (copy; changes do not affect the original item)
org.bukkit.inventory.ItemStack bukkit = player.getInventory().getItemInMainHand();
ItemStack nms = CraftItemStack.asNMSCopy(bukkit);

// Bukkit → NMS (shared reference; zero-copy if it is a CraftItemStack, otherwise returns a copy)
ItemStack nmsShared = CraftItemStack.unwrap(bukkit);

// NMS → Bukkit (copy)
org.bukkit.inventory.ItemStack back = CraftItemStack.asBukkitCopy(nms);

// Empty item check
boolean isEmpty = nms.isEmpty(); // Prefer NMS isEmpty()
```

---

### Adventure Component ↔ NMS Component

Paper recommends the Adventure API, but NMS packets need the NMS Component. `net.minecraft.network.chat.Component.Serializer` (JSON) has been removed;
use Paper's built-in `PaperAdventure` for direct conversion (no JSON round trip and no RegistryAccess needed).

```java
import io.papermc.paper.adventure.PaperAdventure;
import net.kyori.adventure.text.Component;

// Adventure → NMS (for building packets)
Component adventure = Component.text("Hello").color(net.kyori.adventure.text.format.NamedTextColor.GREEN);
net.minecraft.network.chat.Component nmsComponent = PaperAdventure.asVanilla(adventure);

// NMS → Adventure (reading text from a packet)
net.minecraft.network.chat.Component fromPacket = /* packet.text() */;
Component backAdventure = PaperAdventure.asAdventure(fromPacket);
```

> ⚠️ `RegistryAccess.EMPTY` is suitable for plain text and formatting codes. For hover/click events or datapack-specific text, use the server's full `RegistryAccess`:
> ```java
> RegistryAccess reg = ((CraftServer) Bukkit.getServer()).getServer().registryAccess();
> ```

---

## Resolving the CraftBukkit Package Dynamically (Spigot / Older Version Compatibility)

Paper 1.20.5+ always uses `org.bukkit.craftbukkit`; only Spigot and Paper 1.20.4 and earlier have the `v1_xx_Rx` suffix.
If one jar must run across these platforms, resolve the package name dynamically:

```java
/** Get the CraftBukkit package name (Paper 1.20.5+: "org.bukkit.craftbukkit") */
public static String getCraftBukkitPackage() {
    String serverClass = Bukkit.getServer().getClass().getName();
    // Paper 1.20.5+: "org.bukkit.craftbukkit.CraftServer"; Spigot: "org.bukkit.craftbukkit.v1_21_R1.CraftServer"
    return serverClass.substring(0, serverClass.lastIndexOf('.'));
}

/** Get the CraftPlayer class dynamically */
public static Class<?> getCraftPlayerClass() throws ClassNotFoundException {
    return Class.forName(getCraftBukkitPackage() + ".entity.CraftPlayer");
}

/** Call getHandle() dynamically */
public static Object getHandle(Player player) throws ReflectiveOperationException {
    return getCraftPlayerClass().getMethod("getHandle").invoke(player);
}
```

---

## Version Mapping

| MC version | CraftBukkit package (Paper) | Paper Dev Bundle |
|--------|------------------------|-----------------|
| 26.2 | `org.bukkit.craftbukkit` | `26.2.build.132-stable` |
| 26.3 | `org.bukkit.craftbukkit` | `26.3.build.<n>-beta` |

> Other servers such as Spigot may use a different CraftBukkit package name; for cross-platform use, resolve it dynamically with `getCraftBukkitPackage()` above.

---

## Obtaining RegistryAccess

Ways to obtain `RegistryAccess` in different situations:

```java
import net.minecraft.core.RegistryAccess;
import org.bukkit.craftbukkit.CraftServer;

// Method 1: empty registry (suitable for plain text rendering)
RegistryAccess empty = RegistryAccess.EMPTY;

// Method 2: full server registry (recommended; supports all datapack features)
RegistryAccess full = ((CraftServer) Bukkit.getServer()).getServer().registryAccess();

// Method 3: from a ServerLevel
RegistryAccess fromLevel = serverLevel.registryAccess();
```

---

## Common NMS-only Operations (No Bukkit Equivalent)

### Read Player Latency (ms)

```java
int ping = ((CraftPlayer) player).getHandle().connection.latency();
```

### Send a Packet (Bypassing Bukkit Events)

```java
((CraftPlayer) player).getHandle().connection.send(packet);
```

### Get an Entity's DataTracker

```java
import net.minecraft.network.syncher.SynchedEntityData;

SynchedEntityData data = nmsEntity.getEntityData();
// Read the value of a specific key
// data.get(EntityDataAccessor<T> key)
```

### Force-sync Entity Position

```java
import net.minecraft.network.protocol.game.ClientboundTeleportEntityPacket;

ClientboundTeleportEntityPacket syncPacket = new ClientboundTeleportEntityPacket(nmsEntity);
// Broadcast to players in view
for (ServerPlayer viewer : serverLevel.players()) {
    viewer.connection.send(syncPacket);
}
```

---

## Bridge API Deprecation Warnings

The following CraftBukkit bridge methods are deprecated or planned for deprecation; avoid depending on them:

| Method | Status | Alternative |
|------|------|---------|
| `CraftItemStack.unwrap(null)` | NPE risk | Check item != null first |
| import `org.bukkit.craftbukkit.v1_21_R1.*` | This package does not exist on Paper 1.20.5+; compilation fails | Use `org.bukkit.craftbukkit.*` instead (Paperweight userdev) |
| `Bukkit.getUnsafe().serialize()` | Unstable | Use Adventure serialization |

---

## Related Skills

- `Skills/nms/nms-reflection-bridge/SKILL.md` — Version-independent reflection bridge
- `Skills/nms/nms-packet-sender/SKILL.md` — Sending packets via the bridge
- `Skills/nms/nms-custom-entity/SKILL.md` — Spawning entities via the bridge
- `docs/paper-nms/packets.md` — Packet type reference
- `docs/paper-nms/entities.md` — Entity class hierarchy
