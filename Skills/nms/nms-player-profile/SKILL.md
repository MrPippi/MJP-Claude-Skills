---
name: nms-player-profile
description: "操作 GameProfile 進行 skin 注入，用於 NPC 外觀設定與假玩家實體（Paper NMS + Mojang-mapped）/ Manipulate GameProfile for skin injection used in NPC appearance and fake player entities"
---

# NMS Player Profile / NMS 玩家 Profile 操作

## 技能名稱 / Skill Name

`nms-player-profile`

## 目的 / Purpose

透過 NMS `GameProfile` 操作玩家皮膚（texture）屬性，實現 NPC 外觀注入、假玩家實體皮膚設定，以及客製化頭顱 skull 顯示。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）

## 觸發條件 / Triggers

- 「GameProfile」「skin injection」「NPC 皮膚」「player profile」「skin NPC」
- 「fake player」「假玩家」「NPC skin」「texture property」「玩家頭顱 skin」
- 「profile skin」「gameprofile nms」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.npc` | 產出類別所在 package |
| `class_name` | `ProfileBuilder` | Profile 建立器類名 |
| `fetch_async` | `true` | 是否非同步從 Mojang API 抓取 skin |

## 輸出產物 / Outputs

- `ProfileBuilder.java` — GameProfile 建立與 skin 注入工具
- `SkinFetcher.java` — 非同步從 Mojang API 抓取 skin texture
- `SkullBuilder.java`（選）— 設定頭顱 ItemStack skin

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## 代碼範本 / Code Template

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
     * 從現有玩家複製 GameProfile（含 skin texture）。
     * 用於將真實玩家外觀複製到 NPC。
     */
    public static GameProfile copyFrom(Player player) {
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        return nms.getGameProfile();
    }

    /**
     * 建立帶有自定義 skin 的 GameProfile。
     *
     * @param name      顯示名稱（建議 ≤16 字元）
     * @param textureValue   Base64 編碼的 texture JSON
     * @param textureSignature Mojang 簽名（可為 null，但 online 模式需要）
     */
    public static GameProfile withSkin(String name, String textureValue, String textureSignature) {
        // authlib 7+：GameProfile 是 record、PropertyMap 不可變，properties 需在建構時傳入
        PropertyMap properties = new PropertyMap(ImmutableMultimap.of(
            "textures", new Property("textures", textureValue, textureSignature)));
        return new GameProfile(UUID.randomUUID(), name, properties);
    }

    /**
     * 建立無 skin 的空白 GameProfile（外觀為預設 Steve）。
     */
    public static GameProfile blank(String name) {
        return new GameProfile(UUID.randomUUID(), name);
    }

    /**
     * 從伺服器 user cache（usercache.json）查詢已知玩家的 UUID + 名稱，不發出網路請求。
     * 只對曾加入過此伺服器的玩家有效；回傳的 Profile 不含 skin，需要 skin 時用 SkinFetcher。
     */
    public static GameProfile fromCache(String playerName) {
        var minecraftServer = ((CraftServer) Bukkit.getServer()).getServer();
        NameAndId cached = minecraftServer.services().nameToIdCache().getIfCached(playerName);
        return cached != null ? cached.toUncompletedGameProfile() : null;
    }
}
```

### `SkinFetcher.java`（非同步從 Mojang API 抓取）

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
     * 非同步透過 Mojang session server 抓取完整 GameProfile（含 skin）。
     * 回傳 CompletableFuture，結果在非同步執行緒產生，
     * 使用前請切換回主執行緒。
     */
    public static CompletableFuture<GameProfile> fetchByName(Plugin plugin, String playerName) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                var minecraftServer = ((CraftServer) Bukkit.getServer()).getServer();
                // ProfileResolver：名稱 → UUID（user cache / Mojang API）→ session server 取得含 texture 的 Profile
                // 會發出阻塞的網路請求，因此只能在非同步執行緒呼叫
                return minecraftServer.services().profileResolver()
                    .fetchByName(playerName)
                    .orElse(null);
            } catch (Exception e) {
                plugin.getLogger().warning("Failed to fetch skin for " + playerName + ": " + e.getMessage());
                return null;
            }
        });
    }

    /** 取得 GameProfile 的 texture value（Base64 JSON）。 */
    public static String getTextureValue(GameProfile profile) {
        var textures = profile.properties().get("textures");
        if (textures.isEmpty()) return null;
        return textures.iterator().next().value();
    }

    /** 取得 GameProfile 的 texture signature。 */
    public static String getTextureSignature(GameProfile profile) {
        var textures = profile.properties().get("textures");
        if (textures.isEmpty()) return null;
        return textures.iterator().next().signature();
    }
}
```

### `SkullBuilder.java`（頭顱 ItemStack skin 設定）

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
     * 建立帶有指定 GameProfile skin 的玩家頭顱 ItemStack。
     * 1.20.5+ 以 {@code minecraft:profile} 組件取代舊的 SkullOwner NBT。
     */
    public static org.bukkit.inventory.ItemStack withProfile(GameProfile profile) {
        ItemStack nms = new ItemStack(Items.PLAYER_HEAD);
        nms.set(DataComponents.PROFILE, ResolvableProfile.createResolved(profile));
        return CraftItemStack.asBukkitCopy(nms);
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── npc/
    ├── ProfileBuilder.java
    ├── SkinFetcher.java
    └── SkullBuilder.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `ProfileBuilder` 方法為純資料操作，可在任意執行緒呼叫
- ✅ `SkinFetcher.fetchByName()` 在 async 執行緒抓取，**不可**在回呼中直接操作 Bukkit/NMS 世界
- ⚠️ 抓取完 skin 後需切回主執行緒再套用到 NPC 實體
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| skin 不顯示 | texture signature 為 null（offline 模式伺服器） | offline mode 下 signature 可省略，但部分客戶端會拒絕 |
| `fetchByName` 回傳 null | 玩家從未加入此伺服器 | 改用直接傳入 texture Base64 字串 |
| NPC 皮膚顯示預設 Steve | Profile UUID 未正確設定 | 確保 UUID 非全零，建議使用 `UUID.randomUUID()` |
| 頭顱 skin 不更新 | 使用 Bukkit ItemMeta 設定（會被 NMS 覆蓋） | 改用 `SkullBuilder.withProfile()` 的 NMS 方式 |
