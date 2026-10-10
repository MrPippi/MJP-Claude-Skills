---
name: paper-chest-gui
description: "以 Bukkit API 建立箱子介面 GUI：InventoryHolder 標記介面、單一 GuiListener 取消點擊／拖曳／Shift／數字鍵、每次點擊重新驗證、分頁與去彈跳、gui.yml 圖示、onDisable 關閉所有選單 / Chest-inventory GUIs with the Bukkit API: holder marker interface, one cancelling listener, per-click revalidation, paging, gui.yml icons, safe disable"
---

# Paper Chest GUI

## Skill Name

`paper-chest-gui`

## Purpose

Build chest-style menus (shop lists, confirmation pages, settings pages) with the plain Bukkit/Paper API, without touching NMS.
The point is not how to display them, but how to keep players from duplicating items:

- One `InventoryHolder` per menu kind, all sharing one **marker interface**, so the whole plugin needs only one `GuiListener` to decide "this is my menu"
- Always cancel clicks and drags on the top menu; also cancel Shift-clicks, number keys, double-clicks, and offhand swaps in the **bottom inventory**, otherwise items get moved into the menu or pulled out of it
- **Revalidate** state on every click (permission, balance, whether the listing still exists); never trust what is drawn on screen
- After async work completes, switch back to the main thread and confirm the menu is **still open** before updating it
- Close every open menu in `onDisable` to avoid "ghost items"; guard the `InventoryCloseEvent` handler with `plugin.isEnabled()`

> For form input and confirmation dialogs (yes/no), prefer [`paper-dialog-ui`](../paper-dialog-ui/SKILL.md); no chest slots needed.
> Use `nms-custom-menu` when you need an NMS `AbstractContainerMenu` (custom container logic, special slots).

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (same template for both; `InventoryView` became an interface in 26.2, and this skill only uses `event.getInventory()` and `player.getOpenInventory()`, so it compiles on both)
- Pure Paper API, no Paperweight needed

## Triggers

- "箱子 GUI", "chest GUI", "InventoryHolder", "選單", "menu", "createInventory"
- "分頁", "paging", "翻頁", "InventoryClickEvent", "物品被拿走", "刷物品", "dupe"
- "gui.yml", "圖示設定", "確認購買"

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package` | `com.example.shop.gui` | Package of the GUI classes |
| `menu_kinds` | `PagedListMenu`, `ConfirmPurchaseMenu` | Menu kinds to build (one holder per kind) |
| `rows` | `6` | Row count (6 rows = 54 slots; top 45 for content, bottom row for navigation buttons) |
| `icons_file` | `gui.yml` | Icon config file (Material + MiniMessage name/lore) |
| `permission` | `shop.buy` | Permission required for the action (rechecked on every click) |

## Outputs

- `ShopMenu.java` — marker interface (`InventoryHolder` + `onClick`/`onClose`)
- `MenuClick.java` — click data passed to the menu (immutable)
- `NavSlot.java` — fixed navigation slots
- `Icons.java` — loads icons and titles (MiniMessage) from `gui.yml`
- `PlayerItems.java` — drops items at the player's feet when the inventory is full
- `LatestOnly.java` — ticket numbers for "the last click wins"
- `PagedListMenu.java` — paged list holder
- `Menus.java` — open/close/return from async to main thread/`closeAll`
- `GuiListener.java` — the single click, drag, and close listener
- `ShopPlugin.java` — registers the listener and closes menus in `onDisable`
- `gui.yml` — icon and title config

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Only `paper-api` (`compileOnly`) is needed.

`src/main/resources/gui.yml` (default contents; `Icons.load` writes it to `plugins/<name>/gui.yml` on first run):

```yaml
titles:
  list: "<dark_gray>Shop <gray>(<page>/<pages>)"
  confirm: "<dark_gray>Confirm purchase"
icons:
  prev:
    material: ARROW
    name: "<white>Previous page"
  next:
    material: ARROW
    name: "<white>Next page"
  page:
    material: PAPER
    name: "<gray>Page <white><page><gray>/<white><pages>"
  entry:
    material: STONE
    name: "<white><name>"
    lore:
      - "<gray>Price: <gold><price>"
      - "<dark_gray>Click to buy"
  confirm:
    material: LIME_CONCRETE
    name: "<green>Confirm"
    lore:
      - "<gray>Pay <gold><price>"
  cancel:
    material: RED_CONCRETE
    name: "<red>Cancel"
