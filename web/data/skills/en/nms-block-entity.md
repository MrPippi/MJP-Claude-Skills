# NMS Block Entity

## Purpose

Extend NMS `BlockEntity` to implement custom block entities, with NBT read/write, server-side tick logic (`BlockEntityTicker`), and state sync to the client via packets.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### CustomBlockEntity.java

```java
public class CustomBlockEntity extends BlockEntity {

    private int storedEnergy = 0;

    public CustomBlockEntity(BlockEntityType<?> type, BlockPos pos, BlockState state) {
        super(type, pos, state);
    }

    // 1.21.6+: serialization uses ValueOutput / ValueInput
    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putInt("storedEnergy", storedEnergy);
    }

    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        storedEnergy = input.getIntOr("storedEnergy", 0);
    }

    @Override
    public ClientboundBlockEntityDataPacket getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }
}
```

### BlockEntityHelper.java (utility class)

```java
// Get the custom BlockEntity at the given location
Optional<CustomBlockEntity> be = BlockEntityHelper.getCustom(location);

// Mark as modified (triggers NBT save and client sync)
be.ifPresent(CustomBlockEntity::markDirtyAndSync);
```

---

## Thread Safety

- All BlockEntity operations **must be called on the main thread**
- The `getUpdatePacket()` packet is sent on the Netty IO thread, so the data must be built on the main thread
