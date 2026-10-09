---
id: paper-combat-tag
title: Paper Combat Tag
titleZh: PvP 戰鬥標記
description: PvP combat tagging with a Bukkit-free core service (UUID + timestamps, JUnit-testable), a damage attribution matrix, command whitelist, teleport block, combat-logout punishment and a CombatTagApi published via ServicesManager.
descriptionZh: PvP 戰鬥標記：純邏輯核心服務（UUID + 時間戳、可 JUnit）、傷害歸因矩陣、指令白名單、傳送封鎖、戰鬥登出處罰，並以 ServicesManager 公開 CombatTagApi。
version: "1.0.0"
status: active
category: paper-gameplay
categoryLabel: Paper 玩法
categoryLabelEn: Paper Gameplay
tags: [paper-api, pvp, combat-tag, damage-attribution, services-manager]
triggerKeywords:
  - "戰鬥標記"
  - "combat tag"
  - "combat log"
  - "戰鬥中登出"
  - "damage attribution"
  - "CombatTagApi"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-combat-tag/SKILL.md
featured: false
---

# Paper Combat Tag

## 目的

玩家互毆後進入戰鬥狀態：狀態中禁止指令、插件傳送與登出（登出視同死亡）。核心 `CombatTagService` 只用 `UUID` 與毫秒時間戳，不含 Bukkit 型別，可直接用 JUnit 測；Listener 只負責把 Bukkit 事件翻成核心輸入。其他插件透過 `ServicesManager` 取得 `CombatTagApi`。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 傷害歸因矩陣

| 來源 | 判斷 |
|------|------|
| 近戰 | `DamageSource#getCausingEntity()` 是 `Player` |
| 射擊物 | `Projectile#getShooter()` |
| 噴濺／滯留藥水、藥水雲 | `PotionSplashEvent`／`AreaEffectCloudApplyEvent` + 有害效果 |
| TNT | `TNTPrimed#getSource()` |
| 終界水晶、重生錨、床 | 點擊／打水晶時記帳，爆炸時在 1–2 tick 視窗內回查 |
| 馴服的狼 | `Tameable#getOwnerUniqueId()`（主人在線） |
| 火、摔落（受擊後） | 不重置標記 |
| 自傷、被取消的事件 | 忽略（`MONITOR` + `ignoreCancelled`） |

---

## 產生的代碼

### CombatTagService.java（核心，無 Bukkit）

```text
public Set<UUID> hit(UUID victim, UUID attacker, long now, boolean victimBypass, boolean attackerBypass);
public boolean isTagged(UUID player, long now);
public long remainingSeconds(UUID player, long now);
public Set<UUID> expire(long now);
public void markKicked(UUID player, boolean exemptFromPunishment);
public LogoutVerdict onQuit(UUID player, long now);   // NONE | PUNISH
```

### CommandListener.java（白名單，含別名與命名空間）

```java
String raw = CommandPolicy.rawToken(event.getMessage());
Command command = plugin.getServer().getCommandMap().getCommand(raw);
String name = command != null
    ? command.getName().toLowerCase(Locale.ROOT)
    : CommandPolicy.stripNamespace(raw);
if (!CommandPolicy.allowed(name, config.commandWhitelist())) {
    event.setCancelled(true);
}
```

### CombatTagPlugin.java（註冊 API）

```java
getServer().getServicesManager().register(
    CombatTagApi.class, new CombatTagApiImpl(service, clock), this, ServicePriority.Normal);
```

---

## 規則

- 核心與 API 只用 JDK 型別；API 只加不改、不可 relocate
- 傷害與死亡 Listener 用 `MONITOR` + `ignoreCancelled = true`
- 被踢是否免死看 `PlayerKickEvent.Cause` 白名單，不看 `PlayerQuitEvent#getReason()`
- 指令白名單先經 `CommandMap` 解析成正式指令名再比對
- 傳送只擋 `COMMAND`／`PLUGIN`；珍珠、歌萊果、傳送門放行
- 全伺服器只有一個每秒 timer，外層邊界 catch 且只記錄一次

---

## 執行緒安全

- 核心與 Listener 只在主執行緒使用，不加鎖
- 非同步階段只傳 UUID／數值，回主執行緒後再重新驗證玩家在線
