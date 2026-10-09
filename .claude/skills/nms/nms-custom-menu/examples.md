# examples — nms-custom-menu

## 範例 1：開啟基礎 3 列 GUI

**Input:**
```
package_name: com.example.gui
menu_class_name: ShopMenu
menu_type: GENERIC_9x3
rows: 3
```

**Output — 在指令中開啟 GUI:**
```java
@Override
public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
    if (!(sender instanceof Player player)) return true;

    // 必須在主執行緒呼叫
    ServerPlayer nms = ((CraftPlayer) player).getHandle();
    nms.openMenu(new CustomMenuProvider("§6商店"));
    return true;
}
```

---

## 範例 2：預填 GUI 物品並攔截點擊

**Input:**
```
package_name: com.example.gui
menu_class_name: ShopMenu
rows: 3
```

**Output — 在 CustomMenu 建構子中預填物品，並在 Listener 處理點擊:**
```java
// CustomMenu 建構子新增（在 slot 注册後）
public CustomMenu(int syncId, Inventory playerInventory) {
    super(MenuType.GENERIC_9x3, syncId);
    // ...（原有 slot 注册）

    // 預填 GUI 內容（直接操作 menuInventory）
    menuInventory.setItem(0, createShopItem(Material.DIAMOND_SWORD, "§b傳說之劍", 1000));
    menuInventory.setItem(1, createShopItem(Material.GOLDEN_APPLE, "§e黃金蘋果", 50));
}

private static net.minecraft.world.item.ItemStack createShopItem(
        Material material, String name, int price) {
    org.bukkit.inventory.ItemStack bukkit = new org.bukkit.inventory.ItemStack(material);
    ItemMeta meta = bukkit.getItemMeta();
    meta.setDisplayName(name);
    meta.setLore(List.of("§7價格: §6" + price + " 金幣"));
    bukkit.setItemMeta(meta);
    return CraftItemStack.asNMSCopy(bukkit);
}
```

**Listener 處理點擊購買:**
```java
@EventHandler
public void onInventoryClick(InventoryClickEvent event) {
    if (!(event.getView().getTopInventory().getHolder() instanceof CustomMenuHolder)) return;
    event.setCancelled(true);

    int slot = event.getRawSlot();
    if (slot == 0) purchaseItem(event.getWhoClicked(), "傳說之劍", 1000);
    if (slot == 1) purchaseItem(event.getWhoClicked(), "黃金蘋果", 50);
}
```

---

## 範例 3：帶有資料同步的倒計時 GUI

**Input:**
```
package_name: com.example.gui
menu_class_name: TimerMenu
rows: 1
```

**Output — 每秒更新 GUI 標題顯示倒計時（透過重開 GUI 更新標題）:**
```java
// 使用 BukkitRunnable 定期更新
new BukkitRunnable() {
    int remaining = 60;

    @Override
    public void run() {
        if (remaining <= 0 || !player.isOnline()) {
            cancel();
            player.closeInventory();
            return;
        }

        // 重新開啟 GUI 更新標題（NMS 方式）
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.containerMenu instanceof CustomMenu) {
            // 發送標題更新封包
            nms.connection.send(
                new net.minecraft.network.protocol.game.ClientboundOpenScreenPacket(
                    nms.containerMenu.containerId,
                    nms.containerMenu.getType(),
                    net.minecraft.network.chat.Component.literal("§c剩餘時間: " + remaining + "s")
                )
            );
        }
        remaining--;
    }
}.runTaskTimer(plugin, 0L, 20L);
```
