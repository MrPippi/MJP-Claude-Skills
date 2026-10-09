---
id: paper-chest-gui
title: Paper Chest GUI
titleZh: 箱子介面 GUI
description: Build chest-inventory GUIs with the Bukkit API - holder marker interface, one cancelling listener, per-click revalidation, paging, gui.yml icons and safe shutdown.
descriptionZh: 以 Bukkit API 建立箱子介面：InventoryHolder 標記介面、單一 GuiListener 防刷、每次點擊重新驗證、分頁與去彈跳、gui.yml 圖示、onDisable 關閉所有選單。
version: "1.0.0"
status: active
category: paper-ui
categoryLabel: Paper 介面
categoryLabelEn: Paper UI
tags: [paper-api, inventory, gui, holder, paging, minimessage]
triggerKeywords:
  - "箱子 GUI"
  - "chest GUI"
  - "InventoryHolder"
  - "createInventory"
  - "分頁"
  - "gui.yml"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-chest-gui/SKILL.md
featured: false
---

# Paper Chest GUI

## 目的

用純 Bukkit／Paper API 做箱子式選單，並且不被玩家刷物品。每種選單一個 `InventoryHolder`，共用一個標記介面，整個插件只有一個 `GuiListener`。表單與是／否確認優先用 `paper-dialog-ui`；需要 NMS `AbstractContainerMenu` 時改用 `nms-custom-menu`。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### ShopMenu.java（標記介面）

```java
public interface ShopMenu extends InventoryHolder {
    void onClick(MenuClick click);
    default void onClose(Player player) {}
}
```

### GuiListener.java（防刷核心）

```java
@EventHandler(priority = EventPriority.HIGH)
public void onClick(InventoryClickEvent event) {
    if (!(event.getInventory().getHolder() instanceof ShopMenu menu)) return;
    Inventory clicked = event.getClickedInventory();
    if (clicked != event.getInventory()) {
        // 下方背包：Shift／雙擊／數字鍵／副手交換會牽動上方選單，一律取消
        if (clicked == null || GUARDED_ACTIONS.contains(event.getAction())
                || GUARDED_CLICKS.contains(event.getClick())) event.setCancelled(true);
        return;
    }
    event.setCancelled(true);
    // 去彈跳 → menu.onClick(new MenuClick(player, event.getRawSlot(), event.getClick()))
}
```

### Menus.java（非同步回來後更新）

```java
public void updateIfStillOpen(UUID playerId, ShopMenu menu, Consumer<Player> update) {
    runOnMain(playerId, player -> {
        if (isOpen(player, menu)) update.accept(player);   // 主執行緒 + 仍開著
    });
}
```

### onDisable

```java
@Override
public void onDisable() {
    if (menus != null) menus.closeAll();   // 避免幽靈物品
}
```

---

## 規則

- 上方選單點擊、拖曳一律取消；下方背包的 Shift／雙擊／數字鍵／副手交換也要取消
- 每次點擊重新驗證權限、餘額、商品是否仍在；扣款成功但下架失敗要退款
- 圖示與標題放 `gui.yml`（Material + MiniMessage），統一關閉斜體
- 在點擊事件內開新選單或關閉視窗用 `openNextTick`／`closeNextTick`
- 背包滿時用 `giveOrDrop` 掉在腳邊，不讓物品消失
- 每個插件有自己的標記介面，`closeAll` 才不會關到別人的選單

---

## 執行緒安全

- 事件、建立 Inventory、`openInventory` 都在主執行緒；JDBC／HTTP 在非同步
- 非同步 lambda 只帶 UUID 與不可變資料；回主執行緒後確認插件啟用、玩家在線、選單仍開著
- 非同步載入用 `LatestOnly` 取號，過期結果丟棄（最後一次點擊為準）
- `onClose` 內要排程任務時先檢查 `plugin.isEnabled()`，因為 `onDisable` 的 `closeAll()` 會同步觸發它
