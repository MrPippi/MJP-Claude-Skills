# examples — nms-data-component

## Example 1: Read and write custom CustomData fields

**Input:**
```
package_name: com.example.item
```

**Output — store a player UUID in the item as a binding marker:**
```java
// Write the bound UUID
org.bukkit.inventory.ItemStack bound = CustomDataHelper.setString(
    item, "bound_to", player.getUniqueId().toString());
player.getInventory().setItemInMainHand(bound);

// Read and verify
String boundTo = CustomDataHelper.getString(
    player.getInventory().getItemInMainHand(), "bound_to").orElse(null);

if (!player.getUniqueId().toString().equals(boundTo)) {
    player.sendMessage("§cThis item is bound to another player!");
    event.setCancelled(true);
}
```

---

## Example 2: Set the item's max stack size

**Input:**
```
package_name: com.example.item
```

**Output — create a special item with a custom stack limit:**
```java
org.bukkit.inventory.ItemStack customItem =
    new org.bukkit.inventory.ItemStack(Material.PAPER);

// Set max stack size to 16
customItem = ItemComponentUtil.setMaxStackSize(customItem, 16);

// Check that it was applied
boolean has = ItemComponentUtil.has(customItem, DataComponents.MAX_STACK_SIZE);
Optional<Integer> maxSize = ItemComponentUtil.get(customItem, DataComponents.MAX_STACK_SIZE);
player.sendMessage("Max stack size: " + maxSize.orElse(64));
```

---

## Example 3: Make an item unbreakable

**Input:**
```
package_name: com.example.item
```

**Output — create an unbreakable artifact (showing the Unbreakable tooltip):**
```java
org.bukkit.inventory.ItemStack artifact =
    new org.bukkit.inventory.ItemStack(Material.NETHERITE_SWORD);

// Make unbreakable (showTooltip=true shows the tooltip)
artifact = ItemComponentUtil.setUnbreakable(artifact, true);

player.getInventory().addItem(artifact);
player.sendMessage("§dYou obtained an unbreakable artifact!");
```

---

## Example 4: Read enchantment info

**Input:**
```
package_name: com.example.item
```

**Output — read the NMS enchantment list and display it:**
```java
org.bukkit.inventory.ItemStack sword = player.getInventory().getItemInMainHand();

ItemComponentUtil.getEnchantments(sword).ifPresent(enchantments -> {
    player.sendMessage("§6=== Enchantments ===");
    enchantments.entrySet().forEach(entry -> {
        // entry.getKey() is a Holder<Enchantment>; .value() returns the Enchantment
        // entry.getIntValue() is the enchantment level
        player.sendMessage("§f- " + entry.getKey().value().description().getString()
            + " §e" + entry.getIntValue());
    });
});
```
