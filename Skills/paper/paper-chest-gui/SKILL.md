---
name: paper-chest-gui
description: "以 Bukkit API 建立箱子介面 GUI：InventoryHolder 標記介面、單一 GuiListener 取消點擊／拖曳／Shift／數字鍵、每次點擊重新驗證、分頁與去彈跳、gui.yml 圖示、onDisable 關閉所有選單 / Chest-inventory GUIs with the Bukkit API: holder marker interface, one cancelling listener, per-click revalidation, paging, gui.yml icons, safe disable"
---

# Paper Chest GUI / 箱子介面

## 技能名稱 / Skill Name

`paper-chest-gui`

## 目的 / Purpose

用純 Bukkit／Paper API 做箱子式選單（商店列表、確認頁、設定頁），不碰 NMS。
重點不是「怎麼顯示」，而是「怎麼不被玩家刷物品」：

- 每種選單一個 `InventoryHolder`，並共用一個**標記介面**，讓整個插件只需要一個 `GuiListener` 判斷「這是我的選單」
- 上方選單的點擊、拖曳一律取消；**下方背包**的 Shift 點擊、數字鍵、雙擊、副手交換也要取消，否則物品會被搬進選單或從選單被抓出來
- 每次點擊都**重新驗證**狀態（權限、餘額、商品是否還在），不信任畫面上畫的東西
- 非同步工作回來後，先切回主執行緒，再確認選單**仍開著**才更新
- `onDisable` 關閉所有開啟中的選單，避免「幽靈物品」；`InventoryCloseEvent` 處理器用 `plugin.isEnabled()` 保護

> 表單輸入、確認視窗（是／否）優先用 [`paper-dialog-ui`](../paper-dialog-ui/SKILL.md)，不需要箱子格子。
> 需要 NMS `AbstractContainerMenu`（自訂容器邏輯、特殊槽位）時改用 `nms-custom-menu`。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（兩版範本相同；`InventoryView` 在 26.2 改為介面，本技能只用 `event.getInventory()` 與 `player.getOpenInventory()`，兩版皆可編譯）
- 純 Paper API，不需要 Paperweight

## 觸發條件 / Triggers

- 「箱子 GUI」「chest GUI」「InventoryHolder」「選單」「menu」「createInventory」
- 「分頁」「paging」「翻頁」「InventoryClickEvent」「物品被拿走」「刷物品」「dupe」
- 「gui.yml」「圖示設定」「確認購買」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package` | `com.example.shop.gui` | GUI 類別所在 package |
| `menu_kinds` | `PagedListMenu`, `ConfirmPurchaseMenu` | 要做的選單種類（每種一個 holder） |
| `rows` | `6` | 列數（6 列 = 54 格；上 45 格內容、底列放導覽鍵） |
| `icons_file` | `gui.yml` | 圖示（Material + MiniMessage 名稱／lore）設定檔 |
| `permission` | `shop.buy` | 動作所需權限（每次點擊重新檢查） |

## 輸出產物 / Outputs

- `ShopMenu.java` — 標記介面（`InventoryHolder` + `onClick`／`onClose`）
- `MenuClick.java` — 傳給選單的點擊資料（不可變）
- `NavSlot.java` — 固定導覽格位
- `Icons.java` — 從 `gui.yml` 載入圖示與標題（MiniMessage）
- `PlayerItems.java` — 背包滿時掉在腳邊
- `LatestOnly.java` — 「最後一次點擊為準」的版本號
- `PagedListMenu.java` — 分頁清單 holder
- `Menus.java` — 開啟／關閉／非同步回主執行緒／`closeAll`
- `GuiListener.java` — 唯一的點擊、拖曳、關閉監聽器
- `ShopPlugin.java` — 註冊監聽器、`onDisable` 關閉選單
- `gui.yml` — 圖示與標題設定

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。只需要 `paper-api`（`compileOnly`）。

`src/main/resources/gui.yml`（預設內容；`Icons.load` 第一次會寫到 `plugins/<name>/gui.yml`）：

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

- 玩家看到的文字一律放 `gui.yml`（英文、MiniMessage），程式碼不寫字面值（唯一例外是「發生錯誤」這類防呆訊息，實務上也應搬進 `lang.yml`）
- 清單選項的「已選／未選」標記沿用同一套前綴（已選 `" <white>▸ "`、未選 `"   <gray>"`），讓不同選單長得一致
- 空格就留空，不鋪玻璃片；真的需要「死格」時用 `setHideTooltip(true)`，避免空的提示框

## 代碼範本 / Code Template

### `ShopMenu.java`（標記介面）

```java
package com.example.shop.gui;

import org.bukkit.entity.Player;
import org.bukkit.inventory.InventoryHolder;