```

- All player-visible text goes in `gui.yml` (English, MiniMessage); code contains no literals (the only exception is defensive messages such as "something went wrong", which in practice should also move to `lang.yml`)
- Selected/unselected markers in list options reuse the same prefixes (selected `" <white>▸ "`, unselected `"   <gray>"`) so different menus look consistent
- Leave empty slots empty instead of filling them with glass panes; when you really need a "dead slot", use `setHideTooltip(true)` to avoid an empty tooltip box

## Code Template

### `ShopMenu.java` (marker interface)

```java
package com.example.shop.gui;

import org.bukkit.entity.Player;
import org.bukkit.inventory.InventoryHolder;

/**
 * Marker for every chest menu of this plugin. {@link GuiListener} uses {@code instanceof ShopMenu} to decide "this is my menu",
 * and {@link Menus#closeAll()} uses it to find the menus to close.
 *
 * <p>Rules:
 * <ul>
 *   <li>Each plugin has its own marker interface; <b>do not</b> share another plugin's type (otherwise {@code closeAll} closes other plugins' menus)</li>
 *   <li>{@link #getInventory()} must always return the same Inventory (Bukkit convention)</li>
 *   <li>One holder lives for the whole screen: paging redraws within the same inventory instead of reopening</li>
 * </ul>
 */
public interface ShopMenu extends InventoryHolder {

    /** The player clicked a slot of the top menu. Main thread; {@link GuiListener} has already cancelled the event and debounced. */
    void onClick(MenuClick click);

    /**
     * Menu closed. Does nothing by default; menus that must return held items override it.
     * {@code closeAll()} also calls it synchronously when the plugin is disabled: do only synchronous cleanup; to schedule a task, check {@code plugin.isEnabled()} first.
     */
    default void onClose(Player player) {
    }
}
```

### `MenuClick.java`

```java
package com.example.shop.gui;

import org.bukkit.entity.Player;
import org.bukkit.event.inventory.ClickType;

/** An immutable snapshot of one click. {@code slot} is the slot in the top menu (0-based). */
public record MenuClick(Player player, int slot, ClickType type) {

    public boolean isRight() {
        return type == ClickType.RIGHT || type == ClickType.SHIFT_RIGHT;
    }

    public boolean isDrop() {
        return type == ClickType.DROP || type == ClickType.CONTROL_DROP;
    }
}
```

### `NavSlot.java`

```java
package com.example.shop.gui;

/** Fixed slots of the six-row screen: top 45 slots for content, bottom row for navigation buttons, other bottom-row slots left empty. */
public final class NavSlot {

    public static final int ROWS = 45;
    public static final int SIZE = 54;
    public static final int PREV = 45;
    public static final int PAGE = 49;
    public static final int NEXT = 53;

    private NavSlot() {
    }
}
```

### `Icons.java` (loading `gui.yml`)

```java
package com.example.shop.gui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;

import java.io.File;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Icons and titles loaded from gui.yml. Immutable after loading; on reload the whole thing is replaced by a new {@code Icons}.
 *
 * <p>Names and lore are MiniMessage; Bukkit renders custom names in italics, so italics are turned off here
 * (callers do not have to remember to do it each time).
 */
public final class Icons {

    private record Def(Material material, String name, List<String> lore, boolean glow) {
    }

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final Map<String, Def> defs;
    private final Map<String, String> titles;

    private Icons(Map<String, Def> defs, Map<String, String> titles) {
        this.defs = Map.copyOf(defs);
        this.titles = Map.copyOf(titles);
    }

    public static Icons load(Plugin plugin) {
        File file = new File(plugin.getDataFolder(), "gui.yml");
        if (!file.exists()) {
            plugin.saveResource("gui.yml", false);
        }
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(file);

        Map<String, Def> defs = new HashMap<>();
        ConfigurationSection icons = yaml.getConfigurationSection("icons");
        if (icons != null) {
            for (String key : icons.getKeys(false)) {
                ConfigurationSection section = icons.getConfigurationSection(key);
                if (section == null) {
                    continue;
                }
                String materialName = section.getString("material", "STONE");
                Material material = Material.matchMaterial(materialName);
                if (material == null || !material.isItem()) {
                    plugin.getLogger().warning("gui.yml icons." + key + ": unknown material '" + materialName + "', using BARRIER");
                    material = Material.BARRIER;
                }
                defs.put(key, new Def(material, section.getString("name", key),
                        List.copyOf(section.getStringList("lore")), section.getBoolean("glow", false)));
            }
        }

        Map<String, String> titles = new HashMap<>();
        ConfigurationSection titleSection = yaml.getConfigurationSection("titles");
        if (titleSection != null) {
            for (String key : titleSection.getKeys(false)) {
                titles.put(key, titleSection.getString(key, key));
            }
        }
        return new Icons(defs, titles);
    }

