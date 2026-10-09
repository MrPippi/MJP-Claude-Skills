---
id: nms-custom-menu
title: NMS Custom Menu
titleZh: NMS 自定義容器 GUI
description: Build custom container GUIs by extending AbstractContainerMenu with slot event handling on Paper 26.x with official Mojang names.
descriptionZh: 繼承 AbstractContainerMenu 建立自定義容器 GUI，支援 slot 事件攔截與資料同步（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-ui
categoryLabel: NMS UI
categoryLabelEn: NMS UI
tags: [nms, inventory, gui, container, menu, abstractcontainermenu, mojang-mapped]
triggerKeywords:
  - "自定義 GUI"
  - "custom menu"
  - "AbstractContainerMenu"
  - "自定義容器"
  - "custom inventory"
  - "NMS GUI"
  - "container menu"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-custom-menu/SKILL.md
featured: true
---

# NMS Custom Menu

## 目的

透過繼承 NMS `AbstractContainerMenu` 實作自定義容器 GUI，支援 slot 操作攔截、資料同步，比純 Bukkit API 更靈活。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### CustomMenu.java

```java
public class CustomMenu extends AbstractContainerMenu {
    // 注册 GUI slot（容器區 + 玩家物品欄）
    // stillValid() — 控制是否允許保持開啟
    // quickMoveStack() — 攔截 shift-click
    // getBukkitView() — 提供 Bukkit InventoryView
}
```

### CustomMenuProvider.java + 開啟方式

```java
// 開啟 GUI
ServerPlayer nms = ((CraftPlayer) player).getHandle();
nms.openMenu(new CustomMenuProvider("§6商店"));
```

---

## 執行緒安全

- `nms.openMenu()` 及所有 GUI 操作**必須在主執行緒呼叫**
- Bukkit 事件回呼（InventoryClickEvent）已在主執行緒觸發
