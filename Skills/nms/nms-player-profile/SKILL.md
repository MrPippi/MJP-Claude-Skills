---
name: nms-player-profile
description: "操作 GameProfile 進行 skin 注入，用於 NPC 外觀設定與假玩家實體（Paper NMS + Mojang-mapped）/ Manipulate GameProfile for skin injection used in NPC appearance and fake player entities"
---

# NMS Player Profile

## Skill Name

`nms-player-profile`

## Purpose

Manipulate player skin (texture) properties through the NMS `GameProfile` to inject NPC appearances, set skins on fake player entities, and display custom skulls.

### Related

- Need a player clone that moves, fights, and has vanilla physics -> [`nms-fake-player`](../nms-fake-player/SKILL.md) (a real `ServerPlayer`; reuses this skill's skin retrieval)
- Only need a player head skin -> Paper API `PlayerProfile` / `SkullMeta#setPlayerProfile` is enough; no NMS required

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- "GameProfile", "skin injection", "NPC 皮膚", "player profile", "skin NPC"
- "fake player", "假玩家", "NPC skin", "texture property", "玩家頭顱 skin"
- "profile skin", "gameprofile nms"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.npc` | Package of the generated classes |
| `class_name` | `ProfileBuilder` | Profile builder class name |
| `fetch_async` | `true` | Whether to fetch the skin from the Mojang API asynchronously |

## Outputs

- `ProfileBuilder.java` - GameProfile creation and skin injection utility
- `SkinFetcher.java` - Fetches skin textures from the Mojang API asynchronously
- `SkullBuilder.java` (optional) - Sets the skin on a skull ItemStack

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `ProfileBuilder.java`

```java
package com.example.npc;

import com.google.common.collect.ImmutableMultimap;
import com.mojang.authlib.GameProfile;
import com.mojang.authlib.properties.Property;
import com.mojang.authlib.properties.PropertyMap;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.players.NameAndId;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.CraftServer;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

import java.util.UUID;

@SuppressWarnings("UnstableApiUsage")
public final class ProfileBuilder {

    private ProfileBuilder() {}

    /**
     * Copies the GameProfile (including skin texture) from an existing player.
     * Used to copy a real player's appearance onto an NPC.
     */
    public static GameProfile copyFrom(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        return nms.getGameProfile();
    }

    /**
     * Creates a GameProfile with a custom skin.
     *
     * @param name      display name (recommended 16 characters or fewer)
     * @param textureValue   Base64-encoded texture JSON
     * @param textureSignature Mojang signature (may be null, but required in online mode)
     */
    public static GameProfile withSkin(String name, String textureValue, String textureSignature) {
        // authlib 7+: GameProfile is a record and PropertyMap is immutable, so properties must be passed at construction
        PropertyMap properties = new PropertyMap(ImmutableMultimap.of(
            "textures", new Property("textures", textureValue, textureSignature)));
        return new GameProfile(UUID.randomUUID(), name, properties);
    }

    /**
     * Creates a blank GameProfile without a skin (default Steve appearance).
     */
    public static GameProfile blank(String name) {
        return new GameProfile(UUID.randomUUID(), name);
    }

    /**
     * Looks up a known player's UUID + name from the server user cache (usercache.json) without any network request.
     * Only works for players who have joined this server before; the returned Profile has no skin, so use SkinFetcher when a skin is needed.
     */
    public static GameProfile fromCache(String playerName) {
        var minecraftServer = ((CraftServer) Bukkit.getServer()).getServer();
        NameAndId cached = minecraftServer.services().nameToIdCache().getIfCached(playerName);
        return cached != null ? cached.toUncompletedGameProfile() : null;
    }
}
```

### `SkinFetcher.java` (async fetch from the Mojang API)

```java
package com.example.npc;

import com.mojang.authlib.GameProfile;
import com.mojang.authlib.properties.Property;
import org.bukkit.Bukkit;
import org.bukkit.craftbukkit.CraftServer;
import org.bukkit.plugin.Plugin;

import java.util.concurrent.CompletableFuture;

@SuppressWarnings("UnstableApiUsage")
public final class SkinFetcher {

    private SkinFetcher() {}

    /**
     * Asynchronously fetches the full GameProfile (including skin) through the Mojang session server.
     * Returns a CompletableFuture whose result is produced on an async thread;
     * switch back to the main thread before using it.
     */
    public static CompletableFuture<GameProfile> fetchByName(Plugin plugin, String playerName) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                var minecraftServer = ((CraftServer) Bukkit.getServer()).getServer();
                // ProfileResolver: name -> UUID (user cache / Mojang API) -> session server returns a Profile with textures
                // Issues blocking network requests, so it may only be called on an async thread
                return minecraftServer.services().profileResolver()
                    .fetchByName(playerName)
                    .orElse(null);
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to fetch skin for " + playerName + ": " + e.getMessage());
                return null;
            }
        });
    }

    /** Returns the texture value (Base64 JSON) of a GameProfile. */
    public static String getTextureValue(GameProfile profile) {
        var textures = profile.properties().get("textures");
        if (textures.isEmpty()) return null;
        return textures.iterator().next().value();
    }

    /** Returns the texture signature of a GameProfile. */
    public static String getTextureSignature(GameProfile profile) {
        var textures = profile.properties().get("textures");
        if (textures.isEmpty()) return null;
        return textures.iterator().next().signature();
    }
}
```

### `SkullBuilder.java` (skull ItemStack skin)

```java
package com.example.npc;

import com.mojang.authlib.GameProfile;
import net.minecraft.core.component.DataComponents;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ResolvableProfile;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

@SuppressWarnings("UnstableApiUsage")
public final class SkullBuilder {

    private SkullBuilder() {}

    /**
     * Creates a player head ItemStack with the skin of the given GameProfile.
     * Since 1.20.5 the {@code minecraft:profile} component replaces the old SkullOwner NBT.
     */
    public static org.bukkit.inventory.ItemStack withProfile(GameProfile profile) {
        ItemStack nms = new ItemStack(Items.PLAYER_HEAD);
        nms.set(DataComponents.PROFILE, ResolvableProfile.createResolved(profile));
        return CraftItemStack.asBukkitCopy(nms);
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── npc/
    ├── ProfileBuilder.java
    ├── SkinFetcher.java
    └── SkullBuilder.java
```

## Thread Safety

- ✅ `ProfileBuilder` methods are pure data operations and can be called from any thread
- ✅ `SkinFetcher.fetchByName()` fetches on an async thread; **do not** touch the Bukkit/NMS world directly in the callback
- ⚠️ After the skin is fetched, switch back to the main thread before applying it to the NPC entity
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| Skin not shown | texture signature is null (offline-mode server) | The signature can be omitted in offline mode, but some clients reject it |
| `fetchByName` returns null | The player has never joined this server | Pass the texture Base64 string directly instead |
| NPC shows default Steve skin | Profile UUID not set correctly | Make sure the UUID is not all zeros; `UUID.randomUUID()` is recommended |
| Skull skin does not update | Set via Bukkit ItemMeta (overwritten by NMS) | Use the NMS approach in `SkullBuilder.withProfile()` |
