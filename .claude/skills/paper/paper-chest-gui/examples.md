# examples — paper-chest-gui

The examples below reuse the `com.example.shop.gui` classes from `SKILL.md` (`ShopMenu`, `PagedListMenu`, `Menus`, `Icons`, `LatestOnly`, `PlayerItems`).
In practice, player-visible strings go in `lang.yml`/`gui.yml`; the examples write `Component.text` directly for brevity.

## Example 1: Paged listing menu (async load, last open wins)

**Input:**
```
menu_kinds: PagedListMenu
rows: 6
source: listings are stored in a database; loading must be async
behavior: /shop opens the list; if the command is entered twice in a row, only the last result is used
```

**Output — data model and ports (called on the main thread):**
```java
package com.example.shop;

import org.bukkit.Material;

/** One listed item (immutable). */
public record Listing(long id, Material material, String name, long price) {
}
```

```java
package com.example.shop;

import java.util.List;

/** Listing data source. {@code findActive} may do IO, so call it async only. */
public interface ListingRepository {

    List<Listing> findActive();
}
```

**Output — open flow (async query -> back to main thread -> open):**
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

    /** Called on the main thread (command). */
    public void open(Player player) {
        UUID id = player.getUniqueId();
        LatestOnly latest = latestByPlayer.computeIfAbsent(id, key -> new LatestOnly());
        long ticket = latest.next();

        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            List<Listing> listings = repository.findActive();   // async: carries only the UUID and immutable data
            if (!latest.isCurrent(ticket)) {
                return;                                          // the player ran the command again; this result is stale
            }
            menus.openOnMain(id, () -> build(listings));         // main thread: create the Inventory and open it
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

    /** Clear the ticket when the player goes offline so the map does not grow forever. */
    public void forget(UUID id) {
        latestByPlayer.remove(id);
    }
}
```

**Output — clicking an entry leads to the confirmation page (inside a click event, so it opens on the next tick):**
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

Key points:
- The async phase only runs the query; `PagedListMenu` and the Inventory are created on the main thread
- `LatestOnly` keeps an old result from overwriting a newer open request
- Paging does not reopen the window: `PagedListMenu.render()` redraws within the same inventory

---

## Example 2: Confirm purchase (revalidate on every click + drop when inventory is full)

**Input:**
```
menu_kinds: ConfirmPurchaseMenu
permission: shop.buy
behavior: permission, whether the listing is still for sale, and balance are rechecked at the moment "Confirm" is pressed; close when done; drop at the feet if the inventory is full
```

**Output — economy and stock ports (main thread):**
```java
package com.example.shop;

import java.util.UUID;

/** Player balance. All methods are called on the main thread only. */
public interface Wallet {

    long balance(UUID player);

    /** Withdraws only if the balance is sufficient; returns whether it succeeded. */
    boolean withdraw(UUID player, long amount);

    void deposit(UUID player, long amount);
}
```

```java
package com.example.shop;

/** Stock of listed items. All methods are called on the main thread only. */
public interface Stock {

    boolean isListed(long listingId);

    /** Atomically delists; returns false if someone else bought it at the same instant. */
    boolean take(long listingId);
}
```

**Output — confirmation page holder:**
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
    private static final int CONFIRM_SLOT = 15;   // the confirm button is fixed on the right

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

    /** Every step checks the "current" state, never trusting the screen seen when the menu opened. */
    private void confirm(Player player) {
        if (completed) {
            return;   // already checked out: rapid clicking cannot charge twice
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
            wallet.deposit(id, listing.price());   // someone else bought it at the same instant: refund
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

Key points:
- Permission, stock, and balance are all rechecked inside `confirm`; `completed` together with `GuiListener`'s debounce prevents double charging on rapid clicks
- If payment succeeds but delisting fails, **refund** and do not give the item; the order is "charge first, delist next, give the item last"
- After completing, use `closeNextTick`; never close or swap windows directly inside the click event
- In practice, if the confirmation page is only "yes/no", prefer `paper-dialog-ui`; a chest confirmation page suits cases that need an item preview

---

## Example 3: Registration and disable (avoiding ghost items)

**Input:**
```
behavior: the listener is registered only once; when the server stops or reloads, all open menus are closed first
```

**Output — a custom escrow-style menu returns items in onClose (works with `closeAll`):**
```java
package com.example.shop.gui;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.List;

/**
 * Escrow-style menu: when opened, items are "borrowed" from the player's inventory into the menu, and must always be returned on close.
 * Since `closeAll()` in onDisable triggers onClose, players do not lose items when the server stops.
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
        // display only; every click has already been cancelled by GuiListener
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

**Verification (manual; most reliable when there is no mock):**
1. Open any menu and run `/stop`: the menu must be closed first and the held items already returned
2. Temporarily comment out `closeAll()` in `onDisable` and try again: the menu should stay until the server disconnects (confirms the call really has an effect)
3. Add a `runTask` to some menu's `onClose` without checking `plugin.isEnabled()`, then `/stop`: you will see `IllegalPluginAccessException` (logged by `GuiListener`, without affecting other players' menu closing); it disappears once the check is added
