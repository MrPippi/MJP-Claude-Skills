---
name: nms-custom-menu
description: "繼承 AbstractContainerMenu 建立自定義容器 GUI，支援 slot 事件攔截與資料同步（Paper NMS + Mojang-mapped）/ Build custom container GUIs by extending AbstractContainerMenu with slot event handling"
---

# NMS Custom Menu

## Skill Name

`nms-custom-menu`

## Purpose

Implement custom container GUIs by extending NMS `AbstractContainerMenu`. Supports slot interaction interception, data synchronization (`ContainerData`), and integration with Bukkit `InventoryView`, and is more flexible than the plain Bukkit API.

### Alternatives

- Forms, confirmation windows, settings pages -> Paper Dialog API, see [`paper-dialog-ui`](../../paper/paper-dialog-ui/SKILL.md)
- Regular chest GUIs (shops, lists, pagination) -> Bukkit `InventoryHolder`, see [`paper-chest-gui`](../../paper/paper-chest-gui/SKILL.md)
- Use this skill only when you need a custom `MenuType`, custom slot behavior, or server-side container logic

## NMS Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (Minecraft is no longer obfuscated since 26.1)

## Triggers

- "自定義 GUI", "custom menu", "AbstractContainerMenu", "自定義容器", "custom inventory"
- "NMS GUI", "container menu", "slot intercept", "inventory nms", "自定義箱子 GUI"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package_name` | `com.example.gui` | Package of the generated classes |
| `menu_class_name` | `ShopMenu` | Menu class name |
| `menu_type` | `GENERIC_9x3` | MenuType (e.g. GENERIC_9x3, ANVIL) |
| `rows` | `3` | Row count (used with GENERIC_9xN) |

## Outputs

- `CustomMenu.java` — AbstractContainerMenu implementation
- `CustomMenuProvider.java` — MenuProvider (used by ServerPlayer.openMenu)
- `CustomMenuListener.java` — Bukkit event bridge (InventoryClickEvent, etc.)

## Build Setup

See [`references/paper-nms-platform.md`](references/paper-nms-platform.md). Key dependency:

```groovy
dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
}
```

## Code Template

### `CustomMenu.java`

```java
package com.example.gui;

import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.SimpleContainer;
import org.bukkit.craftbukkit.inventory.CraftInventory;
import org.bukkit.craftbukkit.inventory.CraftInventoryView;
import org.bukkit.inventory.InventoryView;

@SuppressWarnings("UnstableApiUsage")
public class CustomMenu extends AbstractContainerMenu {

    private static final int ROWS = 3;
    private static final int SIZE = ROWS * 9;

    private final CustomMenuHolder holder;
    private final SimpleContainer menuInventory;
    private final Inventory playerInventory;
    private CraftInventoryView<CustomMenu, org.bukkit.inventory.Inventory> bukkitView;

    public CustomMenu(int syncId, Inventory playerInventory) {
        this(syncId, playerInventory, new CustomMenuHolder());
    }

    public CustomMenu(int syncId, Inventory playerInventory, CustomMenuHolder holder) {
        super(MenuType.GENERIC_9x3, syncId);
        this.playerInventory = playerInventory;
        this.holder = holder;
        // Use the holder as the Container owner so Bukkit's getTopInventory().getHolder() is the CustomMenuHolder
        this.menuInventory = new SimpleContainer(SIZE, holder);
        holder.setInventory(new CraftInventory(menuInventory));

        // Register GUI slots (top container area)
        for (int row = 0; row < ROWS; row++) {
            for (int col = 0; col < 9; col++) {
                int index = col + row * 9;
                addSlot(new Slot(menuInventory, index, 8 + col * 18, 18 + row * 18));
            }
        }

        // Register player inventory slots (bottom area)
        for (int row = 0; row < 3; row++) {
            for (int col = 0; col < 9; col++) {
                addSlot(new Slot(playerInventory, col + row * 9 + 9,
                    8 + col * 18, 103 + row * 18));
            }
        }
        // Hotbar
        for (int col = 0; col < 9; col++) {
            addSlot(new Slot(playerInventory, col, 8 + col * 18, 161));
        }
    }

    /** Controls whether the menu stays valid for the player (returning false closes it). */
    @Override
    public boolean stillValid(Player player) {
        return true;
    }

    /** Intercepts shift-click logic. */
    @Override
    public ItemStack quickMoveStack(Player player, int slotIndex) {
        return ItemStack.EMPTY; // Disallow shift-click
    }

    /** Gets the Bukkit InventoryView (used by Bukkit events). */
    @Override
    public InventoryView getBukkitView() {
        if (bukkitView == null) {
            bukkitView = new CraftInventoryView<>(
                playerInventory.player.getBukkitEntity(), holder.getInventory(), this);
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

### `CustomMenuHolder.java`

```java
package com.example.gui;

import org.bukkit.entity.HumanEntity;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;

/** Bukkit InventoryHolder for the custom GUI; the listener identifies it with instanceof and dispatches clicks. Override the callbacks to implement behavior. */
public class CustomMenuHolder implements InventoryHolder {

    private Inventory inventory;

    void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    /** Called when a top GUI slot (0-26) is clicked. */
    public void handleSlotClick(int slot, HumanEntity who) {
    }

    /** Called when the GUI is closed. */
    public void onClose(HumanEntity who) {
    }
}
```

### `CustomMenuListener.java` (Bukkit event bridge)

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

        event.setCancelled(true); // Cancel all clicks by default
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

### Opening the GUI

```java
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

@SuppressWarnings("UnstableApiUsage")
public static void openMenu(Player player, String title) {
    ServerPlayer nms = ((CraftPlayer) player).getHandle();
    nms.openMenu(new CustomMenuProvider(title));
}
```

## Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── gui/
    ├── CustomMenu.java
    ├── CustomMenuProvider.java
    ├── CustomMenuHolder.java
    └── CustomMenuListener.java
```

## Thread Safety

- ⚠️ `nms.openMenu()` and all GUI operations **must be called on the main thread**
- ✅ Bukkit event callbacks (InventoryClickEvent) already fire on the main thread, so NMS can be used safely
- See [`references/nms-threading.md`](references/nms-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| GUI closes immediately after opening | `stillValid()` returns false | Verify the player distance or conditions are correct |
| Slot index out of range | Container size mismatch | Make sure the number of registered slots matches the MenuType |
| `getBukkitView()` NPE | playerInventory.player is not initialized | Make sure the menu is opened after PlayerJoinEvent |
| Shift-click passes through the GUI | `quickMoveStack` is not implemented correctly | Return `ItemStack.EMPTY` to block the action |
