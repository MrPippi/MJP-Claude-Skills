---
name: paper-softdepend-hook
description: "安全使用第三方軟依賴（Vault、PlaceholderAPI、packetevents）：softdepend 宣告、isPluginEnabled 先檢查再建構、Hook + Bridge 分離、避開 Bukkit 監聽器簽名陷阱、接 LinkageError、Vault 消費端／提供端、PlaceholderAPI expansion 快照 / Safe soft dependencies on third-party plugins with Hook + Bridge split and class-load boundary tests"
---

# Paper Softdepend Hook

## Skill Name

`paper-softdepend-hook`

## Purpose

Let a plugin gain extra features when a third-party plugin (Vault, PlaceholderAPI, packetevents, ...) **is installed**, and still start normally when it **is not**.
This is the third-party counterpart of [`paper-service-api`](../paper-service-api/SKILL.md) (which covers your own plugins): the difference is that third-party types are **not in your jar**, so when the plugin is missing, the JVM throws `NoClassDefFoundError` as soon as it loads any class that references them.

The solution is a three-layer split:

1. **Hook**: contains no third-party types at all (no fields, no method signatures, no method bodies; it only calls the Bridge's static factory), so it can always be loaded safely. It does the `isPluginEnabled` check, catches `LinkageError`, warns once, and degrades.
2. **Bridge**: the **only** class that touches third-party types, and it is only touched after the check passes.
3. **Your own interface (Port)**: the interface the Bridge implements and the rest of the code depends on. It contains only JDK/Paper types, so business code never knows the third party exists.

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (identical on both versions, no version-specific lines)
- Pure Paper API; soft dependencies are obtained via `compileOnly`: VaultAPI 1.7.1, PlaceholderAPI 2.11.6, packetevents-spigot 2.13.0
- Paperweight is not required

## Triggers

- 「軟依賴」「softdepend」「soft dependency」「Hook」「Bridge」
- 「Vault」「經濟插件」「Economy provider」「PlaceholderAPI」「expansion」「packetevents」
- 「NoClassDefFoundError」「Failed to register events for class」「監聽器沒註冊」
- 「沒裝某插件也要能啟動」「optional plugin integration」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `dependency` | `Vault` | The third-party plugin's `plugin.yml name` (case must match exactly) |
| `integration_package` | `com.example.market.integration` | Package containing the Hook/Bridge/Port |
| `role` | `consumer` / `provider` / `expansion` / `packet` | Consume (Vault balance lookup), provide (register an Economy), PAPI placeholders, packet listening |
| `port_name` | `MoneyPort` | Name of your own interface (JDK/Paper types only) |
| `required` | `false` | `false` -> `softdepend`; `true` -> use `depend` instead (the plugin will not start without it, and this skill is not needed) |

## Outputs

- `softdepend` in `plugin.yml` and the `compileOnly` dependencies
- `MoneyPort.java`, `NoMoney.java` — your own interface and its no-op implementation for when the dependency is absent
- `VaultHook.java` / `VaultBridge.java` — Vault consumer (balance lookup, withdrawal, formatting)
- `LedgerPort.java` / `LedgerEconomy.java` / `VaultProviderBridge.java` — optional: provider side that registers your own `Economy`
- `SnapshotPublisher.java` / `PlaceholderSnapshot.java` / `MarketExpansion.java` / `PapiHook.java` / `PapiBridge.java` — PlaceholderAPI expansion
- `JoinListener.java` — demonstrates a listener that never touches soft-dependency types
- `MarketPlugin.java` — enable order and disable cleanup
- Boundary test (`examples.md`): reflectively load the Hook on a classpath without the dependency

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Soft dependencies are always `compileOnly` and **must not be shaded into the jar**:

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly('com.github.MilkBowl:VaultAPI:1.7.1') { exclude group: 'org.bukkit' }
    compileOnly 'me.clip:placeholderapi:2.11.6'
    compileOnly 'com.github.retrooper:packetevents-spigot:2.13.0'
}
```

`plugin.yml` (the name must match the other plugin's `name` exactly, including case; `packetevents` is lowercase):

```yaml
name: Market
main: com.example.market.MarketPlugin
api-version: '26.2'
softdepend: [Vault, PlaceholderAPI, packetevents]
```

`softdepend` only guarantees "if the other plugin exists, it is enabled before this plugin". It does **not guarantee it exists**, nor that the economy plugin behind Vault has registered its service.

## Code Template

### Core Rules

1. `isPluginEnabled(name)` comes **before** any code that would load third-party types (calling a Bridge static method, `new` on a Bridge).
2. The Hook's fields, method signatures, and lambda-captured variables must not contain third-party types; it holds only your own Port.
3. No class other than the Bridge may `import` a third-party package.
4. Every call into the Bridge is wrapped in `try { ... } catch (LinkageError e)`: on a version mismatch or load failure, degrade and **warn only once**.
5. A `Listener` class registered with Bukkit **must not** have a third-party type in any member signature (see "The Listener Trap" below).

### `MoneyPort.java` (your own interface, JDK/Paper types only)

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;

import java.util.UUID;

/**
 * Own interface for economy features: business code depends only on this and does not know Vault exists.
 *
 * <p>Rule: call every method on the main thread only (most Vault providers are not thread-safe).
 * Failure semantics are fixed: queries return 0/false, withdrawals and deposits return false.
 */
public interface MoneyPort {

    /** Whether an economy provider is currently available. */
    boolean available();

    double balance(UUID player);

    boolean has(UUID player, double amount);

    /** Returns true on success; returns false on insufficient funds or when there is no provider. */
    boolean withdraw(UUID player, double amount);

    boolean deposit(UUID player, double amount);

    /**
     * Converts the provider's amount string into a Component. {@code Economy.format()} often contains legacy color codes (§a, &6),
     * so it <b>must not</b> be inserted into a MiniMessage string directly, or the color codes are treated as plain text; use this method's Component as the placeholder.
     */
    Component format(double amount);

    /** Plain text with all formatting stripped (for log files and the PlaceholderAPI raw value). */
    String plain(double amount);
}
```

