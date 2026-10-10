---
name: paper-softdepend-hook
description: "安全使用第三方軟依賴（Vault、PlaceholderAPI、packetevents）：softdepend 宣告、isPluginEnabled 先檢查再建構、Hook + Bridge 分離、避開 Bukkit 監聽器簽名陷阱、接 LinkageError、Vault 消費端／提供端、PlaceholderAPI expansion 快照 / Safe soft dependencies on third-party plugins with Hook + Bridge split and class-load boundary tests"
---

# Paper Softdepend Hook / 第三方軟依賴接點

## 技能名稱 / Skill Name

`paper-softdepend-hook`

## 目的 / Purpose

讓插件在**有裝**第三方插件（Vault、PlaceholderAPI、packetevents…）時多一項功能、**沒裝**時照常啟動。
這是 [`paper-service-api`](../paper-service-api/SKILL.md)（自家插件之間）的第三方版本：差別在於第三方的型別**不在你的 jar 裡**，沒裝時只要 JVM 載入到任何引用它的類別，就會丟 `NoClassDefFoundError`。

解法是三層分離：

1. **Hook**：沒有任何第三方型別（欄位、方法簽名、方法本體都沒有，只呼叫 Bridge 的靜態工廠），任何時候都能安全載入；負責 `isPluginEnabled` 檢查、接 `LinkageError`、警告一次、降級。
2. **Bridge**：**唯一**碰第三方型別的類別，只在檢查通過後才被觸碰。
3. **自家介面（Port）**：Bridge 實作、其餘程式碼依賴的介面，只含 JDK／Paper 型別，讓業務程式碼完全不知道第三方存在。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（兩版相同，沒有版本差異行）
- 純 Paper API；軟依賴以 `compileOnly` 取得：VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents-spigot 2.13.0
- 不需要 Paperweight

## 觸發條件 / Triggers

- 「軟依賴」「softdepend」「soft dependency」「Hook」「Bridge」
- 「Vault」「經濟插件」「Economy provider」「PlaceholderAPI」「expansion」「packetevents」
- 「NoClassDefFoundError」「Failed to register events for class」「監聽器沒註冊」
- 「沒裝某插件也要能啟動」「optional plugin integration」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `dependency` | `Vault` | 第三方插件的 `plugin.yml name`（大小寫要完全一致） |
| `integration_package` | `com.example.market.integration` | Hook／Bridge／Port 所在 package |
| `role` | `consumer` / `provider` / `expansion` / `packet` | 取用（Vault 查餘額）、提供（註冊 Economy）、PAPI 變數、封包監聽 |
| `port_name` | `MoneyPort` | 自家介面名稱（只含 JDK／Paper 型別） |
| `required` | `false` | `false` → `softdepend`；`true` → 改用 `depend`（缺了就不啟動，不需要本技能） |

## 輸出產物 / Outputs

