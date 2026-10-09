# examples — paper-chest-gui

以下範例沿用 `SKILL.md` 的 `com.example.shop.gui` 類別（`ShopMenu`、`PagedListMenu`、`Menus`、`Icons`、`LatestOnly`、`PlayerItems`）。
玩家看到的字串在實務上放進 `lang.yml`／`gui.yml`；範例為了精簡直接寫 `Component.text`。

## 範例 1：分頁商品清單（非同步載入、最後一次開啟為準）

**Input:**
```
menu_kinds: PagedListMenu
rows: 6
來源: 商品存在資料庫，載入必須在非同步
行為: /shop 開啟清單；連續輸入兩次指令只採用最後一次的結果
```

**Output — 資料模型與埠（主執行緒呼叫）:**
```java
package com.example.shop;

import org.bukkit.Material;

/** 一筆上架商品（不可變）。 */
public record Listing(long id, Material material, String name, long price) {
}
```

```java
package com.example.shop;

import java.util.List;

/** 商品資料來源。{@code findActive} 可能做 IO，只能在非同步呼叫。 */
public interface ListingRepository {

    List<Listing> findActive();
}
```

**Output — 開啟流程（非同步查詢 → 回主執行緒 → 開啟）:**
```java
package com.example.shop;

import com.example.shop.gui.Icons;
import com.example.shop.gui.LatestOnly;
import com.example.shop.gui.Menus;
import com.example.shop.gui.PagedListMenu;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class ShopOpener {

    private final ShopPlugin plugin;
    private final ListingRepository repository;
    private final Menus menus;
    private final PurchaseGate gate;
    private final Map<UUID, LatestOnly> latestByPlayer = new ConcurrentHashMap<>();

    public ShopOpener(ShopPlugin plugin, ListingRepository repository, PurchaseGate gate) {
        this.plugin = plugin;
        this.repository = repository;
        this.menus = plugin.menus();
        this.gate = gate;
    }

    /** 主執行緒呼叫（指令）。 */
    public void open(Player player) {
        UUID id = player.getUniqueId();
        LatestOnly latest = latestByPlayer.computeIfAbsent(id, key -> new LatestOnly());
        long ticket = latest.next();

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            List<Listing> listings = repository.findActive();   // 非同步：只帶 UUID 與不可變資料
            if (!latest.isCurrent(ticket)) {
                return;                                          // 玩家又輸入了一次指令，這個結果過期
            }
            menus.openOnMain(id, () -> build(listings));         // 主執行緒：建立 Inventory 並開啟
        });
    }

    private PagedListMenu<Listing> build(List<Listing> listings) {
        Icons icons = plugin.icons();
        return new PagedListMenu<>(icons, listings,
                listing -> icons.build("entry",
                        Placeholder.unparsed("name", listing.name()),
                        Placeholder.unparsed("price", String.valueOf(listing.price()))).withType(listing.material()),
                (player, listing) -> gate.askToBuy(player, listing));
    }

    /** 玩家離線時清掉版本號，避免 map 無限增長。 */
    public void forget(UUID id) {
        latestByPlayer.remove(id);
    }
}
```

**Output — 點擊項目後進入確認頁（在點擊事件內，所以下一 tick 才開）:**
```java
package com.example.shop;

import com.example.shop.gui.ConfirmPurchaseMenu;
import com.example.shop.gui.Menus;
import org.bukkit.entity.Player;

public final class PurchaseGate {

    private final ShopPlugin plugin;
    private final Wallet wallet;
    private final Stock stock;

    public PurchaseGate(ShopPlugin plugin, Wallet wallet, Stock stock) {
        this.plugin = plugin;
        this.wallet = wallet;
        this.stock = stock;
    }

    public void askToBuy(Player player, Listing listing) {
        Menus menus = plugin.menus();
        ConfirmPurchaseMenu confirm = new ConfirmPurchaseMenu(plugin.icons(), menus, wallet, stock, listing);
        menus.openNextTick(player, confirm);
    }
}
```

重點：
- 非同步階段只做查詢；`PagedListMenu`／Inventory 都在主執行緒建立
- `LatestOnly` 讓舊的結果不會蓋掉較新的開啟請求
- 翻頁不重開視窗：`PagedListMenu.render()` 在同一個 inventory 內重畫

---

## 範例 2：確認購買（每次點擊重新驗證 + 背包滿時掉落）

**Input:**
```
menu_kinds: ConfirmPurchaseMenu
permission: shop.buy
行為: 權限、商品是否仍上架、餘額在「按下確認」那一刻重新檢查；完成後關閉；背包滿則掉在腳邊
```

**Output — 經濟與庫存埠（主執行緒）:**
```java
package com.example.shop;

import java.util.UUID;

/** 玩家餘額。所有方法只在主執行緒呼叫。 */
public interface Wallet {

    long balance(UUID player);

    /** 餘額足夠才扣，回傳是否成功。 */
    boolean withdraw(UUID player, long amount);

    void deposit(UUID player, long amount);
}
```

```java
package com.example.shop;

/** 上架商品庫存。所有方法只在主執行緒呼叫。 */
public interface Stock {

    boolean isListed(long listingId);

    /** 原子地下架；若同一瞬間被別人買走則回 false。 */
    boolean take(long listingId);
}
```

