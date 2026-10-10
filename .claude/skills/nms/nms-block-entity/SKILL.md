---
name: nms-block-entity
description: "實作自定義 NMS BlockEntity（含 NBT serialization、Tick 邏輯、Client sync），比 Bukkit BlockState 更靈活（Paper NMS + Mojang-mapped）/ Implement custom NMS BlockEntity with NBT serialization, tick logic, and client sync"
---

# NMS Block Entity

## Skill Name

`nms-block-entity`

## Purpose

Extend NMS `BlockEntity` to implement a custom block entity with NBT read/write, server-side tick logic (`BlockEntityTicker`), and state sync to the client via packets.

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- 「BlockEntity」「TileEntity」「自定義方塊實體」「block entity」「tile entity」
- 「方塊 tick」「block tick」「BlockEntityTicker」「方塊 NBT」「block nbt」
- 「自定義方塊 NMS」「custom block nms」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.block` | Package for the generated classes |
| `entity_class_name` | `GeneratorBlockEntity` | BlockEntity subclass name |
| `has_ticker` | `true` | Whether tick logic is needed |
| `base_block` | `CHEST` | Which NMS block to use as the carrier |

## Outputs

- `CustomBlockEntity.java` — BlockEntity implementation (with NBT load/save)
- `CustomBlockEntityTicker.java`(optional) — ServerLevel tick logic
- `BlockEntityHelper.java` — utility for getting/setting BlockEntity in the world

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `CustomBlockEntity.java`

```java
package com.example.block;

import net.minecraft.core.BlockPos;
import net.minecraft.core.HolderLookup;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientGamePacketListener;
import net.minecraft.network.protocol.game.ClientboundBlockEntityDataPacket;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;

import javax.annotation.Nullable;

@SuppressWarnings("UnstableApiUsage")
public class CustomBlockEntity extends BlockEntity {

    // Custom fields
    private int storedEnergy = 0;
    private String ownerName = "";

    public CustomBlockEntity(BlockEntityType<?> type, BlockPos pos, BlockState state) {
        super(type, pos, state);
    }

    // ─── NBT serialization ──────────────────────────────────────────────────

    /**
     * Saves custom data (world save + packet sync).
     * Since 1.21.6 this uses the ValueOutput abstraction (no longer operates on CompoundTag + HolderLookup.Provider directly).
     */
    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putInt("storedEnergy", storedEnergy);
        output.putString("ownerName", ownerName);
    }

    /** Loads custom data (world load + packet receive); uses defaults when a field is missing. */
    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        storedEnergy = input.getIntOr("storedEnergy", 0);
        ownerName = input.getStringOr("ownerName", "");
    }

    // ─── Client sync ──────────────────────────────────────────────────

    /** Creates the update packet sent to the client (BlockEntityDataPacket). */
    @Override
    @Nullable
    public Packet<ClientGamePacketListener> getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }

    /** Gets the NBT used for packet sync (may include only the necessary fields). */
    @Override
    public CompoundTag getUpdateTag(HolderLookup.Provider provider) {
        return saveWithoutMetadata(provider);
    }

    /** Notifies clients of a state change (the update packet is sent automatically after the call). */
    public void markDirtyAndSync() {
        setChanged();
        if (level != null && !level.isClientSide()) {
            level.sendBlockUpdated(worldPosition, getBlockState(), getBlockState(), 3);
        }
    }

    // ─── Getter/Setter ───────────────────────────────────────────────

    public int getStoredEnergy() { return storedEnergy; }

    public void setStoredEnergy(int energy) {
        this.storedEnergy = energy;
        markDirtyAndSync();
    }

    public String getOwnerName() { return ownerName; }

    public void setOwnerName(String name) {
        this.ownerName = name;
        markDirtyAndSync();
    }
}
```

### `CustomBlockEntityTicker.java`(tick logic)

```java
package com.example.block;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.state.BlockState;

@SuppressWarnings("UnstableApiUsage")
public class CustomBlockEntityTicker implements BlockEntityTicker<CustomBlockEntity> {

    private static final int TICK_INTERVAL = 20; // Runs once per second
    private int tickCount = 0;

    @Override
    public void tick(Level level, BlockPos pos, BlockState state, CustomBlockEntity entity) {
        if (level.isClientSide()) return; // Server side only

        tickCount++;
        if (tickCount % TICK_INTERVAL != 0) return;

        // Run the logic every 20 ticks (1 second)
        if (entity.getStoredEnergy() < 1000) {
            entity.setStoredEnergy(entity.getStoredEnergy() + 10);
        }
    }
}
```

### `BlockEntityHelper.java`(world operation utility)

```java
package com.example.block;

import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.entity.BlockEntity;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.craftbukkit.CraftWorld;

import java.util.Optional;

@SuppressWarnings("UnstableApiUsage")
public final class BlockEntityHelper {

    private BlockEntityHelper() {}

    /** Gets the BlockEntity at the given location (returns empty if the type does not match). */
    @SuppressWarnings("unchecked")
    public static <T extends BlockEntity> Optional<T> get(
            Location loc, Class<T> type) {
        net.minecraft.world.level.Level level = ((CraftWorld) loc.getWorld()).getHandle();
        BlockPos pos = new BlockPos(loc.getBlockX(), loc.getBlockY(), loc.getBlockZ());
        BlockEntity be = level.getBlockEntity(pos);
        if (type.isInstance(be)) return Optional.of(type.cast(be));
        return Optional.empty();
    }

    /** Gets the custom BlockEntity at the given location. */
    public static Optional<CustomBlockEntity> getCustom(Location loc) {
        return get(loc, CustomBlockEntity.class);
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── block/
    ├── CustomBlockEntity.java
    ├── CustomBlockEntityTicker.java
    └── BlockEntityHelper.java
```

## Thread Safety

- ⚠️ All BlockEntity operations (read, modify, `markDirtyAndSync()`) **must be called on the main thread**
- ⚠️ `tick()` is called by NMS on the main thread; do not perform blocking IO inside it
- ⚠️ Check `level.isClientSide()` inside tick to avoid running server logic on the client tick
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| NBT data lost | `saveAdditional` does not call `super` | Make sure to call `super.saveAdditional(tag, provider)` |
| Client out of sync | `markDirtyAndSync()` not called | Call it after every field change |
| `getBlockEntity()` returns null | No BlockEntity at the block position | Verify the block type supports a BlockEntity |
| Tick does not run | BlockEntityType not registered correctly | In a Paper plugin environment, register the type through RegistryAccess |