### `NoMoney.java` (no-op implementation when the dependency is absent)

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;

import java.util.Locale;
import java.util.UUID;

/** Used when Vault is not installed or there is no economy provider: every operation answers with "refused", so business code never checks for null. */
public enum NoMoney implements MoneyPort {
    INSTANCE;

    @Override
    public boolean available() {
        return false;
    }

    @Override
    public double balance(UUID player) {
        return 0.0;
    }

    @Override
    public boolean has(UUID player, double amount) {
        return false;
    }

    @Override
    public boolean withdraw(UUID player, double amount) {
        return false;
    }

    @Override
    public boolean deposit(UUID player, double amount) {
        return false;
    }

    @Override
    public Component format(double amount) {
        return Component.text(plain(amount));
    }

    @Override
    public String plain(double amount) {
        return String.format(Locale.ROOT, "%.2f", amount);
    }
}
```

### `VaultBridge.java` (the only consumer-side class that touches Vault types)

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.plugin.RegisteredServiceProvider;
import org.bukkit.plugin.ServicesManager;

import java.util.UUID;

/**
 * The only consumer-side class that touches {@code net.milkbowl.vault} types.
 * <b>This class must never be loaded when Vault is not installed</b>: every incoming call is first guarded by {@link VaultHook}
 * with {@code isPluginEnabled} and a {@link LinkageError} catch.
 *
 * <p>Every operation fetches {@link Economy} from the ServicesManager again: Vault is only a bridge, and the real economy plugin
 * may register after this plugin, be reloaded, or be disabled, so a cached instance would be a stale provider.
 */
final class VaultBridge implements MoneyPort {

    private final ServicesManager services;

    private VaultBridge(ServicesManager services) {
        this.services = services;
    }

    /** The return type is deliberately your own interface: the caller's method body need not load VaultBridge just for type checking. */
    static MoneyPort create(ServicesManager services) {
        return new VaultBridge(services);
    }

    private Economy economy() {
        RegisteredServiceProvider<Economy> registration = services.getRegistration(Economy.class);
        return registration == null ? null : registration.getProvider();
    }

    private static OfflinePlayer offline(UUID player) {
        return Bukkit.getOfflinePlayer(player);
    }

    @Override
    public boolean available() {
        return economy() != null;
    }

    @Override
    public double balance(UUID player) {
        Economy economy = economy();
        return economy == null ? 0.0 : economy.getBalance(offline(player));
    }

    @Override
    public boolean has(UUID player, double amount) {
        Economy economy = economy();
        return economy != null && economy.has(offline(player), amount);
    }

    @Override
    public boolean withdraw(UUID player, double amount) {
        Economy economy = economy();
        return economy != null && economy.withdrawPlayer(offline(player), amount).transactionSuccess();
    }

    @Override
    public boolean deposit(UUID player, double amount) {
        Economy economy = economy();
        return economy != null && economy.depositPlayer(offline(player), amount).transactionSuccess();
    }

    @Override
    public Component format(double amount) {
        Economy economy = economy();
        if (economy == null) {
            return NoMoney.INSTANCE.format(amount);
        }
        // The result of format() often contains § color codes: parse it into a Component with the legacy serializer, then pass it to MiniMessage as a placeholder
        return LegacyComponentSerializer.legacySection().deserialize(economy.format(amount));
    }

    @Override
    public String plain(double amount) {
        return PlainTextComponentSerializer.plainText().serialize(format(amount));
    }
}
```