**Output — 確認頁 holder:**
```java
package com.example.shop.gui;

import com.example.shop.Listing;
import com.example.shop.Stock;
import com.example.shop.Wallet;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.UUID;

public final class ConfirmPurchaseMenu implements ShopMenu {

    private static final String PERMISSION = "shop.buy";
    private static final int CANCEL_SLOT = 11;
    private static final int PREVIEW_SLOT = 13;
    private static final int CONFIRM_SLOT = 15;   // 確認鍵固定在右側

    private final Inventory inventory;
    private final Menus menus;
    private final Wallet wallet;
    private final Stock stock;
    private final Listing listing;
    private boolean completed;

    public ConfirmPurchaseMenu(Icons icons, Menus menus, Wallet wallet, Stock stock, Listing listing) {
        this.menus = menus;
        this.wallet = wallet;
        this.stock = stock;
        this.listing = listing;
        this.inventory = Bukkit.createInventory(this, 27, icons.title("confirm"));

        var price = Placeholder.unparsed("price", String.valueOf(listing.price()));
        inventory.setItem(CANCEL_SLOT, icons.build("cancel"));
        inventory.setItem(PREVIEW_SLOT, icons.build("entry", Placeholder.unparsed("name", listing.name()), price)
                .withType(listing.material()));
        inventory.setItem(CONFIRM_SLOT, icons.build("confirm", price));
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    @Override
    public void onClick(MenuClick click) {
        Player player = click.player();
        if (click.slot() == CANCEL_SLOT) {
            menus.closeNextTick(player);
        } else if (click.slot() == CONFIRM_SLOT) {
            confirm(player);
        }
    }

    /** 每一步都用「現在」的狀態判斷，不信任開啟選單那一刻看到的畫面。 */
    private void confirm(Player player) {
        if (completed) {
            return;   // 已經結帳過：連點不會扣兩次
        }
        if (!player.hasPermission(PERMISSION)) {
            fail(player, "You do not have permission to buy.");
            return;
        }
        if (!stock.isListed(listing.id())) {
            fail(player, "That item is no longer for sale.");
            return;
        }
        UUID id = player.getUniqueId();
        if (wallet.balance(id) < listing.price()) {
            fail(player, "You cannot afford this item.");
            return;
        }
        if (!wallet.withdraw(id, listing.price())) {
            fail(player, "Payment failed.");
            return;
        }
        if (!stock.take(listing.id())) {
            wallet.deposit(id, listing.price());   // 同一瞬間被別人買走：退款
            fail(player, "Someone else just bought it. You were not charged.");
            return;
        }

        completed = true;
        boolean dropped = PlayerItems.giveOrDrop(player, new ItemStack(listing.material()));
        player.sendMessage(Component.text("Purchased " + listing.name() + ".", NamedTextColor.GREEN));
        if (dropped) {
            player.sendMessage(Component.text("Your inventory is full; the item was dropped at your feet.", NamedTextColor.YELLOW));
        }
        menus.closeNextTick(player);
    }

    private void fail(Player player, String message) {
        player.sendMessage(Component.text(message, NamedTextColor.RED));
        menus.closeNextTick(player);
    }
}
```

重點：
- 權限、庫存、餘額都在 `confirm` 內重新檢查；`completed` 與 `GuiListener` 的去彈跳一起防止連點重複扣款
- 扣款成功但下架失敗時**退款**，不給物品；順序是「先扣款、再下架、最後給物品」
- 完成後用 `closeNextTick`，不在點擊事件內直接關閉或換視窗
- 實務上確認頁如果只是「是／否」，優先改用 `paper-dialog-ui`；箱子確認頁適合需要預覽物品的情境

---

## 範例 3：註冊與停用（避免幽靈物品）

**Input:**
```
行為: 監聽器只註冊一次；伺服器停止或 reload 時，所有開著的選單先被關閉
```

**Output — 自訂的暫存型選單在 onClose 退還物品（搭配 `closeAll`）:**
```java
package com.example.shop.gui;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.List;

/**
 * 暫存型選單：開啟時從玩家背包「借」出物品放進選單，關閉時一定要還回去。
 * 因為 onDisable 的 closeAll() 會觸發 onClose，伺服器停止時玩家也不會丟失物品。
 */
public final class EscrowMenu implements ShopMenu {

    private final Inventory inventory;
    private final List<ItemStack> borrowed;
    private boolean returned;

    public EscrowMenu(Player owner, List<ItemStack> borrowed) {
        this.borrowed = borrowed.stream().map(ItemStack::clone).toList();
        this.inventory = Bukkit.createInventory(this, 27, owner.name());
        for (int i = 0; i < this.borrowed.size() && i < inventory.getSize(); i++) {
            inventory.setItem(i, this.borrowed.get(i));
        }
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    @Override
    public void onClick(MenuClick click) {
        // 只展示；所有點擊已被 GuiListener 取消
    }

    @Override
    public void onClose(Player player) {
        if (returned) {
            return;
        }
        returned = true;
        for (ItemStack item : borrowed) {
            PlayerItems.giveOrDrop(player, item);
        }
    }
}
```

**驗證（手動，沒有 mock 時最可靠）:**
1. 開任一選單後 `/stop`：選單必須先被關閉，暫存物品已退還
2. 暫時把 `onDisable` 內的 `closeAll()` 註解掉再試一次：選單應該留著直到伺服器斷線（確認這個呼叫真的有作用）
3. 在某個選單的 `onClose` 內加一個 `runTask` 且不檢查 `plugin.isEnabled()`，再 `/stop`：會看到 `IllegalPluginAccessException`（被 `GuiListener` 記錄，不影響其他玩家的選單關閉）；加上檢查後消失