- `plugin.yml` 的 `softdepend` 與 `compileOnly` 依賴
- `MoneyPort.java`、`NoMoney.java` — 自家介面與「沒有依賴」時的空實作
- `VaultHook.java` / `VaultBridge.java` — Vault 消費端（查餘額、扣款、格式化）
- `LedgerPort.java` / `LedgerEconomy.java` / `VaultProviderBridge.java` — 選用：註冊自己的 `Economy` 提供端
- `SnapshotPublisher.java` / `PlaceholderSnapshot.java` / `MarketExpansion.java` / `PapiHook.java` / `PapiBridge.java` — PlaceholderAPI expansion
- `JoinListener.java` — 示範「監聽器不碰軟依賴型別」
- `MarketPlugin.java` — 啟用順序與停用清理
- 邊界測試（`examples.md`）：在沒有依賴的 classpath 反射載入 Hook

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。軟依賴一律 `compileOnly`，**不可打包進 jar**：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly('com.github.MilkBowl:VaultAPI:1.7.1') { exclude group: 'org.bukkit' }
    compileOnly 'me.clip:placeholderapi:2.11.6'
    compileOnly 'com.github.retrooper:packetevents-spigot:2.13.0'
}
```

`plugin.yml`（名稱必須與對方的 `name` 完全一致，包含大小寫；`packetevents` 是小寫）：

```yaml
name: Market
main: com.example.market.MarketPlugin
api-version: '26.2'
softdepend: [Vault, PlaceholderAPI, packetevents]
```

`softdepend` 只保證「對方若存在，會先於本插件啟用」，**不保證存在**，也不保證 Vault 背後的經濟插件已註冊服務。

## 代碼範本 / Code Template

### 核心規則

1. `isPluginEnabled(name)` **先於**任何會載入第三方型別的程式碼（呼叫 Bridge 的靜態方法、`new` Bridge）。
2. Hook 的欄位、方法簽名、lambda 捕獲變數都不得出現第三方型別；它只持有自家 Port。
3. Bridge 以外的類別都不可 `import` 第三方 package。
4. 呼叫 Bridge 的地方一律 `try { … } catch (LinkageError e)`：版本不合或載入失敗時降級並**只警告一次**。
5. 已註冊給 Bukkit 的 `Listener` 類別**不得**在任何成員簽名出現第三方型別（見下方「監聽器陷阱」）。

### `MoneyPort.java`（自家介面，只含 JDK／Paper 型別）

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;

import java.util.UUID;

/**
 * 經濟功能的自家介面：業務程式碼只依賴它，不知道 Vault 存在。
 *
 * <p>規則：所有方法只在主執行緒呼叫（Vault 提供端多半不是執行緒安全）。
 * 失敗語意固定：查詢回 0／false，扣款與入帳回 false。
 */
public interface MoneyPort {

    /** 目前有沒有可用的經濟提供端。 */
    boolean available();

    double balance(UUID player);

    boolean has(UUID player, double amount);

    /** 成功回 true；餘額不足、無提供端都回 false。 */
    boolean withdraw(UUID player, double amount);

    boolean deposit(UUID player, double amount);

    /**
     * 提供端的金額字串轉成 Component。{@code Economy.format()} 常含舊式色碼（§a、&6），
     * <b>不可</b>直接塞進 MiniMessage 字串，否則色碼被當成純文字；請用本方法的 Component 當 placeholder。
     */
    Component format(double amount);

    /** 去掉所有格式的純文字（寫入記錄檔、PlaceholderAPI 的 raw 值）。 */
    String plain(double amount);
}
```

### `NoMoney.java`（沒有依賴時的空實作）

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;

import java.util.Locale;
import java.util.UUID;

/** 沒裝 Vault 或沒有經濟提供端時使用：所有操作都以「拒絕」回應，業務程式碼不必判斷 null。 */
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

### `VaultBridge.java`（唯一碰 Vault 型別的消費端類別）

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
 * 唯一碰 {@code net.milkbowl.vault} 型別的消費端類別。
 * <b>Vault 沒裝時這個類別永遠不能被載入</b>：進來的呼叫都由 {@link VaultHook} 先問過
 * {@code isPluginEnabled} 並接 {@link LinkageError}。
 *
 * <p>每次操作都重新向 ServicesManager 取 {@link Economy}：Vault 只是橋，真正的經濟插件
 * 可能比本插件晚註冊、被 reload 或被停用，快取舊實例會拿到失效的提供端。
 */
final class VaultBridge implements MoneyPort {

    private final ServicesManager services;

    private VaultBridge(ServicesManager services) {
        this.services = services;
    }

    /** 回傳型別刻意是自家介面：呼叫端的方法本體不必為了型別檢查而載入 VaultBridge。 */
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
        // format() 的結果常含 § 色碼：用 legacy serializer 解成 Component，再當 placeholder 傳給 MiniMessage
        return LegacyComponentSerializer.legacySection().deserialize(economy.format(amount));
    }

    @Override
    public String plain(double amount) {
        return PlainTextComponentSerializer.plainText().serialize(format(amount));
    }
}
```

### `VaultHook.java`（消費端 Hook，沒有任何 Vault 型別）

```java
package com.example.market.integration;

import net.kyori.adventure.text.Component;
import org.bukkit.plugin.Plugin;

