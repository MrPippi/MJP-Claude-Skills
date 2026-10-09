---
id: paper-safe-teleport
title: Paper Safe Teleport
titleZh: 安全傳送與隨機傳送
description: Safe random teleport and safe-location teleports on Paper with async chunk loading, bounded attempts, re-validation after teleportAsync, warmup, cooldowns and an optional pre-searched spot pool.
descriptionZh: 安全隨機傳送（RTP）與安全落點傳送：getChunkAtAsync 後在主執行緒判定、有上限的找點、teleportAsync 後重新驗證、暖機與冷卻、可選的預找落點池。
version: "1.0.0"
status: active
category: paper-gameplay
categoryLabel: Paper 玩法
categoryLabelEn: Paper Gameplay
tags: [paper-api, teleport, rtp, safe-location, warmup, cooldown, teleport-async]
triggerKeywords:
  - "隨機傳送"
  - "RTP"
  - "safe teleport"
  - "安全落點"
  - "teleportAsync"
  - "getChunkAtAsync"
  - "傳送暖機"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-safe-teleport/SKILL.md
featured: false
---

# Paper Safe Teleport

## 目的

實作不會把玩家傳進岩漿、虛空或牆裡的傳送：隨機傳送、傳到家前的落點檢查、暖機與冷卻。先 `getChunkAtAsync`，future 完成後在主執行緒判定；`teleportAsync` 完成後回主執行緒收尾，每個非同步階段回來都重新驗證。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### SafeLocationRules.java（無狀態判定）

```java
import java.util.Set;
import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.World;
import org.bukkit.block.Block;

public static boolean safeColumn(World world, Set<Material> hazards, int x, int y, int z) {
    Block floor = world.getBlockAt(x, y, z);
    Material floorType = floor.getType();
    if (!floorType.isSolid() || floor.isLiquid() || hazards.contains(floorType) || Tag.LEAVES.isTagged(floorType)) {
        return false;
    }
    for (int i = 1; i <= 3; i++) {   // 腳、頭、頭頂淨空
        Block above = world.getBlockAt(x, y + i, z);
        if (!above.isPassable() || above.isLiquid() || hazards.contains(above.getType())) {
            return false;
        }
    }
    return true;
}
```

### SafeSpotFinder.java（有上限的非同步找點）

```java
// world.getChunkAtAsync 的 future 在主執行緒完成，才能安全讀方塊
return world.getChunkAtAsync(x >> 4, z >> 4)
    .handle((chunk, err) -> err != null || chunk == null
        ? Optional.<Location>empty()
        : SafeLocationRules.evaluate(world, x, z))
    .thenCompose(found -> found.isPresent()
        ? CompletableFuture.completedFuture(found)
        : attempt(world, minR, maxR, max, n + 1));
```

### SafeTeleportService.java（傳送與收尾）

```java
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.player.PlayerTeleportEvent.TeleportCause;
import org.bukkit.plugin.Plugin;

public static void teleport(Plugin plugin, Player player, Location verified) {
    player.teleportAsync(verified, TeleportCause.PLUGIN)
        .whenComplete((ok, err) -> plugin.getServer().getScheduler().runTask(plugin, () -> {
            // 回主執行緒後重新取得玩家；成功才記冷卻
        }));
}
```

---

## 規則

- 腳下實心且非危險；腳、頭、頭頂各一格都可通行且非液體、非危險方塊
- 地上世界用 `HeightMap.MOTION_BLOCKING_NO_LEAVES`；下界（`hasCeiling()`）從 `logicalHeight - 8` 往下找地板
- 落點必須 `WorldBorder#isInside`；找點有次數上限，失敗回覆玩家訊息
- 冷卻以 UUID 為 key、存時間戳，傳送成功才記錄
- 戰鬥中禁止傳送：以 `TeleportGuard` 接入 `paper-combat-tag`，暖機開始前、搜尋完成後、傳送前各檢查一次

---

## 執行緒安全

- 非同步階段之間只攜帶 UUID，回來後重新取得 `Player` / `World` 並重新驗證（在線、閘門、世界未變）
- 讀方塊、`WorldBorder`、chunk ticket 一律在主執行緒
- 落點池一次性取用：先移出池再重驗，同 tick 不會發給兩人