/**
 * 本插件所有箱子選單的標記。{@link GuiListener} 以 {@code instanceof ShopMenu} 判斷「這是我的選單」，
 * {@link Menus#closeAll()} 也用它找出要關的選單。
 *
 * <p>規則：
 * <ul>
 *   <li>每個插件有自己的標記介面，<b>不要</b>共用別的插件的型別（否則 {@code closeAll} 會關到別人的選單）</li>
 *   <li>{@link #getInventory()} 必須永遠回傳同一個 Inventory（Bukkit 慣例）</li>
 *   <li>一個 holder 活過整個畫面：翻頁在同一個 inventory 內重畫，不重開</li>
 * </ul>
 */
public interface ShopMenu extends InventoryHolder {

    /** 玩家點擊上方選單的某一格。主執行緒；{@link GuiListener} 已取消事件與去彈跳。 */
    void onClick(MenuClick click);

    /**
     * 選單關閉。預設什麼都不做；需要退還暫存物品的選單覆寫它。
     * 插件停用時 {@code closeAll()} 也會同步呼叫它：只做同步清理；若要排程任務，先檢查 {@code plugin.isEnabled()}。
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

/** 一次點擊的不可變快照。{@code slot} 是上方選單的格位（0 起算）。 */
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

/** 六列畫面的固定格位：上 45 格內容，底列放導覽鍵，其餘底列格留空。 */
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

### `Icons.java`（`gui.yml` 載入）

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
 * 從 gui.yml 載入的圖示與標題。載入後不可變；reload 時整個換成新的 {@code Icons}。
 *
 * <p>名稱與 lore 是 MiniMessage；Bukkit 會把自訂名稱渲染成斜體，所以這裡統一關掉斜體
 * （呼叫端不必每個都記得）。
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