### `VaultHook.java` (consumer-side Hook, no Vault types)

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;
import org.bukkit.plugin.Plugin;

import java.util.UUID;
import java.util.logging.Level;

/**
 * Consumer-side hook for Vault.
 *
 * <p>This class has no Vault types, so it can still be loaded safely when Vault is not installed. {@link #money()} always returns a usable {@link MoneyPort};
 * when Vault is missing or fails it is {@link NoMoney}, so business code needs no checks.
 */
public final class VaultHook {

    public static final String PLUGIN_NAME = "Vault";

    private final Plugin plugin;
    private volatile MoneyPort money = NoMoney.INSTANCE;
    private boolean warned;

    public VaultHook(Plugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Call once in onEnable.
     *
     * @return whether Vault is enabled and hooked (this does not mean an economy provider exists; use {@code money().available()} for that)
     */
    public boolean install() {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
            plugin.getLogger().info(PLUGIN_NAME + " not found; money features are disabled.");
            return false;
        }
        try {
            money = new Guarded(VaultBridge.create(plugin.getServer().getServicesManager()));
            return true;
        } catch (LinkageError e) {
            warnOnce(e);
            return false;
        }
    }

    /** Provider registration: registers your own ledger as a Vault Economy. On disable it is removed by {@code ServicesManager.unregisterAll(plugin)}. */
    public boolean registerProvider(LedgerPort ledger) {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) return false;
        try {
            VaultProviderBridge.register(plugin, ledger);
            return true;
        } catch (LinkageError e) {
            warnOnce(e);
            return false;
        }
    }

    public MoneyPort money() {
        return money;
    }

    public void uninstall() {
        money = NoMoney.INSTANCE;
    }

    private void warnOnce(LinkageError e) {
        if (warned) return;
        warned = true;
        plugin.getLogger().log(Level.WARNING,
            PLUGIN_NAME + " is present but could not be used; money features are disabled.", e);
    }

    /** Each call catches LinkageError on its own: when the third-party jar version mismatches, degrade to "refused" and keep exceptions out of the business flow. */
    private final class Guarded implements MoneyPort {

        private final MoneyPort delegate;

        private Guarded(MoneyPort delegate) {
            this.delegate = delegate;
        }

        @Override
        public boolean available() {
            try {
                return delegate.available();
            } catch (LinkageError e) {
                warnOnce(e);
                return false;
            }
        }

        @Override
        public double balance(UUID player) {
            try {
                return delegate.balance(player);
            } catch (LinkageError e) {
                warnOnce(e);
                return 0.0;
            }
        }

        @Override
        public boolean has(UUID player, double amount) {
            try {
                return delegate.has(player, amount);
            } catch (LinkageError e) {
                warnOnce(e);
                return false;
            }
        }

        @Override
        public boolean withdraw(UUID player, double amount) {
            try {
                return delegate.withdraw(player, amount);
            } catch (LinkageError e) {
                warnOnce(e);
                return false;
            }
        }

        @Override
        public boolean deposit(UUID player, double amount) {
            try {
                return delegate.deposit(player, amount);
            } catch (LinkageError e) {
                warnOnce(e);
                return false;
            }
        }

        @Override
        public Component format(double amount) {
            try {
                return delegate.format(amount);
            } catch (LinkageError e) {
                warnOnce(e);
                return NoMoney.INSTANCE.format(amount);
            }
        }

        @Override
        public String plain(double amount) {
            try {
                return delegate.plain(amount);
            } catch (LinkageError e) {
                warnOnce(e);
                return NoMoney.INSTANCE.plain(amount);
            }
        }
    }
}
```

### `LedgerPort.java` (optional: provider side — your own ledger interface)

```java
package com.example.market.integration;

