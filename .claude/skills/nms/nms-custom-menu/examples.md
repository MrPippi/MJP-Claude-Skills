# examples — nms-custom-menu

## Example 1: Open a basic 3-row GUI

**Input:**
```
package_name: com.example.gui
menu_class_name: ShopMenu
menu_type: GENERIC_9x3
rows: 3
```

**Output — open the GUI from a command:**
```java
@Override
public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
    if (!(sender instanceof Player player)) return true;

    // Must be called on the main thread
    ServerPlayer nms = ((CraftPlayer) player).getHandle();
    nms.openMenu(new CustomMenuProvider("§6Shop"));
    return true;
}
```

---

## Example 2: Pre-fill GUI items and intercept clicks

**Input:**
```
package_name: com.example.gui
menu_class_name: ShopMenu
rows: 3
```

**Output — pre-fill items in the CustomMenu constructor and handle clicks in the listener:**
```java
// Added to the CustomMenu constructor (after slot registration)
public CustomMenu(int syncId, Inventory playerInventory) {
    super(MenuType.GENERIC_9x3, syncId);
    // ... (existing slot registration)

    // Pre-fill GUI contents (operate on menuInventory directly)
    menuInventory.setItem(0, createShopItem(Material.DIAMOND_SWORD, "§bLegendary Sword", 1000));
    menuInventory.setItem(1, createShopItem(Material.GOLDEN_APPLE, "§eGolden Apple", 50));
}

private static net.minecraft.world.item.ItemStack createShopItem(
        Material material, String name, int price) {
    org.bukkit.inventory.ItemStack bukkit = new org.bukkit.inventory.ItemStack(material);
    ItemMeta meta = bukkit.getItemMeta();
    meta.setDisplayName(name);
    meta.setLore(List.of("§7Price: §6" + price + " coins"));
    bukkit.setItemMeta(meta);
    return CraftItemStack.asNMSCopy(bukkit);
}
```

**Listener handles click-to-purchase:**
```java
@EventHandler
public void onInventoryClick(InventoryClickEvent event) {
    if (!(event.getView().getTopInventory().getHolder() instanceof CustomMenuHolder)) return;
    event.setCancelled(true);

    int slot = event.getRawSlot();
    if (slot == 0) purchaseItem(event.getWhoClicked(), "Legendary Sword", 1000);
    if (slot == 1) purchaseItem(event.getWhoClicked(), "Golden Apple", 50);
}
```

---

## Example 3: Countdown GUI with data synchronization

**Input:**
```
package_name: com.example.gui
menu_class_name: TimerMenu
rows: 1
```

**Output — update the GUI title every second to show a countdown (title updated by re-sending the open-screen packet):**
```java
// Use a BukkitRunnable for periodic updates
new BukkitRunnable() {
    int remaining = 60;

    @Override
    public void run() {
        if (remaining <= 0 || !player.isOnline()) {
            cancel();
            player.closeInventory();
            return;
        }

        // Re-open the GUI to update the title (NMS approach)
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.containerMenu instanceof CustomMenu) {
            // Send the title update packet
            nms.connection.send(
                new net.minecraft.network.protocol.game.ClientboundOpenScreenPacket(
                    nms.containerMenu.containerId,
                    nms.containerMenu.getType(),
                    net.minecraft.network.chat.Component.literal("§cTime left: " + remaining + "s")
                )
            );
        }
        remaining--;
    }
}.runTaskTimer(plugin, 0L, 20L);
```