    /** 建一個新的圖示；找不到 key 時回一個明顯的 BARRIER，而不是丟例外讓選單打不開。 */
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

### `PlayerItems.java`（背包滿時掉在腳邊）

```java
package com.example.shop.gui;

import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.Map;

/** 給玩家物品；背包放不下的部分掉在腳邊，而不是消失。只在主執行緒呼叫。 */
public final class PlayerItems {

    private PlayerItems() {
    }

    /** @return 是否有任何物品掉到地上（呼叫端可據此提示玩家） */
    public static boolean giveOrDrop(Player player, ItemStack stack) {
        Map<Integer, ItemStack> leftover = player.getInventory().addItem(stack.clone());
        for (ItemStack rest : leftover.values()) {
            player.getWorld().dropItemNaturally(player.getLocation(), rest);
        }
        return !leftover.isEmpty();
    }
}
```

### `LatestOnly.java`（最後一次點擊為準）

```java
package com.example.shop.gui;

import java.util.concurrent.atomic.AtomicLong;

/**
 * 「最後一次點擊為準」：每次發起非同步載入前 {@link #next()} 取號，結果回來時
 * 用 {@link #isCurrent(long)} 檢查，舊的結果直接丟掉，不覆蓋較新的畫面。
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

### `PagedListMenu.java`（分頁清單 holder）

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
 * 分頁清單。上 45 格放項目，底列放上一頁／頁碼／下一頁。
 *
 * <p>翻頁在同一個 inventory 內重畫（不重開視窗，不閃）。頁碼只在主執行緒改；
 * 每次點擊都以「目前頁」計算，連點時最後一次點擊的結果為準。
 */
public final class PagedListMenu<T> implements ShopMenu {

    /** 點到某個項目時的處理。主執行緒；處理器自己負責重新驗證。 */
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

### `Menus.java`（開啟、關閉、非同步回主執行緒）

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
 * 選單的開啟與生命週期。每個插件一個實例（建構時注入 plugin），沒有靜態可變狀態。
 */
public final class Menus {

    private final Plugin plugin;

    public Menus(Plugin plugin) {
        this.plugin = plugin;
    }

    /** 玩家目前最上層開著的，是不是這個選單（不是別的選單、也不是已關閉）。 */
    public boolean isOpen(Player player, ShopMenu menu) {
        return player.getOpenInventory().getTopInventory().getHolder() == menu;
    }

    /**
     * 下一 tick 開啟選單。在 {@code InventoryClickEvent} 內不要直接 {@code openInventory}：
     * 同一個事件裡換掉玩家的容器視窗，客戶端游標與背包同步會錯亂。
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

    /** 下一 tick 關閉玩家目前的容器（確認頁完成後使用）。 */
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
     * 非同步工作完成後開啟新選單：回到主執行緒，確認插件仍啟用、玩家仍在線，才建立並開啟。
     * {@code factory} 在主執行緒執行，可以安全建立 Inventory。
     */
    public void openOnMain(UUID playerId, Supplier<? extends ShopMenu> factory) {
        runOnMain(playerId, player -> player.openInventory(factory.get().getInventory()));
    }

    /**
     * 非同步工作完成後更新「已經開著」的選單：只有玩家仍開著<b>這個</b>選單時才執行 {@code update}，
     * 玩家若已關閉或換成別的畫面，結果直接丟掉。
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
     * 關閉所有玩家開著的本插件選單。{@code onDisable} 必須呼叫，否則伺服器停止／reload 時
     * 選單裡的物品與暫存狀態沒有清理，玩家可能帶著「幽靈物品」。
     *
     * <p>{@code closeInventory()} 會<b>同步</b>觸發 {@code InventoryCloseEvent}，而此時監聽器還沒註銷；
     * 所以每位玩家各自 try/catch，一個壞掉的處理器不能讓其他人的選單留著。
     *
     * @return 實際關閉的選單數
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

### `GuiListener.java`（唯一的監聽器）

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
 * 本插件所有箱子選單的點擊、拖曳、關閉。選單自己的邏輯在 {@link ShopMenu#onClick}，這裡只做「防刷」：
 *
 * <ul>
 *   <li>上方選單：點擊與拖曳一律取消</li>
 *   <li>下方背包：Shift 點擊（會把物品塞進選單）、雙擊（會從選單收集同款物品）、數字鍵／副手交換
 *       一律取消；其餘一般背包操作放行</li>
 *   <li>去彈跳：同一位玩家 {@value #DEBOUNCE_MILLIS} ms 內的重複點擊忽略（取消但不分派）</li>
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
            // 下方背包或視窗外：只擋會牽動上方選單的操作
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
            // onDisable 的 closeAll() 會同步走到這裡：此時 plugin.isEnabled() 為 false，
            // 退還物品這類同步清理照做；需要排程的工作必須先檢查 isEnabled()，否則丟 IllegalPluginAccessException
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

### `ShopPlugin.java`（註冊與停用）

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
        // 先關選單，再做其他清理；此時 isEnabled() 已是 false；menu.onClose 只做同步清理
        if (menus != null) {
            menus.closeAll();
        }
    }

    /** /shop reload 時換成新的不可變 Icons；已開啟的選單下次重畫才會套用。 */
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

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/shop/
├── ShopPlugin.java
└── gui/
    ├── ShopMenu.java            ← 標記介面
    ├── MenuClick.java
    ├── NavSlot.java
    ├── Icons.java
    ├── PlayerItems.java
    ├── LatestOnly.java
    ├── Menus.java
    ├── GuiListener.java         ← 唯一監聽器
    ├── PagedListMenu.java       ← 每種選單一個 holder
    └── ConfirmPurchaseMenu.java
src/main/resources/
└── gui.yml
```

## 執行緒安全注意事項 / Thread Safety

- 事件、`onClick`、建立 Inventory、`openInventory` 全部在主執行緒；JDBC／HTTP 在非同步
- 非同步 lambda 只帶 `UUID` 與不可變資料（`List.copyOf` 的結果），不帶 `Player`、`Inventory`、`ItemStack`
- 回主執行緒用 `Menus.openOnMain` / `updateIfStillOpen`：已含「插件仍啟用 → 玩家仍在線 → 選單仍開著」三道檢查
- 連點／連翻頁：同步重畫時每次點擊都以目前狀態計算；非同步載入用 `LatestOnly` 丟掉過期結果
- 在 `InventoryClickEvent` 內要開別的選單或關閉視窗，用 `openNextTick` / `closeNextTick`
- `InventoryCloseEvent` 處理器（`onClose`）內若要排程任務，先 `if (!plugin.isEnabled()) return;`；`onDisable` 的 `closeAll()` 會同步觸發它，此時排程會丟 `IllegalPluginAccessException`；退還物品等同步清理則照做
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 玩家能把選單的圖示拿走 | 只取消了上方點擊，漏了 Shift／數字鍵／雙擊 | 用本技能的 `GuiListener`（下方背包的受保護操作也取消） |
| 拖曳物品進選單 | 沒處理 `InventoryDragEvent` | 拖曳跨到上方格位（`rawSlot < topSize`）一律取消 |
| 買到東西但沒扣錢／重複扣款 | 信任了畫面，或連點兩次 | 每次點擊重新驗證；去彈跳；扣款失敗不給物品 |
| 非同步結果覆蓋了新畫面 | 舊請求較晚回來 | `LatestOnly` 取號，過期結果丟棄 |
| 非同步回來後 NPE／開錯選單 | 玩家已離線或已關閉選單 | `Menus.updateIfStillOpen`（主執行緒 + 仍開著檢查） |
| `IllegalPluginAccessException`（停用時） | `InventoryCloseEvent` 處理器在 `onDisable` 內排程工作 | 排程前 `plugin.isEnabled()` 檢查（只擋排程，不擋同步清理） |
| 伺服器重啟後玩家背包多出／少了物品 | `onDisable` 沒關選單 | `Menus.closeAll()`，並在 `onClose` 退還暫存物品 |
| 背包滿了物品消失 | `addItem` 的回傳值被忽略 | `PlayerItems.giveOrDrop` |
| 在點擊事件裡直接開新選單，游標或物品錯亂 | 同一事件內換容器 | `openNextTick` |
| 圖示顯示斜體 | Bukkit 對自訂名稱預設斜體 | `Icons` 統一關閉斜體 |
| 需要輸入文字／數字／是否確認 | 箱子不是表單 | 改用 `paper-dialog-ui`；NMS 自訂容器改用 `nms-custom-menu` |