import java.util.UUID;

/** Public interface of your own ledger (JDK types only). {@code LedgerEconomy} converts it into Vault's Economy. Main thread only. */
public interface LedgerPort {

    String currencyName();

    int decimals();

    boolean hasAccount(UUID player);

    double balance(UUID player);

    /** Returns false on insufficient funds or no account; the balance is unchanged. */
    boolean withdraw(UUID player, double amount);

    boolean deposit(UUID player, double amount);
}
```

### `LedgerEconomy.java` (optional: provider side — implements Vault `Economy`)

```java
package com.example.market.integration;

import net.milkbowl.vault.economy.Economy;
import net.milkbowl.vault.economy.EconomyResponse;
import net.milkbowl.vault.economy.EconomyResponse.ResponseType;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;

import java.util.List;
import java.util.Locale;

/**
 * Wraps a {@link LedgerPort} as Vault's {@link Economy}. Constructed only by {@link VaultProviderBridge}.
 * Banks are not supported; the world parameter is always ignored; the legacy name-based interface only recognizes players the server has seen before.
 */
final class LedgerEconomy implements Economy {

    private static final String NO_BANK = "Banks are not supported";

    private final LedgerPort ledger;
    private final String name;

    LedgerEconomy(LedgerPort ledger, String name) {
        this.ledger = ledger;
        this.name = name;
    }

    private static OfflinePlayer byName(String playerName) {
        return Bukkit.getOfflinePlayerIfCached(playerName);
    }

    private EconomyResponse withdraw(OfflinePlayer player, double amount) {
        double before = player == null ? 0.0 : ledger.balance(player.getUniqueId());
        if (player == null || amount < 0 || !ledger.withdraw(player.getUniqueId(), amount)) {
            return new EconomyResponse(amount, before, ResponseType.FAILURE, "Withdraw refused");
        }
        return new EconomyResponse(amount, ledger.balance(player.getUniqueId()), ResponseType.SUCCESS, null);
    }

    private EconomyResponse deposit(OfflinePlayer player, double amount) {
        double before = player == null ? 0.0 : ledger.balance(player.getUniqueId());
        if (player == null || amount < 0 || !ledger.deposit(player.getUniqueId(), amount)) {
            return new EconomyResponse(amount, before, ResponseType.FAILURE, "Deposit refused");
        }
        return new EconomyResponse(amount, ledger.balance(player.getUniqueId()), ResponseType.SUCCESS, null);
    }

    private static EconomyResponse noBank() {
        return new EconomyResponse(0, 0, ResponseType.NOT_IMPLEMENTED, NO_BANK);
    }

    // ---- Basic info ----

    @Override public boolean isEnabled() { return true; }
    @Override public String getName() { return name; }
    @Override public boolean hasBankSupport() { return false; }
    @Override public int fractionalDigits() { return ledger.decimals(); }
    @Override public String currencyNamePlural() { return ledger.currencyName(); }
    @Override public String currencyNameSingular() { return ledger.currencyName(); }

    /** Plain text is enough; to add color you may use § color codes, and consumers (such as VaultBridge) parse them with the legacy serializer. */
    @Override
    public String format(double amount) {
        return String.format(Locale.ROOT, "%." + ledger.decimals() + "f %s", amount, ledger.currencyName());
    }

    // ---- Accounts ----

    @Override public boolean hasAccount(OfflinePlayer player) { return ledger.hasAccount(player.getUniqueId()); }
    @Override public boolean hasAccount(OfflinePlayer player, String world) { return hasAccount(player); }
    @Override @Deprecated public boolean hasAccount(String playerName) { OfflinePlayer p = byName(playerName); return p != null && hasAccount(p); }
    @Override @Deprecated public boolean hasAccount(String playerName, String world) { return hasAccount(playerName); }
    @Override public boolean createPlayerAccount(OfflinePlayer player) { return false; }
    @Override public boolean createPlayerAccount(OfflinePlayer player, String world) { return false; }
    @Override @Deprecated public boolean createPlayerAccount(String playerName) { return false; }
    @Override @Deprecated public boolean createPlayerAccount(String playerName, String world) { return false; }

