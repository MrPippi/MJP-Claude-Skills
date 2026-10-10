# examples — nms-block-entity

## Example 1: Read BlockEntity data

**Input:**
```
package_name: com.example.block
entity_class_name: GeneratorBlockEntity
has_ticker: true
```

**Output — show stored energy when a player right-clicks the block:**
```java
@EventHandler
public void onInteract(PlayerInteractEvent event) {
    if (event.getAction() != Action.RIGHT_CLICK_BLOCK) return;
    Block block = event.getClickedBlock();
    if (block == null) return;

    BlockEntityHelper.getCustom(block.getLocation()).ifPresent(be -> {
        event.getPlayer().sendMessage("§6Stored energy: §e" + be.getStoredEnergy());
        event.getPlayer().sendMessage("§6Owner: §f" + be.getOwnerName());
    });
}
```

---

## Example 2: Modify BlockEntity data and sync to clients

**Input:**
```
package_name: com.example.block
```

**Output — command that charges a BlockEntity (must run on the main thread):**
```java
public void chargeGenerator(Location loc, int amount) {
    BlockEntityHelper.getCustom(loc).ifPresent(be -> {
        int newEnergy = Math.min(be.getStoredEnergy() + amount, 1000);
        be.setStoredEnergy(newEnergy); // markDirtyAndSync() is already called internally
    });
}
```

---

## Example 3: Ticker auto-charges every second

**Input:**
```
package_name: com.example.block
has_ticker: true
```

**Output — CustomBlockEntityTicker adds 10 energy every 20 ticks (already built into the SKILL.md template):**
```java
// Return the Ticker from the custom block's getTicker() method
@Override
@Nullable
public <T extends BlockEntity> BlockEntityTicker<T> getTicker(
        Level level, BlockState state, BlockEntityType<T> type) {
    if (level.isClientSide()) return null;
    return createTickerHelper(type, MY_BLOCK_ENTITY_TYPE, new CustomBlockEntityTicker());
}
```

---

## Example 4: NBT persistence check

**Input:**
```
package_name: com.example.block
```

**Output — confirm BlockEntity data is not lost after a server restart:**
```java
// Save data
BlockEntityHelper.getCustom(loc).ifPresent(be -> {
    be.setOwnerName("Steve");
    be.setStoredEnergy(500);
    // setStoredEnergy calls setChanged() internally; data is written on the next chunk save
});

// Read after restart (no extra steps; NMS restores from NBT automatically)
BlockEntityHelper.getCustom(loc).ifPresent(be -> {
    assert be.getOwnerName().equals("Steve");   // ✅ Persistence succeeded
    assert be.getStoredEnergy() == 500;         // ✅ Energy restored correctly
});
```