    /** Builds a new icon; when the key is missing, returns an obvious BARRIER instead of throwing and making the menu fail to open. */
    public ItemStack build(String key, TagResolver... resolvers) {
        Def def = defs.get(key);
        if (def == null) {
            ItemStack missing = new ItemStack(Material.BARRIER);
            missing.editMeta(meta -> meta.displayName(Component.text("Missing icon: " + key)));
            return missing;
        }
        Component name = plain(MINI.deserialize(def.name(), resolvers));
        List<Component> lore = def.lore().stream().map(line -> plain(MINI.deserialize(line, resolvers))).toList();

        ItemStack stack = new ItemStack(def.material());
        stack.editMeta(meta -> {
            meta.displayName(name);
            meta.lore(lore);
            meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES, ItemFlag.HIDE_ADDITIONAL_TOOLTIP);
            if (def.glow()) {
                meta.setEnchantmentGlintOverride(true);
            }
        });
        return stack;
    }

    public Component title(String key, TagResolver... resolvers) {
        return MINI.deserialize(titles.getOrDefault(key, key), resolvers);
    }

    private static Component plain(Component component) {
        return component.decorationIfAbsent(TextDecoration.ITALIC, TextDecoration.State.FALSE);
    }
}
```

### `PlayerItems.java` (drop at feet when the inventory is full)

```java
package com.example.shop.gui;

import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.Map;

/** Gives items to a player; whatever does not fit in the inventory is dropped at their feet instead of vanishing. Call on the main thread only. */
public final class PlayerItems {

    private PlayerItems() {
    }

    /** @return whether any item was dropped on the ground (callers can use this to notify the player) */
    public static boolean giveOrDrop(Player player, ItemStack stack) {
        Map<Integer, ItemStack> leftover = player.getInventory().addItem(stack.clone());
        for (ItemStack rest : leftover.values()) {
            player.getWorld().dropItemNaturally(player.getLocation(), rest);
        }
        return !leftover.isEmpty();
    }
}
```

### `LatestOnly.java` (the last click wins)

```java
package com.example.shop.gui;

import java.util.concurrent.atomic.AtomicLong;

/**
 * "The last click wins": call {@link #next()} for a ticket before starting each async load, and when the result comes back
 * check it with {@link #isCurrent(long)}; stale results are discarded and never overwrite a newer screen.
 */
public final class LatestOnly {

    private final AtomicLong latest = new AtomicLong();

    public long next() {
        return latest.incrementAndGet();
    }

    public boolean isCurrent(long ticket) {
        return latest.get() == ticket;
    }
}
```

### `PagedListMenu.java` (paged list holder)

```java
package com.example.shop.gui;

import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.List;
import java.util.function.Function;

/**
 * Paged list. The top 45 slots hold entries; the bottom row holds previous page / page number / next page.
 *
 * <p>Paging redraws within the same inventory (no reopening, no flicker). The page index changes on the main thread only;
 * every click is computed against the "current page", so with rapid clicking the last click wins.
 */
public final class PagedListMenu<T> implements ShopMenu {

    /** Handler for clicking an entry. Main thread; the handler revalidates on its own. */
    public interface PickHandler<T> {
        void pick(Player player, T entry);
    }

    private final Inventory inventory;
    private final Icons icons;
    private final List<T> entries;
    private final Function<T, ItemStack> iconOf;
    private final PickHandler<T> onPick;
    private int page;

