# examples — nms-nbt-manipulation

## Example 1: Item ID tagging (anti-forgery / identification)

**Input:**
```
package_name: com.example.nbt
target: item
```

**Output - write an ID when issuing the item, verify it when retrieved:**
```java
// Write
org.bukkit.inventory.ItemStack marked = ItemNbtHelper.setString(item, "myplugin:item_id", "legendary_sword");

// Verify
String id = ItemNbtHelper.getString(markedItem, "myplugin:item_id").orElse(null);
if ("legendary_sword".equals(id)) {
    player.sendMessage("This is the legendary sword!");
}
```

---

## Example 2: Item integer attribute (durability counter)

**Input:**
```
package_name: com.example.nbt
target: item
```

**Output - track a custom use count:**
```java
// Read the current use count
int uses = ItemNbtHelper.getInt(item, "uses", 0);

// Increment and write back
org.bukkit.inventory.ItemStack updated = ItemNbtHelper.setInt(item, "uses", uses + 1);
player.getInventory().setItemInMainHand(updated);

// Consume the item when the limit is reached
if (uses + 1 >= 100) {
    player.getInventory().setItemInMainHand(null);
    player.sendMessage("The item is used up!");
}
```

---

## Example 3: Custom entity data storage

**Input:**
```
package_name: com.example.nbt
target: entity
```

**Output - read and write entity NBT markers (call on the main thread):**
```java
// Write owner info to the entity
CompoundTag patch = new CompoundTag();
patch.putString("myplugin:owner", player.getName());
EntityNbtHelper.mergeTag(entity, patch);

// Read
String owner = EntityNbtHelper.getString(entity, "myplugin:owner", "unknown");
player.sendMessage("Owner of this entity: " + owner);
```

---

## Example 4: Custom object serialization

**Input:**
```
package_name: com.example.nbt
target: item
```

**Output - serialize PlayerData into item NBT to carry player data:**
```java
NbtSerializer.PlayerData data = new NbtSerializer.PlayerData("Steve", 42, 9800.5);
CompoundTag serialized = NbtSerializer.serialize(data);

// Store on the item
org.bukkit.inventory.ItemStack item = new org.bukkit.inventory.ItemStack(Material.PAPER);
ItemStack nms = CraftItemStack.asNMSCopy(item);
// 1.20.5+: item NBT is stored in the minecraft:custom_data component
CustomData.update(DataComponents.CUSTOM_DATA, nms, tag -> tag.put("playerData", serialized));
item = CraftItemStack.asBukkitCopy(nms);

// Read back
CompoundTag tag = CraftItemStack.asNMSCopy(item)
    .getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY).copyTag();
// 1.21.5+ getCompound returns Optional<CompoundTag>
tag.getCompound("playerData").map(NbtSerializer::deserialize).ifPresent(loaded ->
    player.sendMessage("Player: " + loaded.name() + " Lv." + loaded.level()));
```