import java.util.UUID;
import java.util.logging.Level;

/**
 * Vault 的消費端接點。
 *
 * <p>本類別沒有 Vault 型別：沒裝 Vault 時仍可安全載入。{@link #money()} 永遠回傳可用的 {@link MoneyPort}，
 * 沒裝或出錯時是 {@link NoMoney}，業務程式碼不需要判斷。
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
     * 在 onEnable 呼叫一次。
     *
     * @return Vault 是否已啟用並接上（不代表已有經濟提供端，用 {@code money().available()} 判斷）
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

    /** 提供端註冊：把自家帳本註冊成 Vault Economy。停用時由 {@code ServicesManager.unregisterAll(plugin)} 取消。 */
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

    /** 每個呼叫各自接 LinkageError：第三方 jar 版本不合時降級成「拒絕」，不讓例外衝進業務流程。 */
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

### `LedgerPort.java`（選用：提供端——自家帳本介面）

```java
package com.example.market.integration;

import java.util.UUID;

/** 自家帳本的對外介面（只含 JDK 型別）。{@code LedgerEconomy} 把它轉成 Vault 的 Economy。主執行緒限定。 */
public interface LedgerPort {

    String currencyName();

    int decimals();

    boolean hasAccount(UUID player);

    double balance(UUID player);

    /** 餘額不足或無帳號回 false，餘額不變。 */
    boolean withdraw(UUID player, double amount);

    boolean deposit(UUID player, double amount);
}
```

### `LedgerEconomy.java`（選用：提供端——實作 Vault `Economy`）

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
 * 把 {@link LedgerPort} 包成 Vault 的 {@link Economy}。只由 {@link VaultProviderBridge} 建構。
 * 不支援銀行；world 參數一律忽略；以名字為參數的舊介面只認「伺服器曾見過的玩家」。
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

    // ---- 基本資訊 ----

    @Override public boolean isEnabled() { return true; }
    @Override public String getName() { return name; }
    @Override public boolean hasBankSupport() { return false; }
    @Override public int fractionalDigits() { return ledger.decimals(); }
    @Override public String currencyNamePlural() { return ledger.currencyName(); }
    @Override public String currencyNameSingular() { return ledger.currencyName(); }

    /** 回純文字即可；若要上色可用 § 色碼，消費端（如 VaultBridge）會用 legacy serializer 解析。 */
    @Override
    public String format(double amount) {
        return String.format(Locale.ROOT, "%." + ledger.decimals() + "f %s", amount, ledger.currencyName());
    }

    // ---- 帳號 ----

    @Override public boolean hasAccount(OfflinePlayer player) { return ledger.hasAccount(player.getUniqueId()); }
    @Override public boolean hasAccount(OfflinePlayer player, String world) { return hasAccount(player); }
    @Override @Deprecated public boolean hasAccount(String playerName) { OfflinePlayer p = byName(playerName); return p != null && hasAccount(p); }
    @Override @Deprecated public boolean hasAccount(String playerName, String world) { return hasAccount(playerName); }
    @Override public boolean createPlayerAccount(OfflinePlayer player) { return false; }
    @Override public boolean createPlayerAccount(OfflinePlayer player, String world) { return false; }
    @Override @Deprecated public boolean createPlayerAccount(String playerName) { return false; }
    @Override @Deprecated public boolean createPlayerAccount(String playerName, String world) { return false; }

    // ---- 餘額 ----

    @Override public double getBalance(OfflinePlayer player) { return ledger.balance(player.getUniqueId()); }
    @Override public double getBalance(OfflinePlayer player, String world) { return getBalance(player); }
    @Override @Deprecated public double getBalance(String playerName) { OfflinePlayer p = byName(playerName); return p == null ? 0.0 : getBalance(p); }
    @Override @Deprecated public double getBalance(String playerName, String world) { return getBalance(playerName); }
    @Override public boolean has(OfflinePlayer player, double amount) { return getBalance(player) >= amount; }
    @Override public boolean has(OfflinePlayer player, String world, double amount) { return has(player, amount); }
    @Override @Deprecated public boolean has(String playerName, double amount) { return getBalance(playerName) >= amount; }
    @Override @Deprecated public boolean has(String playerName, String world, double amount) { return has(playerName, amount); }

    // ---- 存提 ----

    @Override public EconomyResponse withdrawPlayer(OfflinePlayer player, double amount) { return withdraw(player, amount); }
    @Override public EconomyResponse withdrawPlayer(OfflinePlayer player, String world, double amount) { return withdraw(player, amount); }
    @Override @Deprecated public EconomyResponse withdrawPlayer(String playerName, double amount) { return withdraw(byName(playerName), amount); }
    @Override @Deprecated public EconomyResponse withdrawPlayer(String playerName, String world, double amount) { return withdraw(byName(playerName), amount); }
    @Override public EconomyResponse depositPlayer(OfflinePlayer player, double amount) { return deposit(player, amount); }
    @Override public EconomyResponse depositPlayer(OfflinePlayer player, String world, double amount) { return deposit(player, amount); }
    @Override @Deprecated public EconomyResponse depositPlayer(String playerName, double amount) { return deposit(byName(playerName), amount); }
    @Override @Deprecated public EconomyResponse depositPlayer(String playerName, String world, double amount) { return deposit(byName(playerName), amount); }

    // ---- 銀行：不支援 ----

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