    // ---- Balance ----

    @Override public double getBalance(OfflinePlayer player) { return ledger.balance(player.getUniqueId()); }
    @Override public double getBalance(OfflinePlayer player, String world) { return getBalance(player); }
    @Override @Deprecated public double getBalance(String playerName) { OfflinePlayer p = byName(playerName); return p == null ? 0.0 : getBalance(p); }
    @Override @Deprecated public double getBalance(String playerName, String world) { return getBalance(playerName); }
    @Override public boolean has(OfflinePlayer player, double amount) { return getBalance(player) >= amount; }
    @Override public boolean has(OfflinePlayer player, String world, double amount) { return has(player, amount); }
    @Override @Deprecated public boolean has(String playerName, double amount) { return getBalance(playerName) >= amount; }
    @Override @Deprecated public boolean has(String playerName, String world, double amount) { return has(playerName, amount); }

    // ---- Deposits and withdrawals ----

    @Override public EconomyResponse withdrawPlayer(OfflinePlayer player, double amount) { return withdraw(player, amount); }
    @Override public EconomyResponse withdrawPlayer(OfflinePlayer player, String world, double amount) { return withdraw(player, amount); }
    @Override @Deprecated public EconomyResponse withdrawPlayer(String playerName, double amount) { return withdraw(byName(playerName), amount); }
    @Override @Deprecated public EconomyResponse withdrawPlayer(String playerName, String world, double amount) { return withdraw(byName(playerName), amount); }
    @Override public EconomyResponse depositPlayer(OfflinePlayer player, double amount) { return deposit(player, amount); }
    @Override public EconomyResponse depositPlayer(OfflinePlayer player, String world, double amount) { return deposit(player, amount); }
    @Override @Deprecated public EconomyResponse depositPlayer(String playerName, double amount) { return deposit(byName(playerName), amount); }
    @Override @Deprecated public EconomyResponse depositPlayer(String playerName, String world, double amount) { return deposit(byName(playerName), amount); }

    // ---- Banks: not supported ----

    @Override public EconomyResponse createBank(String bank, OfflinePlayer player) { return noBank(); }
    @Override @Deprecated public EconomyResponse createBank(String bank, String player) { return noBank(); }
    @Override public EconomyResponse deleteBank(String bank) { return noBank(); }
    @Override public EconomyResponse bankBalance(String bank) { return noBank(); }
    @Override public EconomyResponse bankHas(String bank, double amount) { return noBank(); }
    @Override public EconomyResponse bankWithdraw(String bank, double amount) { return noBank(); }
    @Override public EconomyResponse bankDeposit(String bank, double amount) { return noBank(); }
    @Override public EconomyResponse isBankOwner(String bank, OfflinePlayer player) { return noBank(); }
    @Override @Deprecated public EconomyResponse isBankOwner(String bank, String player) { return noBank(); }
    @Override public EconomyResponse isBankMember(String bank, OfflinePlayer player) { return noBank(); }
    @Override @Deprecated public EconomyResponse isBankMember(String bank, String player) { return noBank(); }
    @Override public List<String> getBanks() { return List.of(); }
}
```

### `VaultProviderBridge.java` (optional: provider registration)

```java
package com.example.market.integration;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.ServicePriority;

/**
 * Registers your own {@code Economy}. Called by {@link VaultHook#registerProvider} only after Vault is enabled.
 * Use {@code Normal} priority: when several economy plugins coexist, let the admin decide which wins; do not grab {@code Highest} by default.
 */
final class VaultProviderBridge {

    private VaultProviderBridge() {
    }

    static void register(Plugin plugin, LedgerPort ledger) {
        Economy economy = new LedgerEconomy(ledger, plugin.getName());
        plugin.getServer().getServicesManager().register(Economy.class, economy, plugin, ServicePriority.Normal);
    }
}
```

### `PlaceholderSnapshot.java` (immutable snapshot)

```java
package com.example.market.integration;

import java.util.Map;
import java.util.UUID;

/** Immutable snapshot published for PlaceholderAPI to read: never changes after construction and is safe to read from any thread. */
public record PlaceholderSnapshot(Map<UUID, Double> balances) {

    public static final PlaceholderSnapshot EMPTY = new PlaceholderSnapshot(Map.of());

