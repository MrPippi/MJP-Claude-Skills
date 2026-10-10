# examples — nms-attribute-modifier

## Example 1: RPG equipment attack bonus

**Input:**
```
package_name: com.example.rpg
```

**Output — add an attack bonus when a player equips an item:**
```java
@EventHandler
public void onEquip(PlayerItemHeldEvent event) {
    Player player = event.getPlayer();
    // Remove the old bonus
    AttributeUtil.removeModifier(player, Attributes.ATTACK_DAMAGE,
        Identifier.fromNamespaceAndPath("myplugin", "sword_bonus"));

    org.bukkit.inventory.ItemStack held = player.getInventory().getItem(event.getNewSlot());
    if (held != null && held.getType() == Material.DIAMOND_SWORD) {
        // Add +5 attack damage
        AttributeUtil.addModifier(player, Attributes.ATTACK_DAMAGE,
            ModifierBuilder.addition("myplugin", "sword_bonus", 5.0));
    }
}
```

---

## Example 2: Buff/Debuff system (speed multiplier)

**Input:**
```
package_name: com.example.rpg
```

**Output — apply a 50% movement speed Buff for 10 seconds:**
```java
public void applySpeedBuff(Player player, Plugin plugin) {
    AttributeUtil.addModifier(player, Attributes.MOVEMENT_SPEED,
        ModifierBuilder.multiplyBase("myplugin", "speed_buff", 0.5)); // +50%

    // Remove after 10 seconds
    Bukkit.getScheduler().runTaskLater(plugin, () -> {
        AttributeUtil.removeModifier(player, Attributes.MOVEMENT_SPEED,
            Identifier.fromNamespaceAndPath("myplugin", "speed_buff"));
    }, 200L);
}
```

---

## Example 3: Dynamically set Boss health

**Input:**
```
package_name: com.example.rpg
```

**Output — set Boss max health based on difficulty:**
```java
public void spawnBoss(Location loc, int difficulty) {
    // Spawn a custom NMS Zombie (use with the nms-custom-entity skill)
    org.bukkit.entity.Zombie zombie = (org.bukkit.entity.Zombie)
        loc.getWorld().spawnEntity(loc, org.bukkit.entity.EntityType.ZOMBIE);

    // Set base max health (50/100/200 by difficulty)
    double maxHp = 50.0 * Math.pow(2, difficulty - 1);
    AttributeUtil.setMaxHealth(zombie, maxHp);
    zombie.setHealth(maxHp);

    // Add attack damage bonus
    AttributeUtil.addModifier(zombie, Attributes.ATTACK_DAMAGE,
        ModifierBuilder.multiplyTotal("myplugin", "boss_attack_" + difficulty,
            difficulty * 0.5)); // difficulty 1 = x1.5, difficulty 2 = x2.0
}
```

---

## Example 4: Read and display attribute values

**Input:**
```
package_name: com.example.rpg
```

**Output — command that shows all of the player's current attribute values:**
```java
player.sendMessage("§6=== Attribute Panel ===");
player.sendMessage("§fMax health: §c" + String.format("%.1f", AttributeUtil.getMaxHealth(player)));
player.sendMessage("§fAttack damage: §e" + String.format("%.2f", AttributeUtil.getAttackDamage(player)));
player.sendMessage("§fMovement speed: §a" + String.format("%.4f", AttributeUtil.getMovementSpeed(player)));

// Show base value vs final value
double baseHp = AttributeUtil.getBaseValue(player, Attributes.MAX_HEALTH);
double finalHp = AttributeUtil.getValue(player, Attributes.MAX_HEALTH);
player.sendMessage("§7(base §c" + baseHp + " §7-> final §c" + String.format("%.1f", finalHp) + "§7)");
```
