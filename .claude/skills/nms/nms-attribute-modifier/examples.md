# examples — nms-attribute-modifier

## 範例 1：RPG 裝備加成攻擊力

**Input:**
```
package_name: com.example.rpg
```

**Output — 玩家穿戴裝備時加成攻擊力:**
```java
@EventHandler
public void onEquip(PlayerItemHeldEvent event) {
    Player player = event.getPlayer();
    // 移除舊加成
    AttributeUtil.removeModifier(player, Attributes.ATTACK_DAMAGE,
        ResourceLocation.fromNamespaceAndPath("myplugin", "sword_bonus"));

    org.bukkit.inventory.ItemStack held = player.getInventory().getItem(event.getNewSlot());
    if (held != null && held.getType() == Material.DIAMOND_SWORD) {
        // 新增 +5 攻擊力
        AttributeUtil.addModifier(player, Attributes.ATTACK_DAMAGE,
            ModifierBuilder.addition("myplugin", "sword_bonus", 5.0));
    }
}
```

---

## 範例 2：Buff/Debuff 系統（速度倍率）

**Input:**
```
package_name: com.example.rpg
```

**Output — 施加 50% 移速加速 Buff，持續 10 秒:**
```java
public void applySpeedBuff(Player player, Plugin plugin) {
    AttributeUtil.addModifier(player, Attributes.MOVEMENT_SPEED,
        ModifierBuilder.multiplyBase("myplugin", "speed_buff", 0.5)); // +50%

    // 10 秒後移除
    Bukkit.getScheduler().runTaskLater(plugin, () -> {
        AttributeUtil.removeModifier(player, Attributes.MOVEMENT_SPEED,
            ResourceLocation.fromNamespaceAndPath("myplugin", "speed_buff"));
    }, 200L);
}
```

---

## 範例 3：動態設定 Boss 血量

**Input:**
```
package_name: com.example.rpg
```

**Output — 依難度動態設定 Boss 最大血量:**
```java
public void spawnBoss(Location loc, int difficulty) {
    // 生成 NMS 自定義 Zombie（配合 nms-custom-entity 技能）
    org.bukkit.entity.Zombie zombie = (org.bukkit.entity.Zombie)
        loc.getWorld().spawnEntity(loc, org.bukkit.entity.EntityType.ZOMBIE);

    // 設定基底最大血量（依難度 50/100/200）
    double maxHp = 50.0 * Math.pow(2, difficulty - 1);
    AttributeUtil.setMaxHealth(zombie, maxHp);
    zombie.setHealth(maxHp);

    // 附加攻擊力加成
    AttributeUtil.addModifier(zombie, Attributes.ATTACK_DAMAGE,
        ModifierBuilder.multiplyTotal("myplugin", "boss_attack_" + difficulty,
            difficulty * 0.5)); // 難度 1 = ×1.5，難度 2 = ×2.0
}
```

---

## 範例 4：讀取屬性值並顯示

**Input:**
```
package_name: com.example.rpg
```

**Output — 指令顯示玩家當前所有屬性值:**
```java
player.sendMessage("§6=== 屬性面板 ===");
player.sendMessage("§f最大血量: §c" + String.format("%.1f", AttributeUtil.getMaxHealth(player)));
player.sendMessage("§f攻擊力: §e" + String.format("%.2f", AttributeUtil.getAttackDamage(player)));
player.sendMessage("§f移動速度: §a" + String.format("%.4f", AttributeUtil.getMovementSpeed(player)));

// 顯示基底值 vs 最終值
double baseHp = AttributeUtil.getBaseValue(player, Attributes.MAX_HEALTH);
double finalHp = AttributeUtil.getValue(player, Attributes.MAX_HEALTH);
player.sendMessage("§7(基底 §c" + baseHp + " §7→ 最終 §c" + String.format("%.1f", finalHp) + "§7)");
```