    public PlaceholderSnapshot {
        balances = Map.copyOf(balances); // Defensive copy: later changes to the caller's original Map do not affect the snapshot
    }

    public double balance(UUID player) {
        return balances.getOrDefault(player, 0.0);
    }
}
```

### `SnapshotPublisher.java` (publish on the main thread, read from any thread)

```java
package com.example.market.integration;

/**
 * Publication point with a single writer (main thread) and many readers (any thread).
 * Relies only on swapping a {@code volatile} reference, no lock needed: the snapshot itself is immutable, so replacing the whole reference is enough.
 */
public final class SnapshotPublisher {

    private volatile PlaceholderSnapshot current = PlaceholderSnapshot.EMPTY;

    /** Call on the main thread only (for example from runTaskTimer), because the data source is Bukkit/Vault state. */
    public void publish(PlaceholderSnapshot snapshot) {
        this.current = snapshot;
    }

    /** Readable from any thread. */
    public PlaceholderSnapshot current() {
        return current;
    }
}
```

### `MarketExpansion.java` (PlaceholderAPI expansion, Bridge layer)

```java
package com.example.market.integration;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;

import java.util.List;
import java.util.Locale;

/**
 * {@code %market_balance%} (formatted) and {@code %market_balance_raw%} (plain number).
 *
 * <p><b>PlaceholderAPI may call {@code onRequest} from any thread</b> (chat, scoreboards, async placeholder parsing):
 * calling the Bukkit API or Vault here is forbidden; only read the immutable snapshot from {@link SnapshotPublisher#current()}.
 */
final class MarketExpansion extends PlaceholderExpansion {

    private final SnapshotPublisher publisher;
    private final String version;

    MarketExpansion(SnapshotPublisher publisher, String version) {
        this.publisher = publisher;
        this.version = version;
    }

    @Override
    public String getIdentifier() {
        return "market";
    }

    @Override
    public String getAuthor() {
        return "example";
    }

    @Override
    public String getVersion() {
        return version;
    }

    /** true: the expansion is owned by this plugin, so {@code /papi reload} does not unregister it. */
    @Override
    public boolean persist() {
        return true;
    }

    /** No extra external conditions, so registration is always allowed; if it depends on another plugin, return whether that plugin is enabled here. */
    @Override
    public boolean canRegister() {
        return true;
    }

    /** Returning null means "this placeholder is not recognized", and PlaceholderAPI shows it as-is; a null player (server-level placeholder) also returns null. */
    @Override
    public String onRequest(OfflinePlayer player, String params) {
        if (player == null) {
            return null;
        }
        double balance = publisher.current().balance(player.getUniqueId());
        return switch (params) {
            case "balance" -> String.format(Locale.ROOT, "%,.2f", balance);
            case "balance_raw" -> Double.toString(balance);
            default -> null;
        };
    }

    /** For tab completion in {@code /papi parse} and for {@code /papi info market}. */
    @Override
    public List<String> getPlaceholders() {
        return List.of("%market_balance%", "%market_balance_raw%");
    }
}
```

### `PapiBridge.java`

```java
package com.example.market.integration;

import org.bukkit.plugin.Plugin;

/** The only registration entry point that touches PlaceholderAPI types. It must not be loaded when PlaceholderAPI is not installed; callers check first and catch LinkageError. */
final class PapiBridge {

    private PapiBridge() {
    }

    /** @return a Runnable for unregistering (a JDK type, so the Hook does not need to touch the expansion type) */
    static Runnable register(Plugin plugin, SnapshotPublisher publisher) {
        MarketExpansion expansion = new MarketExpansion(publisher, plugin.getPluginMeta().getVersion());
        if (!expansion.register()) {
            return () -> { };
        }
        return expansion::unregister;
    }
}
```

### `PapiHook.java`

```java
package com.example.market.integration;

import org.bukkit.plugin.Plugin;

import java.util.logging.Level;

/** Hook for PlaceholderAPI: has no PlaceholderAPI types, so it can still be loaded safely when PlaceholderAPI is not installed. */
public final class PapiHook {

    public static final String PLUGIN_NAME = "PlaceholderAPI";

    private final Plugin plugin;
    private final SnapshotPublisher publisher;
    private Runnable unregister = () -> { };

    public PapiHook(Plugin plugin, SnapshotPublisher publisher) {
        this.plugin = plugin;
        this.publisher = publisher;
    }