### `VaultProviderBridge.java`（選用：提供端註冊）

```java
package com.example.market.integration;

import net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.ServicePriority;

/**
 * 註冊自己的 {@code Economy}。只在 Vault 已啟用後由 {@link VaultHook#registerProvider} 呼叫。
 * 優先度用 {@code Normal}：同時有多個經濟插件時讓管理員決定誰贏，不要預設搶 {@code Highest}。
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

### `PlaceholderSnapshot.java`（不可變快照）

```java
package com.example.market.integration;

import java.util.Map;
import java.util.UUID;

/** 發佈給 PlaceholderAPI 讀取的不可變快照：建構後永不變動，可被任意執行緒安全讀取。 */
public record PlaceholderSnapshot(Map<UUID, Double> balances) {

    public static final PlaceholderSnapshot EMPTY = new PlaceholderSnapshot(Map.of());

    public PlaceholderSnapshot {
        balances = Map.copyOf(balances); // 防禦性複製：之後呼叫端改原 Map 不影響快照
    }

    public double balance(UUID player) {
        return balances.getOrDefault(player, 0.0);
    }
}
```

### `SnapshotPublisher.java`（主執行緒發佈、任意執行緒讀取）

```java
package com.example.market.integration;

/**
 * 單一寫者（主執行緒）、多讀者（任意執行緒）的發佈點。
 * 只靠 {@code volatile} 引用交換，不需要鎖：快照本身不可變，換掉整個引用即可。
 */
public final class SnapshotPublisher {

    private volatile PlaceholderSnapshot current = PlaceholderSnapshot.EMPTY;

    /** 只在主執行緒呼叫（例如 runTaskTimer），因為資料來源是 Bukkit／Vault 狀態。 */
    public void publish(PlaceholderSnapshot snapshot) {
        this.current = snapshot;
    }

    /** 任意執行緒可讀。 */
    public PlaceholderSnapshot current() {
        return current;
    }
}
```

### `MarketExpansion.java`（PlaceholderAPI expansion，Bridge 層）

```java
package com.example.market.integration;

import me.clip.placeholderapi.expansion.PlaceholderExpansion;
import org.bukkit.OfflinePlayer;

import java.util.List;
import java.util.Locale;

/**
 * {@code %market_balance%}（格式化）與 {@code %market_balance_raw%}（純數字）。
 *
 * <p><b>PlaceholderAPI 可能從任何執行緒呼叫 {@code onRequest}</b>（聊天、計分板、非同步變數解析）：
 * 這裡禁止呼叫 Bukkit API 與 Vault，只讀 {@link SnapshotPublisher#current()} 的不可變快照。
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

    /** true：expansion 由本插件持有，{@code /papi reload} 不會把它註銷。 */
    @Override
    public boolean persist() {
        return true;
    }

    /** 沒有額外的外部條件，註冊一律允許；若依賴另一個插件，在這裡回傳該插件是否已啟用。 */
    @Override
    public boolean canRegister() {
        return true;
    }

    /** 回 null 表示「不認得這個變數」，PlaceholderAPI 會原樣顯示；玩家為 null（伺服器層級變數）也回 null。 */
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

    /** 給 {@code /papi parse} 的 Tab 補全與 {@code /papi info market}。 */
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

