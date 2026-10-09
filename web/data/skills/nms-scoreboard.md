---
id: nms-scoreboard
title: NMS Scoreboard
titleZh: NMS 計分板操作
description: Operate sidebar, tablist, and scoreboard via NMS Scoreboard/Objective/Team API on Paper 1.21.x with Mojang mappings.
descriptionZh: 透過 NMS Scoreboard/Objective/Team API 操作 sidebar、tablist 顯示名稱與計分板（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-display
categoryLabel: NMS 顯示
categoryLabelEn: NMS Display
tags: [nms, scoreboard, objective, team, sidebar, tablist, mojang-mapped]
triggerKeywords:
  - "scoreboard"
  - "sidebar"
  - "tablist"
  - "Objective NMS"
  - "計分板"
  - "nms scoreboard"
  - "prefix suffix"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-scoreboard/SKILL.md
featured: true
---

# NMS Scoreboard

## 目的

透過 NMS `Scoreboard`、`Objective`、`Team` 直接操作 sidebar 計分板、tablist 顯示名稱、玩家 prefix/suffix，繞過 Bukkit Scoreboard API 的封包延遲。

---

## 平台需求

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

### SidebarDisplay.java

```java
new SidebarDisplay("§6§lMyServer")
    .addLine("§f玩家: §e" + player.getName(), 14)
    .addLine("§f等級: §a1", 13)
    .show(player);
```

### TeamManager.java（prefix/suffix）

```java
teamManager.setTeam("vip", "§6[VIP] ", "");
teamManager.addPlayer(player, "vip");
```

---

## 執行緒安全

- 所有 Scoreboard/Team 操作**必須在主執行緒呼叫**