    /** @return whether the expansion was registered */
    public boolean install() {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
            plugin.getLogger().info(PLUGIN_NAME + " not found; placeholders are disabled.");
            return false;
        }
        try {
            unregister = PapiBridge.register(plugin, publisher);
            return true;
        } catch (LinkageError e) {
            plugin.getLogger().log(Level.WARNING,
                PLUGIN_NAME + " is present but the expansion could not be registered; placeholders are disabled.", e);
            return false;
        }
    }

    /** onDisable: if PlaceholderAPI was disabled first, the expansion has already gone with it, so an unregister failure is logged at FINE only. */
    public void uninstall() {
        Runnable action = unregister;
        unregister = () -> { };
        try {
            action.run();
        } catch (LinkageError | RuntimeException e) {
            plugin.getLogger().log(Level.FINE, "Could not unregister the expansion (PlaceholderAPI may be disabled already)", e);
        }
    }
}
```

### The Listener Trap (Bukkit's `registerEvents`)

`PluginManager.registerEvents(listener, plugin)` calls `getDeclaredMethods()` on the listener class, and the JVM must resolve the signature types of **all** declared methods (including the synthetic `lambda$xxx` methods generated for lambdas). If the parameter, return value, or captured variable of any one method is an uninstalled third-party type (including "your own class that implements a third-party interface"), a `NoClassDefFoundError` is thrown. Bukkit only prints one line to the console,
`Failed to register events for class X because Y does not exist`, and **the whole listener silently stops working**, even for unrelated events.

```text
// Wrong: announce takes a Vault type as a parameter, so when Vault is not installed the whole JoinListener fails to register
public final class JoinListener implements Listener {
    private void announce(Player p, Economy economy) { ... }   // <- third-party type in the signature
}
```

The correct approach: the Listener holds only **your own Port** (this skill's `MoneyPort`), and all third-party types stay in the Bridge.

### `JoinListener.java`

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

/**
 * Member signatures contain only JDK/Paper/own types and no Vault: {@code registerEvents} still succeeds when Vault is not installed.
 * The amount is passed as the Component from {@link MoneyPort#format} placeholder; the {@code Economy.format()} string is never concatenated into MiniMessage.
 */
public final class JoinListener implements Listener {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final MoneyPort money;

    public JoinListener(MoneyPort money) {
        this.money = money;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (!money.available()) return;
        Component amount = money.format(money.balance(event.getPlayer().getUniqueId()));
        event.getPlayer().sendMessage(
            MINI.deserialize("<gray>Balance: <amount></gray>", Placeholder.component("amount", amount)));
    }
}
```

### `MarketPlugin.java` (enable order and cleanup)

```java
package com.example.market;

import com.example.market.integration.JoinListener;
import com.example.market.integration.PapiHook;
import com.example.market.integration.PlaceholderSnapshot;
import com.example.market.integration.SnapshotPublisher;
import com.example.market.integration.VaultHook;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class MarketPlugin extends JavaPlugin {

    private static final long PUBLISH_INTERVAL_TICKS = 100L;

    private VaultHook vault;
    private PapiHook papi;
    private SnapshotPublisher publisher;

    @Override
    public void onEnable() {
        publisher = new SnapshotPublisher();

        // Constructing a Hook loads no third-party classes; install() checks first and only then touches the Bridge
        vault = new VaultHook(this);
        vault.install();
        papi = new PapiHook(this, publisher);
        papi.install();

        // The Listener takes only your own Port, so it registers successfully even when Vault is not installed
        getServer().getPluginManager().registerEvents(new JoinListener(vault.money()), this);

        // Publish a snapshot periodically on the main thread; PlaceholderAPI's arbitrary threads only read the snapshot
        getServer().getScheduler().runTaskTimer(this, this::publishSnapshot, 20L, PUBLISH_INTERVAL_TICKS);
    }

    @Override
    public void onDisable() {
        // Unregister the expansion first, then clear Vault state; any registered Economy is unregistered too
        if (papi != null) papi.uninstall();
        if (vault != null) vault.uninstall();
        getServer().getServicesManager().unregisterAll(this);
    }

    private void publishSnapshot() {
        Map<UUID, Double> balances = new HashMap<>();
        for (Player player : Bukkit.getOnlinePlayers()) {
            balances.put(player.getUniqueId(), vault.money().balance(player.getUniqueId()));
        }
        publisher.publish(new PlaceholderSnapshot(balances));
    }
}
```

