---
name: nms-custom-menu
description: "繼承 AbstractContainerMenu 建立自定義容器 GUI，支援 slot 事件攔截與資料同步（Paper NMS + Mojang-mapped）/ Build custom container GUIs by extending AbstractContainerMenu with slot event handling"
---

# NMS Custom Menu / NMS 自定義容器 GUI

## 技能名稱 / Skill Name

`nms-custom-menu`

## 目的 / Purpose

透過繼承 NMS `AbstractContainerMenu` 實作自定義容器 GUI，支援 slot 操作攔截、資料同步（`ContainerData`）、與 Bukkit `InventoryView` 整合，比純 Bukkit API 更靈活。

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21 – 1.21.3
- Paperweight userdev 1.7.2+
- Mojang mappings（已由 Paper 1.20.5+ 原生支援）

## 觸發條件 / Triggers

- 「自定義 GUI」「custom menu」「AbstractContainerMenu」「自定義容器」「custom inventory」
- 「NMS GUI」「container menu」「slot intercept」「inventory nms」「自定義箱子 GUI」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.gui` | 產出類別所在 package |
| `menu_class_name` | `ShopMenu` | Menu 類名稱 |
| `menu_type` | `GENERIC_9x3` | MenuType（如 GENERIC_9x3、ANVIL） |
| `rows` | `3` | 列數（GENERIC_9xN 時使用） |

## 輸出產物 / Outputs

- `CustomMenu.java` — AbstractContainerMenu 實作
- `CustomMenuProvider.java` — MenuProvider（供 ServerPlayer.openMenu 使用）
- `CustomMenuListener.java` — Bukkit 事件橋接（InventoryClickEvent 等）

## Paperweight 建置設定 / Build Setup

參見 `Skills/paper-nms/PLATFORM.md`。關鍵依賴：

```groovy
dependencies {
    paperweight.paperDevBundle('1.21.1-R0.1-SNAPSHOT')
}
```

## 代碼範本 / Code Template

### `CustomMenu.java`

```java
package com.example.gui;

import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import org.bukkit.craftbukkit.v1_21_R1.inventory.CraftInventory;
import org.bukkit.craftbukkit.v1_21_R1.inventory.CraftInventoryCustom;
import org.bukkit.craftbukkit.v1_21_R1.inventory.CraftInventoryView;
import org.bukkit.inventory.InventoryView;

@SuppressWarnings("UnstableApiUsage")
public class CustomMenu extends AbstractContainerMenu {

    private static final int ROWS = 3;
    private static final int SIZE = ROWS * 9;

    private final net.minecraft.world.Container menuInventory;
    private final Inventory playerInventory;
    private CraftInventoryView bukkitView;

    public CustomMenu(int syncId, Inventory playerInventory) {
        super(MenuType.GENERIC_9x3, syncId);
        this.playerInventory = playerInventory;
        this.menuInventory = new net.minecraft.world.SimpleContainer(SIZE);

        // 注册 GUI slot（上方容器區）
        for (int row = 0; row < ROWS; row++) {
            for (int col = 0; col < 9; col++) {
                int index = col + row * 9;
                addSlot(new Slot(menuInventory, index, 8 + col * 18, 18 + row * 18));
            }
        }

        // 注册玩家物品欄 slot（下方區）
        for (int row = 0; row < 3; row++) {
            for (int col = 0; col < 9; col++) {
                addSlot(new Slot(playerInventory, col + row * 9 + 9,
                    8 + col * 18, 103 + row * 18));
            }
        }
        // 快捷欄
        for (int col = 0; col < 9; col++) {
            addSlot(new Slot(playerInventory, col, 8 + col * 18, 161));
        }
    }

    /** 控制哪些 slot 可以被取出（回傳 false = 禁止取出）。 */
    @Override
    public boolean stillValid(Player player) {
        return true;
    }

    /** 攔截 shift-click 邏輯。 */
    @Override
    public ItemStack quickMoveStack(Player player, int slotIndex) {
        return ItemStack.EMPTY; // 禁止 shift-click
    }

    /** 取得 Bukkit InventoryView（供 Bukkit 事件使用）。 */
    @Override
    public InventoryView getBukkitView() {
        if (bukkitView == null) {
            CraftInventory craftInventory = new CraftInventoryCustom(null, menuInventory);
            bukkitView = new CraftInventoryView(
                (org.bukkit.entity.HumanEntity) playerInventory.player.getBukkitEntity(),
                craftInventory, this);
        }
        return bukkitView;
    }
}
```

### `CustomMenuProvider.java`

```java
package com.example.gui;

import net.minecraft.network.chat.Component;
import net.minecraft.world.MenuProvider;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;

@SuppressWarnings("UnstableApiUsage")
public class CustomMenuProvider implements MenuProvider {

    private final String title;

    public CustomMenuProvider(String title) {
        this.title = title;
    }

    @Override
    public Component getDisplayName() {
        return Component.literal(title);
    }

    @Override
    public AbstractContainerMenu createMenu(int syncId, Inventory inventory, Player player) {
        return new CustomMenu(syncId, inventory);
    }
}
```

### `CustomMenuListener.java`（Bukkit 事件橋接）

```java
package com.example.gui;

import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.inventory.InventoryView;

public class CustomMenuListener implements Listener {

    @EventHandler
    public void onInventoryClick(InventoryClickEvent event) {
        InventoryView view = event.getView();
        if (!(view.getTopInventory().getHolder() instanceof CustomMenuHolder holder)) return;

        event.setCancelled(true); // 預設取消所有點擊
        int slot = event.getRawSlot();
        if (slot >= 0 && slot < 27) {
            holder.handleSlotClick(slot, event.getWhoClicked());
        }
    }

    @EventHandler
    public void onInventoryClose(InventoryCloseEvent event) {
        InventoryView view = event.getView();
        if (view.getTopInventory().getHolder() instanceof CustomMenuHolder holder) {
            holder.onClose(event.getPlayer());
        }
    }
}
```

### 開啟 GUI 的呼叫方式

```java
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.v1_21_R1.entity.CraftPlayer;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public static void openMenu(Player player, String title) {
    ServerPlayer nms = ((CraftPlayer) player).getHandle();
    nms.openMenu(new CustomMenuProvider(title));
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── gui/
    ├── CustomMenu.java
    ├── CustomMenuProvider.java
    ├── CustomMenuHolder.java
    └── CustomMenuListener.java
```

## 執行緒安全注意事項 / Thread Safety

- ⚠️ `nms.openMenu()` 及所有 GUI 操作**必須在主執行緒呼叫**
- ✅ Bukkit 事件回呼（InventoryClickEvent）已在主執行緒觸發，可安全操作 NMS
- 詳見 `Skills/_shared/nms-threading.md`

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| GUI 打開後立即關閉 | `stillValid()` 回傳 false | 確認玩家距離或條件正確 |
| slot index 超出範圍 | container size 不匹配 | 確認 slot 注册數量與 MenuType 相符 |
| `getBukkitView()` NPE | playerInventory.player 未初始化 | 確認在 PlayerJoinEvent 後開啟 |
| shift-click 穿越 GUI | `quickMoveStack` 未正確實作 | 回傳 `ItemStack.EMPTY` 禁止操作 |