/** 唯一碰 PlaceholderAPI 型別的註冊入口。PlaceholderAPI 沒裝時不可被載入；呼叫端先檢查並接 LinkageError。 */
final class PapiBridge {

    private PapiBridge() {
    }

    /** @return 取消註冊用的 Runnable（JDK 型別，Hook 不需要碰 expansion 型別） */
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

/** PlaceholderAPI 的接點：沒有 PlaceholderAPI 型別，沒裝時仍可安全載入。 */
public final class PapiHook {

    public static final String PLUGIN_NAME = "PlaceholderAPI";

    private final Plugin plugin;
    private final SnapshotPublisher publisher;
    private Runnable unregister = () -> { };

    public PapiHook(Plugin plugin, SnapshotPublisher publisher) {
        this.plugin = plugin;
        this.publisher = publisher;
    }

    /** @return 是否已註冊 expansion */
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

    /** onDisable：PlaceholderAPI 若先被停用，expansion 已跟著消失，註銷失敗只記 FINE。 */
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

### 監聽器陷阱（Bukkit 的 `registerEvents`）

`PluginManager.registerEvents(listener, plugin)` 會對 listener 類別呼叫 `getDeclaredMethods()`，JVM 必須解析**所有**宣告方法（含 lambda 合成的 `lambda$xxx` 方法）的簽名型別。只要其中任何一個方法的參數、回傳值或捕獲變數是未安裝的第三方型別（包含「implements 第三方介面的自家類別」），就丟 `NoClassDefFoundError`。Bukkit 只在 console 印一行
`Failed to register events for class X because Y does not exist`，**整個監聽器靜默失效**，連不相關的事件也收不到。

```text
// 錯誤：announce 的參數是 Vault 型別，Vault 沒裝時整個 JoinListener 都註冊失敗
public final class JoinListener implements Listener {
    private void announce(Player p, Economy economy) { ... }   // <- 第三方型別在簽名上
}
```

正確做法：Listener 只持有**自家 Port**（本技能的 `MoneyPort`），第三方型別全留在 Bridge。

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
 * 成員簽名只有 JDK／Paper／自家型別，沒有 Vault：Vault 沒裝時 {@code registerEvents} 仍然成功。
 * 金額用 {@link MoneyPort#format} 的 Component 當 placeholder，不把 {@code Economy.format()} 字串拼進 MiniMessage。
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

### `MarketPlugin.java`（啟用順序與清理）

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

        // 建構 Hook 不會載入任何第三方類別；install() 內才檢查並觸碰 Bridge
        vault = new VaultHook(this);
        vault.install();
        papi = new PapiHook(this, publisher);
        papi.install();

        // Listener 只拿自家 Port，Vault 沒裝時也能成功註冊
        getServer().getPluginManager().registerEvents(new JoinListener(vault.money()), this);

        // 主執行緒定期發佈快照；PlaceholderAPI 的任意執行緒只讀快照
        getServer().getScheduler().runTaskTimer(this, this::publishSnapshot, 20L, PUBLISH_INTERVAL_TICKS);
    }

