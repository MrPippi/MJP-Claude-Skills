# NMS Packet Reference

Applicable versions: Paper 1.21.11 / 26.2 (Mojang official names; vanilla is no longer obfuscated since 26.1). Where the two versions differ, the code is marked with an end-of-line `// @1.21.11:` comment or a `// @only <version>` block.
Package root: `net.minecraft.network.protocol`

> For packet sending usage, see `Skills/nms/nms-packet-sender/SKILL.md`
> For packet interception usage, see `Skills/nms/nms-packet-interceptor/SKILL.md`
> For threading rules, see `Skills/_shared/nms-threading.md`

---

## Clientbound Packets (Server → Client)

### Display

#### `ClientboundSetActionBarTextPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket;
import net.minecraft.network.chat.Component;

// Construct
ClientboundSetActionBarTextPacket packet =
    new ClientboundSetActionBarTextPacket(Component.literal("Hello"));
```
| Field | Type | Description |
|------|------|------|
| `text` | `Component` | Text shown in the action bar |

---

#### `ClientboundSetTitleTextPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;

ClientboundSetTitleTextPacket packet =
    new ClientboundSetTitleTextPacket(Component.literal("§6Boss fight begins!"));
```

---

#### `ClientboundSetSubtitleTextPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;

ClientboundSetSubtitleTextPacket packet =
    new ClientboundSetSubtitleTextPacket(Component.literal("Ready?"));
```

---

#### `ClientboundSetTitlesAnimationPacket`
Controls the fade-in/stay/fade-out times of the title (unit: ticks).
```java
import net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket;

// fadeIn=10, stay=70, fadeOut=20 ticks
ClientboundSetTitlesAnimationPacket packet =
    new ClientboundSetTitlesAnimationPacket(10, 70, 20);
```

---

#### `ClientboundClearTitlesPacket`
```java
import net.minecraft.network.protocol.game.ClientboundClearTitlesPacket;

// resetTimes=true also resets the timers
ClientboundClearTitlesPacket packet = new ClientboundClearTitlesPacket(true);
```

---

### Entity

#### `ClientboundSetEntityDataPacket`
Syncs the entity's DataTracker metadata (name, glowing, silent, etc.).
```java
import net.minecraft.network.protocol.game.ClientboundSetEntityDataPacket;
import net.minecraft.network.syncher.SynchedEntityData;

// Get a snapshot of the entity's entityData
List<SynchedEntityData.DataValue<?>> packedItems = entity.getEntityData().packAll();
if (packedItems != null) {
    ClientboundSetEntityDataPacket packet =
        new ClientboundSetEntityDataPacket(entity.getId(), packedItems);
}
```
| Field | Type | Description |
|------|------|------|
| `id` | `int` | NMS entity ID |
| `packedItems` | `List<SynchedEntityData.DataValue<?>>` | Metadata list |

---

#### `ClientboundSetEntityMotionPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
import net.minecraft.world.phys.Vec3;

ClientboundSetEntityMotionPacket packet =
    new ClientboundSetEntityMotionPacket(entity.getId(), entity.getDeltaMovement());
// Or specify the velocity manually
ClientboundSetEntityMotionPacket packet2 =
    new ClientboundSetEntityMotionPacket(entity.getId(), new Vec3(0.0, 0.5, 0.0));
```

---

#### `ClientboundSetEquipmentPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetEquipmentPacket;
import net.minecraft.world.entity.EquipmentSlot;
import com.mojang.datafixers.util.Pair;

List<Pair<EquipmentSlot, net.minecraft.world.item.ItemStack>> slots = List.of(
    Pair.of(EquipmentSlot.MAINHAND, swordItemStack)
);
ClientboundSetEquipmentPacket packet =
    new ClientboundSetEquipmentPacket(entity.getId(), slots);
```

---

#### `ClientboundEntityEventPacket`
Triggers client-side entity animations (death, hurt, magic, etc.).
```java
import net.minecraft.network.protocol.game.ClientboundEntityEventPacket;

// eventId: 2=hurt animation, 3=death animation, 6=horse jump, 18=cat in love
ClientboundEntityEventPacket packet =
    new ClientboundEntityEventPacket(entity, (byte) 2);
```

Common `eventId` values:

| ID | Effect | Applicable entities |
|----|------|---------|
| 2 | Hurt animation | All LivingEntity |
| 3 | Death animation | All LivingEntity |
| 6 | Jump particles | Horse |
| 11 | Casting animation | Witch |
| 18 | Heart particles | Breedable animals |
| 29 | Shield block particles | Player |

---

#### `ClientboundTeleportEntityPacket`
```java
import net.minecraft.network.protocol.game.ClientboundTeleportEntityPacket;

ClientboundTeleportEntityPacket packet =
    new ClientboundTeleportEntityPacket(entity);
```

---

### World

#### `ClientboundLevelParticlesPacket`
```java
import net.minecraft.network.protocol.game.ClientboundLevelParticlesPacket;
import net.minecraft.core.particles.ParticleTypes;