    public PagedListMenu(Icons icons, List<T> entries, Function<T, ItemStack> iconOf, PickHandler<T> onPick) {
        this.icons = icons;
        this.entries = List.copyOf(entries);
        this.iconOf = iconOf;
        this.onPick = onPick;
        this.inventory = Bukkit.createInventory(this, NavSlot.SIZE,
                icons.title("list", Placeholder.unparsed("page", "1"), Placeholder.unparsed("pages", String.valueOf(pageCount()))));
        render();
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    @Override
    public void onClick(MenuClick click) {
        int slot = click.slot();
        if (slot == NavSlot.PREV) {
            if (page > 0) {
                page--;
                render();
            }
        } else if (slot == NavSlot.NEXT) {
            if (page < pageCount() - 1) {
                page++;
                render();
            }
        } else if (slot >= 0 && slot < NavSlot.ROWS) {
            int index = page * NavSlot.ROWS + slot;
            if (index < entries.size()) {
                onPick.pick(click.player(), entries.get(index));
            }
        }
    }

    private int pageCount() {
        return Math.max(1, (entries.size() + NavSlot.ROWS - 1) / NavSlot.ROWS);
    }

    private void render() {
        inventory.clear();
        int from = page * NavSlot.ROWS;
        for (int i = 0; i < NavSlot.ROWS && from + i < entries.size(); i++) {
            inventory.setItem(i, iconOf.apply(entries.get(from + i)));
        }
        if (page > 0) {
            inventory.setItem(NavSlot.PREV, icons.build("prev"));
        }
        if (page < pageCount() - 1) {
            inventory.setItem(NavSlot.NEXT, icons.build("next"));
        }
        inventory.setItem(NavSlot.PAGE, icons.build("page",
                Placeholder.unparsed("page", String.valueOf(page + 1)),
                Placeholder.unparsed("pages", String.valueOf(pageCount()))));
    }
}
```

### `Menus.java` (open, close, async back to main thread)

```java
package com.example.shop.gui;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import java.util.logging.Level;

/**
 * Menu opening and lifecycle. One instance per plugin (plugin injected at construction); no static mutable state.
 */
public final class Menus {

    private final Plugin plugin;

    public Menus(Plugin plugin) {
        this.plugin = plugin;
    }

    /** Whether the top inventory the player currently has open is this menu (not another menu, and not closed). */
    public boolean isOpen(Player player, ShopMenu menu) {
        return player.getOpenInventory().getTopInventory().getHolder() == menu;
    }

    /**
     * Opens a menu on the next tick. Do not call {@code openInventory} directly inside an {@code InventoryClickEvent}:
     * replacing the player's container window within the same event desyncs the client cursor and inventory.
     */
    public void openNextTick(Player player, ShopMenu menu) {
        if (!plugin.isEnabled()) {
            return;
        }
        UUID id = player.getUniqueId();
        Bukkit.getScheduler().runTask(plugin, () -> {
            Player online = Bukkit.getPlayer(id);
            if (online != null && online.isOnline()) {
                online.openInventory(menu.getInventory());
            }
        });
    }

    /** Closes the player's current container on the next tick (used after a confirmation page completes). */
    public void closeNextTick(Player player) {
        if (!plugin.isEnabled()) {
            return;
        }
        UUID id = player.getUniqueId();
        Bukkit.getScheduler().runTask(plugin, () -> {
            Player online = Bukkit.getPlayer(id);
            if (online != null) {
                online.closeInventory();
            }
        });
    }

    /**
     * Opens a new menu after async work completes: returns to the main thread, and builds and opens it only if the plugin is still enabled and the player is still online.
     * {@code factory} runs on the main thread, so it can safely create an Inventory.
     */
    public void openOnMain(UUID playerId, Supplier<? extends ShopMenu> factory) {
        runOnMain(playerId, player -> player.openInventory(factory.get().getInventory()));
    }

    /**
     * Updates an "already open" menu after async work completes: runs {@code update} only if the player still has <b>this</b> menu open;
     * if the player has closed it or switched to another screen, the result is discarded.
     */
    public void updateIfStillOpen(UUID playerId, ShopMenu menu, Consumer<Player> update) {
        runOnMain(playerId, player -> {
            if (isOpen(player, menu)) {
                update.accept(player);
            }
        });
    }

    private void runOnMain(UUID playerId, Consumer<Player> action) {
        if (!plugin.isEnabled()) {
            return;
        }
        Runnable task = () -> {
            if (!plugin.isEnabled()) {
                return;
            }
            Player player = Bukkit.getPlayer(playerId);
            if (player == null || !player.isOnline()) {
                return;
            }
            action.accept(player);
        };
        if (Bukkit.isPrimaryThread()) {
            task.run();
        } else {
            Bukkit.getScheduler().runTask(plugin, task);
        }
    }