    @Override
    public void onDisable() {
        // 先註銷 expansion，再清 Vault 狀態；註冊過的 Economy 一併取消
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

### packetevents 的套用

packetevents 同樣是 Hook + Bridge：Hook 持有 `Object listener`（不用 `PacketListenerCommon` 型別），`install()` 先 `isPluginEnabled("packetevents")`，Bridge 負責 `PacketEvents.getAPI().getEventManager().registerListener(...)`。封包監聽器跑在 **Netty IO 執行緒**，同樣只讀不可變快照、不呼叫 Bukkit API。完整範本見 [`examples.md`](examples.md) 範例 2。

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/market/
├── MarketPlugin.java                 ← 組裝：建構 Hook、註冊 Listener、onDisable 清理
└── integration/
    ├── MoneyPort.java                ← 自家介面（業務程式碼只依賴它）
    ├── NoMoney.java
    ├── VaultHook.java                ← 無第三方型別，public
    ├── VaultBridge.java              ← 唯一碰 Vault 的消費端類別，package-private
    ├── LedgerPort.java / LedgerEconomy.java / VaultProviderBridge.java   ← 選用：提供端
    ├── PapiHook.java                 ← public
    ├── PapiBridge.java               ← package-private
    ├── MarketExpansion.java          ← 碰 PlaceholderAPI，package-private
    ├── PlaceholderSnapshot.java
    ├── SnapshotPublisher.java
    └── JoinListener.java             ← Listener：簽名無第三方型別
src/test/java/com/example/market/
└── SoftDependBoundaryTest.java       ← 測試 classpath 刻意沒有第三方 jar
```

Bridge、Expansion 設為 package-private：integration package 以外不可能誤用。

## 執行緒安全注意事項 / Thread Safety

- Vault 的 `Economy` 提供端多半是主執行緒設計且不保證執行緒安全：`MoneyPort` 的所有方法**只在主執行緒呼叫**，Javadoc 寫明
- PlaceholderAPI 的 `onRequest` / `onPlaceholderRequest` **可能在任何執行緒**執行：只讀 `SnapshotPublisher.current()`，禁止呼叫 Bukkit API 或 Vault
- 快照由主執行緒（`runTaskTimer`）整份重建後以 `volatile` 引用交換；快照物件建構後永不變動（`Map.copyOf`）
- packetevents listener 在 Netty IO 執行緒：同樣只讀不可變快照，修改封包只改 clone
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `NoClassDefFoundError: net/milkbowl/vault/economy/Economy` | Vault 沒裝，但某個被載入的類別引用了 Vault 型別（欄位、簽名、本體都算） | 只有 Bridge 碰第三方型別；Bridge 在 `isPluginEnabled` 為真後才被觸碰 |
| `Failed to register events for class X because ... does not exist`，事件完全收不到 | Listener 的某個方法簽名（含 lambda 捕獲變數）出現未安裝的第三方型別 | Listener 只持有自家 Port；用邊界測試重現 |
| 插件啟動順序錯，Vault 還沒啟用 | 沒宣告 `softdepend`，或名稱大小寫不符 | `softdepend: [Vault, PlaceholderAPI, packetevents]`，名稱與對方 `name` 完全一致 |
| `Economy` 為 null（Vault 已裝） | Vault 只是橋，經濟插件尚未註冊或已停用 | 每次操作重新 `getRegistration`；用 `MoneyPort.available()` 判斷，不快取 `Economy` |
| 訊息出現 `§a` 或 `&6` 字樣、顏色壞掉 | 把 `Economy.format()` 字串拼進 MiniMessage | 用 `LegacyComponentSerializer.legacySection()` 轉 Component，再用 `Placeholder.component` |
| `NoSuchMethodError` / `AbstractMethodError`（第三方 API 版本不合） | 編譯用的版本與伺服器上實際版本不同 | Hook 接 `LinkageError`，降級並只警告一次 |
| PlaceholderAPI 變數偶爾出現競態或丟例外 | `onRequest` 在非主執行緒呼叫了 Bukkit API | 只讀快照；資料由主執行緒定期發佈 |
| `/papi reload` 後變數消失 | `persist()` 回 false，expansion 被當成外部 jar 註銷 | `persist()` 回 true，並在 `onDisable` 自行 `unregister()` |
| `register()` 回 false | 同 identifier 已被註冊，或 `canRegister()` 回 false | 檢查 identifier 是否重複；在 `canRegister()` 實作外部條件 |
| 停用時丟例外 | 第三方插件已先於本插件停用 | `uninstall()` 接 `LinkageError \| RuntimeException`，記 FINE 即可 |
