# examples — nms-player-profile

## Example 1: Copy an online player's skin to an NPC

**Input:**
```
package_name: com.example.npc
fetch_async: false
```

**Output - copy the Profile directly from an online player (main thread):**
```java
// Copy the online player's GameProfile directly
Player target = Bukkit.getPlayer("Notch");
if (target != null) {
    GameProfile profile = ProfileBuilder.copyFrom(target);
    // Create the NPC entity with this profile (together with the nms-custom-entity skill)
    spawnNpcWithProfile(location, profile);
}
```

---

## Example 2: Fetch an offline player's skin asynchronously

**Input:**
```
package_name: com.example.npc
fetch_async: true
```

**Output - fetch asynchronously, then apply on the main thread:**
```java
// Fetch the skin asynchronously (does not block the main thread)
SkinFetcher.fetchByName(plugin, "Notch").thenAccept(profile -> {
    if (profile == null) {
        plugin.getLogger().warning("Player skin not found");
        return;
    }

    String value = SkinFetcher.getTextureValue(profile);
    String signature = SkinFetcher.getTextureSignature(profile);

    // Switch back to the main thread and apply to the NPC
    Bukkit.getScheduler().runTask(plugin, () -> {
        GameProfile npcProfile = ProfileBuilder.withSkin("NotchNPC", value, signature);
        spawnNpcWithProfile(location, npcProfile);
    });
});
```

---

## Example 3: Custom skin (pre-obtained Base64 texture)

**Input:**
```
package_name: com.example.npc
```

**Output - build a GameProfile directly from a Base64 texture (no API request):**
```java
// The texture string must come from namemc.com or be obtained from the session API yourself
String textureValue = "eyJ0aW1lc3RhbXAiOjE2NjI5ODY... (omitted)";
String textureSignature = "HkiDt0GiT3gGiHj... (omitted)";

GameProfile customProfile = ProfileBuilder.withSkin("CustomNPC", textureValue, textureSignature);

// Create a skull item with this skin
org.bukkit.inventory.ItemStack skull = SkullBuilder.withProfile(customProfile);
player.getInventory().addItem(skull);
```

---

## Example 4: Create an NPC from the server cache

**Input:**
```
package_name: com.example.npc
```

**Output - quickly get the Profile of a previously joined player from the local cache:**
```java
// Only works for players who have joined this server (present in usercache.json)
GameProfile cached = ProfileBuilder.fromCache("Steve");
if (cached != null) {
    // Create a skull with the skin
    org.bukkit.inventory.ItemStack skull = SkullBuilder.withProfile(cached);
    player.getInventory().addItem(skull);
} else {
    player.sendMessage("§cPlayer Steve has never joined this server");
}
```
