# examples — nms-nbt-manipulation

## 範例 1：物品 ID 標記（防偽/識別用途）

**Input:**
```
package_name: com.example.nbt
target: item
```

**Output — 在發放物品時寫入 ID，取回時驗證:**
```java
// 寫入
org.bukkit.inventory.ItemStack marked = ItemNbtHelper.setString(item, "myplugin:item_id", "legendary_sword");

// 驗證
String id = ItemNbtHelper.getString(markedItem, "myplugin:item_id").orElse(null);
if ("legendary_sword".equals(id)) {
    player.sendMessage("這是傳說之劍！");
}
```

---

## 範例 2：物品整數屬性（耐久計數）

**Input:**
```
package_name: com.example.nbt
target: item
```

**Output — 追蹤自定義使用次數:**
```java
// 讀取當前使用次數
int uses = ItemNbtHelper.getInt(item, "uses", 0);

// 增加並寫回
org.bukkit.inventory.ItemStack updated = ItemNbtHelper.setInt(item, "uses", uses + 1);
player.getInventory().setItemInMainHand(updated);

// 超過上限則消耗
if (uses + 1 >= 100) {
    player.getInventory().setItemInMainHand(null);
    player.sendMessage("道具已用盡！");
}
```

---

## 範例 3：實體自定義資料儲存

**Input:**
```
package_name: com.example.nbt
target: entity
```

**Output — 讀寫實體 NBT 標記（在主執行緒呼叫）:**
```java
// 寫入 owner 資訊到實體
CompoundTag patch = new CompoundTag();
patch.putString("myplugin:owner", player.getName());
EntityNbtHelper.mergeTag(entity, patch);

// 讀取
String owner = EntityNbtHelper.getString(entity, "myplugin:owner", "unknown");
player.sendMessage("此實體的主人：" + owner);
```

---

## 範例 4：自定義物件序列化

**Input:**
```
package_name: com.example.nbt
target: item
```

**Output — 將 PlayerData 序列化到物品 NBT，用於傳遞玩家資料:**
```java
NbtSerializer.PlayerData data = new NbtSerializer.PlayerData("Steve", 42, 9800.5);
CompoundTag serialized = NbtSerializer.serialize(data);

// 存到物品
org.bukkit.inventory.ItemStack item = new org.bukkit.inventory.ItemStack(Material.PAPER);
ItemStack nms = CraftItemStack.asNMSCopy(item);
nms.getOrCreateTag().put("playerData", serialized);
item = CraftItemStack.asBukkitCopy(nms);

// 讀回
CompoundTag tag = CraftItemStack.asNMSCopy(item).getTag();
if (tag != null && tag.contains("playerData")) {
    NbtSerializer.PlayerData loaded = NbtSerializer.deserialize(tag.getCompound("playerData"));
    player.sendMessage("玩家：" + loaded.name() + " Lv." + loaded.level());
}
```
