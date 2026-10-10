
# Paper Chest GUI

## Purpose

Build chest-style menus with the pure Bukkit / Paper API without letting players dupe items. Each menu type gets one `InventoryHolder`, all sharing a marker interface, and the whole plugin has a single `GuiListener`. Prefer `paper-dialog-ui` for forms and yes/no confirmations; use `nms-custom-menu` when you need an NMS `AbstractContainerMenu`.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (compile-verified on both)
- Pure Paper API, no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### ShopMenu.java (marker interface)

```java
public interface ShopMenu extends InventoryHolder {
    void onClick(MenuClick click);
    default void onClose(Player player) {}
}
```

### GuiListener.java (anti-dupe core)

```java
@EventHandler(priority = EventPriority.HIGH)
public void onClick(InventoryClickEvent event) {
    if (!(event.getInventory().getHolder() instanceof ShopMenu menu)) return;
    Inventory clicked = event.getClickedInventory();
    if (clicked != event.getInventory()) {
        // Bottom inventory: shift / double click / number keys / offhand swap affect the top menu, so always cancel
        if (clicked == null || GUARDED_ACTIONS.contains(event.getAction())
                || GUARDED_CLICKS.contains(event.getClick())) event.setCancelled(true);
        return;
    }
    event.setCancelled(true);
    // debounce -> menu.onClick(new MenuClick(player, event.getRawSlot(), event.getClick()))
}
```

### Menus.java (update after returning from async)

```java
public void updateIfStillOpen(UUID playerId, ShopMenu menu, Consumer<Player> update) {
    runOnMain(playerId, player -> {
        if (isOpen(player, menu)) update.accept(player);   // main thread + still open
    });
}
```

### onDisable

```java
@Override
public void onDisable() {
    if (menus != null) menus.closeAll();   // avoid ghost items
}
```

---

## Rules

- Always cancel clicks and drags on the top menu; also cancel shift / double click / number keys / offhand swap in the bottom inventory
- Revalidate permission, balance and whether the listing still exists on every click; if payment succeeds but delisting fails, refund
- Put icons and titles in `gui.yml` (Material + MiniMessage) and disable italics uniformly
- To open a new menu or close the window inside a click event, use `openNextTick` / `closeNextTick`
- When the inventory is full, use `giveOrDrop` to drop items at the player's feet so they never vanish
- Each plugin has its own marker interface so `closeAll` never closes someone else's menus

---

## Thread Safety

- Events, creating an Inventory and `openInventory` all run on the main thread; JDBC / HTTP run async
- Async lambdas carry only the UUID and immutable data; after returning to the main thread, confirm the plugin is enabled, the player is online and the menu is still open
- Async loading takes a ticket from `LatestOnly` and discards stale results (the last click wins)
- Before scheduling a task inside `onClose`, check `plugin.isEnabled()`, because `closeAll()` in `onDisable` triggers it synchronously