### Applying This to packetevents

packetevents is the same Hook + Bridge pattern: the Hook holds an `Object listener` (not the `PacketListenerCommon` type), `install()` first checks `isPluginEnabled("packetevents")`, and the Bridge does `PacketEvents.getAPI().getEventManager().registerListener(...)`. Packet listeners run on the **Netty IO thread**, so likewise they only read an immutable snapshot and call no Bukkit API. See Example 2 in [`examples.md`](examples.md) for the full template.

## Recommended Directory Structure

```
src/main/java/com/example/market/
├── MarketPlugin.java                 ← Assembly: build Hooks, register Listener, cleanup in onDisable
└── integration/
    ├── MoneyPort.java                ← Own interface (business code depends only on this)
    ├── NoMoney.java
    ├── VaultHook.java                ← No third-party types, public
    ├── VaultBridge.java              ← Only consumer-side class touching Vault, package-private
    ├── LedgerPort.java / LedgerEconomy.java / VaultProviderBridge.java   ← Optional: provider side
    ├── PapiHook.java                 ← public
    ├── PapiBridge.java               ← package-private
    ├── MarketExpansion.java          ← Touches PlaceholderAPI, package-private
    ├── PlaceholderSnapshot.java
    ├── SnapshotPublisher.java
    └── JoinListener.java             ← Listener: no third-party types in signatures
src/test/java/com/example/market/
└── SoftDependBoundaryTest.java       ← The test classpath deliberately has no third-party jars
```

Keep the Bridge and Expansion package-private: they cannot be misused from outside the integration package.

## Thread Safety

- Vault `Economy` providers are mostly designed for the main thread and are not guaranteed thread-safe: call all `MoneyPort` methods **on the main thread only**, and state this in the Javadoc
- PlaceholderAPI's `onRequest` / `onPlaceholderRequest` **may run on any thread**: only read `SnapshotPublisher.current()`; calling the Bukkit API or Vault is forbidden
- The snapshot is rebuilt in full by the main thread (`runTaskTimer`) and swapped in through a `volatile` reference; the snapshot object never changes after construction (`Map.copyOf`)
- The packetevents listener runs on the Netty IO thread: likewise only read the immutable snapshot, and modify only a clone of a packet
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| `NoClassDefFoundError: net/milkbowl/vault/economy/Economy` | Vault is not installed, but some loaded class references a Vault type (fields, signatures, and bodies all count) | Only the Bridge touches third-party types; the Bridge is touched only after `isPluginEnabled` is true |
| `Failed to register events for class X because ... does not exist`, and events are never received | A Listener method signature (including lambda-captured variables) contains an uninstalled third-party type | The Listener holds only your own Port; reproduce it with the boundary test |
| Plugin startup order is wrong, Vault is not yet enabled | `softdepend` is not declared, or the name's case does not match | `softdepend: [Vault, PlaceholderAPI, packetevents]`, with names matching the other plugin's `name` exactly |
| `Economy` is null (Vault is installed) | Vault is only a bridge; the economy plugin has not registered yet or has been disabled | Call `getRegistration` again on every operation; use `MoneyPort.available()` to check, and do not cache `Economy` |
| Messages show `§a` or `&6` literally and colors are broken | The `Economy.format()` string was concatenated into MiniMessage | Convert to a Component with `LegacyComponentSerializer.legacySection()`, then use `Placeholder.component` |
| `NoSuchMethodError` / `AbstractMethodError` (third-party API version mismatch) | The version compiled against differs from the version on the server | The Hook catches `LinkageError`, degrades, and warns only once |
| PlaceholderAPI placeholders occasionally race or throw | `onRequest` called the Bukkit API off the main thread | Only read the snapshot; the main thread publishes data periodically |
| Placeholders vanish after `/papi reload` | `persist()` returns false, so the expansion is unregistered as if it were an external jar | `persist()` returns true, and call `unregister()` yourself in `onDisable` |
| `register()` returns false | The same identifier is already registered, or `canRegister()` returns false | Check for a duplicate identifier; implement external conditions in `canRegister()` |
| Exception on disable | The third-party plugin was disabled before this plugin | `uninstall()` catches `LinkageError \| RuntimeException`; logging at FINE is enough |
