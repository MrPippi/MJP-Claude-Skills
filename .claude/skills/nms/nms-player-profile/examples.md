# examples — nms-player-profile

## 範例 1：複製線上玩家皮膚給 NPC

**Input:**
```
package_name: com.example.npc
fetch_async: false
```

**Output — 從在線玩家直接複製 Profile（主執行緒）:**
```java
// 直接複製在線玩家的 GameProfile
Player target = Bukkit.getPlayer("Notch");
if (target != null) {
    GameProfile profile = ProfileBuilder.copyFrom(target);
    // 用此 profile 建立 NPC 實體（配合 nms-custom-entity 技能）
    spawnNpcWithProfile(location, profile);
}
```

---

## 範例 2：非同步抓取離線玩家皮膚

**Input:**
```
package_name: com.example.npc
fetch_async: true
```

**Output — 非同步抓取後切回主執行緒套用:**
```java
// 非同步抓取皮膚（不阻塞主執行緒）
SkinFetcher.fetchByName(plugin, "Notch").thenAccept(profile -> {
    if (profile == null) {
        plugin.getLogger().warning("找不到玩家皮膚");
        return;
    }

    String value = SkinFetcher.getTextureValue(profile);
    String signature = SkinFetcher.getTextureSignature(profile);

    // 切回主執行緒套用到 NPC
    Bukkit.getScheduler().runTask(plugin, () -> {
        GameProfile npcProfile = ProfileBuilder.withSkin("NotchNPC", value, signature);
        spawnNpcWithProfile(location, npcProfile);
    });
});
```

---

## 範例 3：自定義皮膚（預先取得 Base64 texture）

**Input:**
```
package_name: com.example.npc
```

**Output — 直接用 Base64 texture 建立 GameProfile（不需 API 請求）:**
```java
// texture 字串需從 namemc.com 或自行從 session API 取得
String textureValue = "eyJ0aW1lc3RhbXAiOjE2NjI5ODY...（省略）";
String textureSignature = "HkiDt0GiT3gGiHj...（省略）";

GameProfile customProfile = ProfileBuilder.withSkin("CustomNPC", textureValue, textureSignature);

// 建立帶此皮膚的頭顱物品
org.bukkit.inventory.ItemStack skull = SkullBuilder.withProfile(customProfile);
player.getInventory().addItem(skull);
```

---

## 範例 4：從 server cache 建立 NPC

**Input:**
```
package_name: com.example.npc
```

**Output — 快速從本地 cache 取得曾加入過的玩家 Profile:**
```java
// 只對曾加入過此伺服器的玩家有效（存在 usercache.json）
GameProfile cached = ProfileBuilder.fromCache("Steve");
if (cached != null) {
    // 建立帶皮膚的頭顱
    org.bukkit.inventory.ItemStack skull = SkullBuilder.withProfile(cached);
    player.getInventory().addItem(skull);
} else {
    player.sendMessage("§c玩家 Steve 從未加入過此伺服器");
}
```