ClientboundLevelParticlesPacket packet = new ClientboundLevelParticlesPacket(
    ParticleTypes.FLAME,   // Particle type
    true,                  // overrideLimiter: also show at long range
    false,                 // alwaysShow: ignore the client's "Particles: Decreased" setting (added in 1.21.4+)
    x, y, z,              // Center coordinates
    0.5f, 0.5f, 0.5f,     // Random offset range
    0.0f,                  // speed (affects initial particle velocity)
    10                     // Count
);
```

Common particle types (`ParticleTypes.xxx`):

| Constant | Effect |
|------|------|
| `FLAME` | Flame |
| `HEART` | Heart |
| `EXPLOSION` | Explosion |
| `SMOKE` | Smoke |
| `END_ROD` | End rod particles |
| `ENCHANT` | Enchantment particles |
| `HAPPY_VILLAGER` | Green stars |
| `ANGRY_VILLAGER` | Black stars |
| `CRIT` | Critical hit particles |
| `SOUL_FIRE_FLAME` | Soul fire flame |
| `DRAGON_BREATH` | Dragon's breath |

---

#### `ClientboundBlockUpdatePacket`
```java
import net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Blocks;

ClientboundBlockUpdatePacket packet = new ClientboundBlockUpdatePacket(
    new BlockPos(x, y, z),
    Blocks.STONE.defaultBlockState()
);
```

---

#### `ClientboundExplodePacket`

> The class name is `ClientboundExplodePacket` (not ~~ClientboundExplosionPacket~~). This constructor changed in both 1.21.2 and 26.x; the following is the 26.2 version.

```java
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.protocol.game.ClientboundExplodePacket;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.util.random.WeightedList;
import net.minecraft.world.phys.Vec3;

// Client-side-only explosion effect; does not destroy blocks
ClientboundExplodePacket packet = new ClientboundExplodePacket(
    new Vec3(x, y, z),                 // Center coordinates
    3.0f,                              // Radius (affects visual effect)
    0,                                 // Number of affected blocks (0 = destroys nothing)
    java.util.Optional.empty(),        // Player knockback
    ParticleTypes.EXPLOSION_EMITTER,   // Explosion particles
    SoundEvents.GENERIC_EXPLODE,       // Sound
    WeightedList.of()                  // Block debris particles (empty = none)
);
```

---

### Player State

#### `ClientboundSetHealthPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetHealthPacket;

// health: 0.0–20.0, foodLevel: 0–20, saturation: 0.0–5.0
ClientboundSetHealthPacket packet =
    new ClientboundSetHealthPacket(20.0f, 20, 5.0f);
```

---

#### `ClientboundSetExperiencePacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetExperiencePacket;

// progress: 0.0–1.0 (progress bar), totalExp: total experience, level: level
ClientboundSetExperiencePacket packet =
    new ClientboundSetExperiencePacket(0.5f, 100, 10);
```

---

#### `ClientboundContainerSetSlotPacket`
```java
import net.minecraft.network.protocol.game.ClientboundContainerSetSlotPacket;

// containerId: -1=player inventory, -2=all slots, 0+=opened container ID
ClientboundContainerSetSlotPacket packet = new ClientboundContainerSetSlotPacket(
    -1,         // containerId (-1 = player inventory)
    stateId,    // stateId (usually 0)
    slotIndex,  // Slot index (0=helmet, 1=chestplate, 2=leggings, 3=boots, 9-44=inventory)
    nmsItemStack
);
```

---

### Network

#### `ClientboundCustomPayloadPacket` (Plugin Message)
```java
import net.minecraft.network.protocol.common.ClientboundCustomPayloadPacket;
import net.minecraft.network.protocol.common.custom.DiscardedPayload;
import net.minecraft.resources.Identifier;

Identifier channel = Identifier.fromNamespaceAndPath("myplugin", "sync");
byte[] data = /* your data */;

// 1.20.5+: CustomPacketPayload changed to type() + StreamCodec; for raw bytes on an arbitrary channel use Paper's DiscardedPayload
ClientboundCustomPayloadPacket packet =
    new ClientboundCustomPayloadPacket(new DiscardedPayload(channel, data));
```

---

#### `ClientboundDisconnectPacket`
```java
import net.minecraft.network.protocol.login.ClientboundLoginDisconnectPacket;
import net.minecraft.network.protocol.common.ClientboundDisconnectPacket; // Moved to common in 1.20.2+

// Kick during the Game phase
ClientboundDisconnectPacket packet =
    new ClientboundDisconnectPacket(Component.literal("You were kicked"));
```

---

## Serverbound Packets (Client → Server)

### Movement

#### `ServerboundMovePlayerPacket` Family

| Class | Data sent |
|------|---------|
| `ServerboundMovePlayerPacket.Pos` | Position (x, y, z) + onGround |
| `ServerboundMovePlayerPacket.PosRot` | Position + rotation (yaw, pitch) + onGround |
| `ServerboundMovePlayerPacket.Rot` | Rotation only + onGround |
| `ServerboundMovePlayerPacket.StatusOnly` | onGround state only |

Interception example:
```java
import net.minecraft.network.protocol.game.ServerboundMovePlayerPacket;

