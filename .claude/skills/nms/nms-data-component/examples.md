# examples — nms-data-component

## 範例 1：讀寫 CustomData 自定義欄位

**Input:**
```
package_name: com.example.item
```

**Output — 在物品中儲存玩家 UUID 作為綁定標記:**
```java
// 寫入綁定 UUID
org.bukkit.inventory.ItemStack bound = CustomDataHelper.setString(
    item, "bound_to", player.getUniqueId().toString());
player.getInventory().setItemInMainHand(bound);

// 讀取並驗證
String boundTo = CustomDataHelper.getString(
    player.getInventory().getItemInMainHand(), "bound_to").orElse(null);

if (!player.getUniqueId().toString().equals(boundTo)) {
    player.sendMessage("§c此物品已綁定給其他玩家！");
    event.setCancelled(true);
}
```

---

## 範例 2：設定物品最大堆疊數

**Input:**
```
package_name: com.example.item
```

**Output — 建立可堆疊 64 個的特殊物品:**
```java
org.bukkit.inventory.ItemStack customItem =
    new org.bukkit.inventory.ItemStack(Material.PAPER);

// 設定最大堆疊 16
customItem = ItemComponentUtil.setMaxStackSize(customItem, 16);

// 檢查是否設定成功
boolean has = ItemComponentUtil.has(customItem, DataComponents.MAX_STACK_SIZE);
Optional<Integer> maxSize = ItemComponentUtil.get(customItem, DataComponents.MAX_STACK_SIZE);
player.sendMessage("最大堆疊: " + maxSize.orElse(64));
```

---

## 範例 3：設定不可破壞屬性

**Input:**
```
package_name: com.example.item
```

**Output — 建立不可破壞的神器（顯示 Unbreakable 標籤）:**
```java
org.bukkit.inventory.ItemStack artifact =
    new org.bukkit.inventory.ItemStack(Material.NETHERITE_SWORD);

// 設定不可破壞（showTooltip=true 顯示標籤）
artifact = ItemComponentUtil.setUnbreakable(artifact, true);

player.getInventory().addItem(artifact);
player.sendMessage("§d你獲得了不可破壞的神器！");
```

---

## 範例 4：讀取附魔資訊

**Input:**
```
package_name: com.example.item
```

**Output — 讀取 NMS 附魔列表並顯示:**
```java
org.bukkit.inventory.ItemStack sword = player.getInventory().getItemInMainHand();

ItemComponentUtil.getEnchantments(sword).ifPresent(enchantments -> {
    player.sendMessage("§6=== 附魔列表 ===");
    enchantments.entrySet().forEach(entry -> {
        // entry.getKey() 是 Holder<Enchantment>，.value() 取得 Enchantment
        // entry.getIntValue() 是附魔等級
        player.sendMessage("§f- " + entry.getKey().value().getDescriptionId()
            + " §e" + entry.getIntValue());
    });
});
```