    /**
     * Closes every plugin menu that players have open. {@code onDisable} must call this, otherwise on server stop/reload
     * the items and temporary state in menus are never cleaned up, and players may keep "ghost items".
     *
     * <p>{@code closeInventory()} fires {@code InventoryCloseEvent} <b>synchronously</b>, and the listener is not yet unregistered at that point;
     * so each player has its own try/catch, and one broken handler must not leave other players' menus open.
     *
     * @return the number of menus actually closed
     */
    public int closeAll() {
        int closed = 0;
        List<Player> players = List.copyOf(plugin.getServer().getOnlinePlayers());
        for (Player player : players) {
            try {
                if (player.getOpenInventory().getTopInventory().getHolder() instanceof ShopMenu) {
                    player.closeInventory();
                    closed++;
                }
            } catch (RuntimeException e) {
                plugin.getLogger().log(Level.WARNING, "Failed to close menu of " + player.getName() + " on disable", e);
            }
        }
        return closed;
    }
}
```

### `GuiListener.java` (the single listener)

```java
package com.example.shop.gui;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryAction;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.plugin.Plugin;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Clicks, drags, and closes for every chest menu of this plugin. The menu's own logic lives in {@link ShopMenu#onClick}; this class only does "anti-dupe":
 *
 * <ul>
 *   <li>Top menu: always cancel clicks and drags</li>
 *   <li>Bottom inventory: cancel Shift-clicks (which push items into the menu), double-clicks (which collect matching items from the menu), number keys and offhand swaps;
 *       allow other normal inventory actions</li>
 *   <li>Debounce: repeated clicks from the same player within {@value #DEBOUNCE_MILLIS} ms are ignored (cancelled but not dispatched)</li>
 * </ul>
 */
public final class GuiListener implements Listener {

    private static final long DEBOUNCE_MILLIS = 120L;

    private static final Set<InventoryAction> GUARDED_ACTIONS = EnumSet.of(
            InventoryAction.MOVE_TO_OTHER_INVENTORY,
            InventoryAction.COLLECT_TO_CURSOR,
            InventoryAction.HOTBAR_SWAP,
            InventoryAction.HOTBAR_MOVE_AND_READD,
            InventoryAction.UNKNOWN);

    private static final Set<ClickType> GUARDED_CLICKS = EnumSet.of(
            ClickType.SHIFT_LEFT,
            ClickType.SHIFT_RIGHT,
            ClickType.DOUBLE_CLICK,
            ClickType.NUMBER_KEY,
            ClickType.SWAP_OFFHAND);

    private final Plugin plugin;
    private final Map<UUID, Long> lastClickNanos = new HashMap<>();

    public GuiListener(Plugin plugin) {
        this.plugin = plugin;
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof ShopMenu menu)) {
            return;
        }
        Inventory top = event.getInventory();
        Inventory clicked = event.getClickedInventory();

        if (clicked != top) {
            // Bottom inventory or outside the window: only block actions that affect the top menu
            if (clicked == null
                    || GUARDED_ACTIONS.contains(event.getAction())
                    || GUARDED_CLICKS.contains(event.getClick())) {
                event.setCancelled(true);
            }
            return;
        }

        event.setCancelled(true);
        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        if (isBounce(player.getUniqueId())) {
            return;
        }
        try {
            menu.onClick(new MenuClick(player, event.getRawSlot(), event.getClick()));
        } catch (RuntimeException e) {
            plugin.getLogger().log(Level.SEVERE, "Menu click failed for " + player.getName(), e);
            player.sendMessage(Component.text("Something went wrong. Please try again.", NamedTextColor.RED));
        }
    }

    @EventHandler(priority = EventPriority.HIGH)
    public void onDrag(InventoryDragEvent event) {
        if (!(event.getInventory().getHolder() instanceof ShopMenu)) {
            return;
        }
        int topSize = event.getInventory().getSize();
        for (int rawSlot : event.getRawSlots()) {
            if (rawSlot < topSize) {
                event.setCancelled(true);
                return;
            }
        }
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onClose(InventoryCloseEvent event) {
        if (!(event.getInventory().getHolder() instanceof ShopMenu menu) || !(event.getPlayer() instanceof Player player)) {
            return;
        }
        lastClickNanos.remove(player.getUniqueId());
        try {
            // closeAll() in onDisable reaches here synchronously: plugin.isEnabled() is false at that point,
            // so do synchronous cleanup such as returning items; any scheduled work must check isEnabled() first, otherwise IllegalPluginAccessException is thrown
            menu.onClose(player);
        } catch (RuntimeException e) {
            plugin.getLogger().log(Level.SEVERE, "Menu close handler failed for " + player.getName(), e);
        }
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        lastClickNanos.remove(event.getPlayer().getUniqueId());
    }

    private boolean isBounce(UUID id) {
        long now = System.nanoTime();
        Long last = lastClickNanos.put(id, now);
        return last != null && (now - last) < DEBOUNCE_MILLIS * 1_000_000L;
    }
}
```

### `ShopPlugin.java` (registration and disable)

```java
package com.example.shop;

import com.example.shop.gui.GuiListener;
import com.example.shop.gui.Icons;
import com.example.shop.gui.Menus;
import org.bukkit.plugin.java.JavaPlugin;

public final class ShopPlugin extends JavaPlugin {