if (msg instanceof ServerboundMovePlayerPacket.PosRot move) {
    double x = move.getX(player.getX());
    double y = move.getY(player.getY());
    double z = move.getZ(player.getZ());
    float yaw = move.getYRot(player.getYRot());
}
```

---

### Interaction

#### `ServerboundInteractPacket` / `ServerboundAttackPacket`
**26.2**: `ServerboundInteractPacket` became a record, and attacking was split into a separate `ServerboundAttackPacket`.

```java
// @only 26.2
import net.minecraft.network.protocol.game.ServerboundAttackPacket;
import net.minecraft.network.protocol.game.ServerboundInteractPacket;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.Vec3;

if (msg instanceof ServerboundInteractPacket interact) {
    int entityId = interact.entityId();
    InteractionHand hand = interact.hand();      // MAIN_HAND / OFF_HAND
    Vec3 location = interact.location();         // Interaction point (relative to the entity)
    boolean sneaking = interact.usingSecondaryAction();
} else if (msg instanceof ServerboundAttackPacket attack) {
    int entityId = attack.entityId();
}
```

**1.21.11**: the same `ServerboundInteractPacket` covers both interaction and attack, distinguished through `dispatch(Handler)`.

```java
// @only 1.21.11
import net.minecraft.network.protocol.game.ServerboundInteractPacket;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.Vec3;

if (msg instanceof ServerboundInteractPacket interact) {
    int entityId = interact.getEntityId();
    boolean sneaking = interact.isUsingSecondaryAction();
    interact.dispatch(new ServerboundInteractPacket.Handler() {
        @Override public void onInteraction(InteractionHand hand) { /* Right-click entity */ }
        @Override public void onInteraction(InteractionHand hand, Vec3 location) { /* Right-click entity (with interaction point) */ }
        @Override public void onAttack() { /* Left-click attack */ }
    });
}
```

#### `ServerboundUseItemPacket`
```java
import net.minecraft.network.protocol.game.ServerboundUseItemPacket;
import net.minecraft.world.InteractionHand;

if (msg instanceof ServerboundUseItemPacket use) {
    InteractionHand hand = use.getHand(); // MAIN_HAND or OFF_HAND
}
```

---

### Chat

#### `ServerboundChatPacket`
```java
import net.minecraft.network.protocol.game.ServerboundChatPacket;

if (msg instanceof ServerboundChatPacket chat) {
    String message = chat.message(); // Chat text
    // chat.timeStamp()  — message timestamp
}
```

#### `ServerboundChatCommandPacket`
```java
import net.minecraft.network.protocol.game.ServerboundChatCommandPacket;

if (msg instanceof ServerboundChatCommandPacket cmd) {
    String command = cmd.command(); // Command string without the "/"
}
```

---

### Player Action

#### `ServerboundPlayerActionPacket`
```java
import net.minecraft.network.protocol.game.ServerboundPlayerActionPacket;
import net.minecraft.network.protocol.game.ServerboundPlayerActionPacket.Action;

if (msg instanceof ServerboundPlayerActionPacket action) {
    Action type = action.getAction();
    // Action.START_DESTROY_BLOCK   — start mining
    // Action.STOP_DESTROY_BLOCK    — stop mining
    // Action.ABORT_DESTROY_BLOCK   — cancel mining
    // Action.DROP_ALL_ITEMS        — drop the whole stack (Q+Ctrl)
    // Action.DROP_ITEM             — drop a single item (Q)
    // Action.RELEASE_USE_ITEM      — release the use key (bow shot)
    // Action.SWAP_ITEM_WITH_OFFHAND — swap hands (F key)
}
```

#### `ServerboundSwingPacket`
```java
import net.minecraft.network.protocol.game.ServerboundSwingPacket;

if (msg instanceof ServerboundSwingPacket swing) {
    InteractionHand hand = swing.getHand(); // Which hand swung
}
```

---

## FriendlyByteBuf Common Operations

```java
import net.minecraft.network.FriendlyByteBuf;
import io.netty.buffer.Unpooled;

FriendlyByteBuf buf = new FriendlyByteBuf(Unpooled.buffer());

// Write
buf.writeInt(42);
buf.writeUtf("hello");
buf.writeBoolean(true);
buf.writeFloat(3.14f);
buf.writeVarInt(1000);       // Compressed integer (common in packets)
buf.writeIdentifier(Identifier.withDefaultNamespace("stone"));

// Read
int i = buf.readInt();
String s = buf.readUtf(32767);  // Max length
boolean b = buf.readBoolean();
float f = buf.readFloat();
int vi = buf.readVarInt();
```

---

## Related Skills

- `Skills/nms/nms-packet-sender/SKILL.md` — Sending packets
- `Skills/nms/nms-packet-interceptor/SKILL.md` — Intercepting packets
- `Skills/_shared/nms-threading.md` — Thread safety
- `docs/paper-nms/network.md` — Netty pipeline structure
