---
id: paper-client-side-effects
title: Paper Client-Side Effects
titleZh: 玩家端視覺效果
description: Per-player illusions with the Paper API only — virtual world border vignette, personal time and weather, hidePlayer visibility and night vision — kept correct by a central EffectState and reconcile() after join, world change, respawn, border change and effect removal.
descriptionZh: 只用 Paper API 做每位玩家各自看到的效果：虛擬世界邊界紅框、個人時間／天氣、hidePlayer 可見性與夜視，由中央 EffectState 在加入、換世界、重生、邊界變動與效果被移除後 reconcile。
version: "1.0.0"
status: active
category: paper-network
categoryLabel: Paper 網路
categoryLabelEn: Paper Network
tags: [paper-api, virtual-worldborder, player-time, player-weather, hide-player, potion-effect, reconcile]
triggerKeywords:
  - "虛擬世界邊界"
  - "virtual world border"
  - "低血量紅框"
  - "setPlayerTime"
  - "setPlayerWeather"
  - "hidePlayer"
  - "EntityPotionEffectEvent"
  - "restore effect"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-client-side-effects/SKILL.md
featured: false
---

# Paper Client-Side Effects

## 目的

需要「只有某位玩家看得到」的效果時，**先用 Paper API，再考慮封包或 NMS**。這類效果最常見的 bug 是套用後被悄悄拿掉或換掉（真邊界變了、換世界、死亡、喝牛奶、`/effect clear`），所以把想要的狀態集中在 `EffectState`，每個觸發事件之後呼叫 `reconcile()` 重新套用。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight、不需要 ProtocolLib／PacketEvents
- 偏好來源透過 `paper-service-api` 取得

---

## 產生的代碼

### 虛擬邊界紅框（LowHealthBorderEffect）

```java
WorldBorder virtual = server.createWorldBorder();
virtual.setCenter(target.centerX(), target.centerZ());
virtual.setSize(target.size());
virtual.setWarningDistance(target.warningDistance());   // 距離 / (1 - 強度)
player.setWorldBorder(virtual);
// 還原
player.setWorldBorder(null);
```

### 個人時間與天氣（PersonalTimeWeatherEffect）

```java
player.setPlayerTime(6000L, false);          // 固定在正午；true = 相對伺服器時間
player.setPlayerWeather(WeatherType.CLEAR);
player.resetPlayerTime();
player.resetPlayerWeather();
```

### 外掛範圍的隱藏（PlayerVisibilityService）

```java
viewer.hidePlayer(plugin, target);
viewer.showPlayer(plugin, target);   // 登出前先放出來
```

### 中央 reconcile（EffectState）

```java
public void reconcile(Player player) {
    EffectPrefs prefs = desired.getOrDefault(player.getUniqueId(), EffectPrefs.NONE);
    border.apply(player, prefs.lowHealthBorder());
    timeWeather.apply(player, prefs);
    if (prefs.nightVision()) nightVision.apply(player);
}
```

---

## 規則

- 觸發事件（加入、換世界、重生、`WorldBorder*Event`、`EntityPotionEffectEvent`）一律 `runTask` 排到下一 tick 再 `reconcile()`
- 紅框：換世界先 `setWorldBorder(null)` 再重算；真邊界變動時重抄；停用時還原；血量變化用定時掃描
- 夜視判斷用 `PotionEffect#isInfinite()`，不是「有沒有夜視」
- `hidePlayer` 加入時兩個方向都重算、登出前先 `showPlayer`；它會連 TAB 名單一起移除

---

## 執行緒安全

- 全部只在主執行緒；偏好來源只讀記憶體快取
- 事件延後的回呼重新用 UUID 取 `Player`