    private Icons icons;
    private Menus menus;

    @Override
    public void onEnable() {
        icons = Icons.load(this);
        menus = new Menus(this);
        getServer().getPluginManager().registerEvents(new GuiListener(this), this);
    }

    @Override
    public void onDisable() {
        // Close menus first, then do other cleanup; isEnabled() is already false here; menu.onClose must do synchronous cleanup only
        if (menus != null) {
            menus.closeAll();
        }
    }

    /** On /shop reload, swap in a new immutable Icons; already open menus pick it up the next time they redraw. */
    public void reloadIcons() {
        icons = Icons.load(this);
    }

    public Icons icons() {
        return icons;
    }

    public Menus menus() {
        return menus;
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/shop/
├── ShopPlugin.java
└── gui/
    ├── ShopMenu.java            ← marker interface
    ├── MenuClick.java
    ├── NavSlot.java
    ├── Icons.java
    ├── PlayerItems.java
    ├── LatestOnly.java
    ├── Menus.java
    ├── GuiListener.java         ← the only listener
    ├── PagedListMenu.java       ← one holder per menu kind
    └── ConfirmPurchaseMenu.java
src/main/resources/
└── gui.yml
```

## Thread Safety

- Events, `onClick`, Inventory creation, and `openInventory` all run on the main thread; JDBC/HTTP run async
- Async lambdas carry only a `UUID` and immutable data (the result of `List.copyOf`), never `Player`, `Inventory`, or `ItemStack`
- Return to the main thread with `Menus.openOnMain` / `updateIfStillOpen`: they already include the three checks "plugin still enabled -> player still online -> menu still open"
- Rapid clicking/paging: synchronous redraws compute against the current state on every click; async loads use `LatestOnly` to discard stale results
- To open another menu or close the window inside an `InventoryClickEvent`, use `openNextTick` / `closeNextTick`
- Inside the `InventoryCloseEvent` handler (`onClose`), run `if (!plugin.isEnabled()) return;` before scheduling any task; `closeAll()` in `onDisable` triggers it synchronously, and scheduling then throws `IllegalPluginAccessException`; synchronous cleanup such as returning items should still run
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Solution |
|------|------|------|
| Players can take the menu icons | Only top-menu clicks were cancelled; Shift/number key/double-click were missed | Use this skill's `GuiListener` (it also cancels guarded actions in the bottom inventory) |
| Dragging items into the menu | `InventoryDragEvent` not handled | Always cancel drags that reach top slots (`rawSlot < topSize`) |
| Item bought but no money deducted / charged twice | Trusted the screen, or double-clicked | Revalidate on every click; debounce; do not give the item if payment fails |
| Async result overwrites the new screen | An older request returned later | Take a ticket with `LatestOnly`; discard stale results |
| NPE / wrong menu opened after async returns | The player went offline or closed the menu | `Menus.updateIfStillOpen` (main thread + still-open check) |
| `IllegalPluginAccessException` (on disable) | The `InventoryCloseEvent` handler schedules work inside `onDisable` | Check `plugin.isEnabled()` before scheduling (blocks scheduling only, not synchronous cleanup) |
| Players have extra/missing items after a server restart | `onDisable` did not close menus | `Menus.closeAll()`, and return held items in `onClose` |
| Items vanish when the inventory is full | The return value of `addItem` was ignored | `PlayerItems.giveOrDrop` |
| Cursor or items get messed up when opening a new menu directly in a click event | Container swapped within the same event | `openNextTick` |
| Icons display in italics | Bukkit italicizes custom names by default | `Icons` turns italics off globally |
| Need to enter text/numbers/confirm | A chest is not a form | Use `paper-dialog-ui`; for NMS custom containers use `nms-custom-menu` |
