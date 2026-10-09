---
name: paper-economy-ledger
description: "插件內建經濟核心：long 最小單位金額（不用 double）、多幣種、純 Ledger（OK/INSUFFICIENT/NO_ACCOUNT/INVALID_AMOUNT）、只增不改交易紀錄、k/m/b 簡寫解析與格式化、託管（escrow）例外安全、write-behind 持久化、內部 API 與選用 Vault Economy 提供端 / In-plugin economy core with long minor units, multi-currency pure Ledger, append-only transaction log, k/m/b parsing, exception-safe escrow, write-behind persistence, internal API and optional Vault provider"
---

# Paper Economy Ledger / 插件內建經濟帳本

## 技能名稱 / Skill Name

`paper-economy-ledger`

## 目的 / Purpose

提供一個可以直接放進插件的經濟核心，重點是「錢不能算錯、不能憑空消失」：

1. **金額一律是 `long` 最小單位**（`decimals = 2` → 1 元 = 100）。`double` 只出現在 Vault 邊界，進出都經 `BigDecimal` 四捨五入到最小單位。
2. **純 `Ledger`**：沒有任何 Bukkit 型別，存款／提款／轉帳回傳明確結果 `OK / INSUFFICIENT / NO_ACCOUNT / INVALID_AMOUNT`，不丟例外、不改一半；加法用 `Math.addExact` 防溢位。
3. **只增不改的交易紀錄**：每次異動產生 `Transaction`（誰、變動量、異動後餘額、備註、時間），同一批原子地寫入持久層。
4. **簡寫與格式化**：`1.2k / 3m / 4b` 解析（拒絕負數、`NaN`、科學記號、過多小數、超過上限）與顯示。
5. **託管（escrow）**：先保留買方的錢，交貨成功才付給賣方；交貨丟例外時在 `finally` 退款，絕不讓錢或物品消失。
6. **write-behind 持久化**：記憶體是權威，單執行緒佇列依序落地（實作見 [`paper-sqlite-repository`](../paper-sqlite-repository/SKILL.md)）。
7. **對外**：先暴露內部 API（見 [`paper-service-api`](../paper-service-api/SKILL.md)），再選用註冊 Vault `Economy` 提供端（隔離規則見 [`paper-softdepend-hook`](../paper-softdepend-hook/SKILL.md)）。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（只用 Bukkit API 與 Vault 1.7.1，兩版程式碼相同，沒有版本差異行）
- 純 Paper API，不需要 Paperweight；`Ledger`、`Escrow`、格式化與解析完全不依賴 Bukkit，可直接用 JUnit 測試

## 觸發條件 / Triggers

- 「經濟」「economy」「帳本」「ledger」「餘額」「balance」「轉帳」「pay」
- 「貨幣」「multi-currency」「小數」「minor units」「k m b」「1.5k」「簡寫金額」
- 「託管」「escrow」「退款」「refund」「訂單」「交易紀錄」「transaction log」
- 「Vault Economy 提供端」「register Economy」「ServicePriority.Highest」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.economy` | 根 package；API 放 `<base>.api`（不可 relocate） |
| `currencies` | `coins`（2 位小數）、`gems`（0 位） | 每種幣的 `id`、符號、小數位數、顯示 pattern、起始餘額 |
| `vault_currency` | `coins` | 暴露給 Vault 的那一種幣（Vault 只有單一幣種） |
| `persistence` | `sqlite` | 持久層；範本附記憶體版 `InMemoryLedgerStore` 供測試 |
| `expose_vault` | `true` | 是否註冊 Vault 提供端 |

## 輸出產物 / Outputs

- `EconomyResult.java`、`EconomyApi.java` — 對外 API（只含 JDK 型別）
- `Currency.java`、`Money.java`、`MoneyFormat.java`、`AmountParser.java` — 幣種、最小單位換算、顯示、解析
- `Transaction.java`、`Ledger.java` — 純帳本與交易紀錄
- `Escrow.java` — 例外安全的託管
- `LedgerStore.java`、`InMemoryLedgerStore.java`、`WriteBehindQueue.java` — 持久層介面與 write-behind 佇列
- `EconomyApiImpl.java` — 主執行緒限定的 API 實作
- `VaultEconomyProvider.java`、`VaultHook.java` — 選用的 Vault 提供端與註冊入口
- `EconomyPlugin.java` — 組裝、註冊、停用時排空佇列

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。Vault 為 `compileOnly`，不可打包；測試另加 JUnit：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11：'1.21.11-R0.1-SNAPSHOT'
    compileOnly('com.github.MilkBowl:VaultAPI:1.7.1') { exclude group: 'org.bukkit' }

    testImplementation platform('org.junit:junit-bom:5.12.2')
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.withType(Test).configureEach { useJUnitPlatform() }
```

`plugin.yml`：

```yaml
name: Economy
main: com.example.economy.EconomyPlugin
api-version: '26.2'
softdepend: [Vault]
```

`config.yml`（幣種定義；`decimals` 0 到 2，`pattern` 只管千分位，小數位數由 `decimals` 決定；`starting-balance` 請加引號以字串解析）：

```yaml
vault-currency: coins
currencies:
  coins:
    symbol: "$"
    decimals: 2
    pattern: "#,##0"
    starting-balance: "100.00"
  gems:
    symbol: "G"
    decimals: 0
    pattern: "#,##0"
    starting-balance: "0"
```

## 代碼範本 / Code Template

### 核心規則

1. **金額是 `long` 最小單位**，上限 `Money.MAX`（9×10^15，小於 2^53，`double` 到此仍能精確表示整數）。不要在帳本內出現 `double`。
2. **`Ledger` 不碰 Bukkit**；執行緒由外層（`EconomyApiImpl`）檢查，`Ledger` 本身假設單執行緒使用。
3. **先驗證、後異動、再記錄**：所有檢查（帳號、金額、餘額、溢位）通過後才改餘額；回傳非 `OK` 時餘額一定沒變。
4. **記憶體為權威，落地是 write-behind**：寫入失敗只記錄，不回滾記憶體；每筆交易帶「異動後餘額」，下一筆成功就自癒，`onDisable` 同步排空。
5. **託管用 `finally` 退款**：任何走出 `trade` 的路徑，保留的錢要嘛已付給賣方，要嘛已退回買方。
6. Vault 的 `double` 一律經 `Money.toMinor` 四捨五入到最小單位；`Economy.format()` 的回傳值**不是** MiniMessage（見 `VaultEconomyProvider` 的說明）。

### `EconomyResult.java`（api package）

```java
package com.example.economy.api;

/** 帳本操作結果。只加不改：新值只能加在最後。非 OK 時餘額一定沒有變動。 */
public enum EconomyResult {
    OK,
    INSUFFICIENT,
    NO_ACCOUNT,
    /** 金額 ≤ 0、超過上限、加總溢位，或轉帳給自己。 */
    INVALID_AMOUNT
}
```

### `EconomyApi.java`（api package，只含 JDK 型別）

```java
package com.example.economy.api;

import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * 給其他插件使用的經濟 API（透過 ServicesManager 取得，見 paper-service-api）。
 *
 * <p>規則：金額是 long 最小單位；所有方法只能在主執行緒呼叫，否則丟 {@link IllegalStateException}；
 * 未知的幣種 id 丟 {@link IllegalArgumentException}（呼叫端的程式錯誤，不是遊戲狀況）。
 * 只加不改：新增方法放在最後。
 */
public interface EconomyApi {

    boolean hasAccount(UUID account);

    /** 開戶並發放各幣種起始餘額；已存在回 false。 */
    boolean openAccount(UUID account);

    /** 無帳號 → empty。 */
    OptionalLong balance(UUID account, String currency);

    /** 入帳；amount ≤ 0 → INVALID_AMOUNT。note 是呼叫端自報來源，存入交易紀錄。 */
    EconomyResult deposit(UUID account, String currency, long amount, String note);

    /** 扣款；餘額不足 → INSUFFICIENT，餘額不變。 */
    EconomyResult withdraw(UUID account, String currency, long amount, String note);

    EconomyResult transfer(UUID from, UUID to, String currency, long amount, String note);

    /** 純文字（無任何色碼）的完整金額，例如 {@code $ 1,234.50}。 */
    String format(String currency, long minor);

    /** 純文字的簡寫金額，例如 {@code $ 1.2k}。 */
    String formatShort(String currency, long minor);

    /** 解析玩家輸入（支援 k／m／b）；格式不合 → empty。 */
    OptionalLong parse(String currency, String text);

    List<String> currencies();
}
```

### `Currency.java`

```java
package com.example.economy.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 幣種定義。金額一律是最小單位：decimals = 2 → 1.00 = 100。
 *
 * @param pattern {@link java.text.DecimalFormat} 樣式，只用來決定千分位；小數位數由 decimals 強制
 * @param startingBalance 最小單位
 */
public record Currency(String id, String symbol, int decimals, String pattern, long startingBalance) {

    public static final int MAX_DECIMALS = 2;
    private static final Pattern ID = Pattern.compile("[a-z0-9_]{1,16}");

    public Currency {
        if (!ID.matcher(id).matches()) {
            throw new IllegalArgumentException("Invalid currency id: " + id);
        }
        if (symbol.isBlank()) {
            throw new IllegalArgumentException("Currency " + id + " needs a symbol");
        }
        if (decimals < 0 || decimals > MAX_DECIMALS) {
            throw new IllegalArgumentException("decimals must be 0.." + MAX_DECIMALS + ": " + decimals);
        }
        Objects.requireNonNull(pattern, "pattern");
        if (startingBalance < 0 || startingBalance > Money.MAX) {
            throw new IllegalArgumentException("Invalid starting balance for " + id + ": " + startingBalance);
        }
    }

    /** 10^decimals：最小單位換主單位的除數。 */
    public long scale() {
        long scale = 1L;
        for (int i = 0; i < decimals; i++) {
            scale *= 10L;
        }
        return scale;
    }
}
```

### `Money.java`

```java
package com.example.economy.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.OptionalLong;

/** 最小單位的上限與 double 邊界換算（只給 Vault 之類 double API 用）。 */
public final class Money {

    /** 最小單位上限：小於 2^53，double 到這裡仍能精確表示整數。 */
    public static final long MAX = 9_000_000_000_000_000L;
    private static final BigDecimal MAX_DECIMAL = BigDecimal.valueOf(MAX);

    private Money() {
    }

    /**
     * Vault 的 double（主單位）→ 最小單位，<b>四捨五入</b>到 decimals 位：
     * {@code 0.1 + 0.2 = 0.30000000000000004} 會變成 0.30。
     * 負數、NaN／無限大、超過 {@link #MAX} → empty。走 BigDecimal，不做浮點乘法。
     */
    public static OptionalLong toMinor(double major, int decimals) {
        if (!Double.isFinite(major) || major < 0) {
            return OptionalLong.empty();
        }
        BigDecimal minor = BigDecimal.valueOf(major).setScale(decimals, RoundingMode.HALF_UP).movePointRight(decimals);
        if (minor.compareTo(MAX_DECIMAL) > 0) {
            return OptionalLong.empty();
        }
        return OptionalLong.of(minor.longValueExact());
    }

    /** 最小單位 → double 主單位（只在回傳給 Vault 時使用；上限內不會失真）。 */
    public static double toMajor(long minor, int decimals) {
        return BigDecimal.valueOf(minor, decimals).doubleValue();
    }

    /** 溢位安全的加法：超過 long 或 {@link #MAX} → empty。 */
    public static OptionalLong checkedAdd(long a, long b) {
        try {
            long sum = Math.addExact(a, b);
            return sum > MAX ? OptionalLong.empty() : OptionalLong.of(sum);
        } catch (ArithmeticException e) {
            return OptionalLong.empty();
        }
    }
}
```

### `MoneyFormat.java`

```java
package com.example.economy.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;

/**
 * 金額顯示，輸入一律最小單位，輸出一律純文字（不含任何色碼）。固定 {@link Locale#ROOT}，避免伺服器語系改變小數點。
 * 簡寫用整數運算、一位小數「無條件捨去」並去尾零：1_999 → 1.9k（不是 2k），避免顯示的錢比實際多。
 */
public final class MoneyFormat {

    private static final long THOUSAND = 1_000L;
    private static final long MILLION = 1_000_000L;
    private static final long BILLION = 1_000_000_000L;

    private MoneyFormat() {
    }

    /** 千分位 + 固定小數位：{@code 1,234.50}。 */
    public static String number(long minor, Currency currency) {
        DecimalFormat format = new DecimalFormat(currency.pattern(), DecimalFormatSymbols.getInstance(Locale.ROOT));
        format.setRoundingMode(RoundingMode.UNNECESSARY);
        format.setMinimumFractionDigits(currency.decimals());
        format.setMaximumFractionDigits(currency.decimals());
        return format.format(BigDecimal.valueOf(minor, currency.decimals()));
    }

    /** 符號 + 數字：{@code $ 1,234.50}。 */
    public static String full(long minor, Currency currency) {
        return currency.symbol() + " " + number(minor, currency);
    }

    /** 主單位 ≥ 1,000 時縮成 k／m／b；其餘同 {@link #number}。 */
    public static String shortNumber(long minor, Currency currency) {
        long major = minor / currency.scale();
        if (major < THOUSAND) {
            return number(minor, currency);
        }
        long unit = THOUSAND;
        String suffix = "k";
        if (major >= BILLION) {
            unit = BILLION;
            suffix = "b";
        } else if (major >= MILLION) {
            unit = MILLION;
            suffix = "m";
        }
        long tenths = major * 10 / unit; // major ≤ 9e15 → ×10 不溢位
        long whole = tenths / 10;
        long fraction = tenths % 10;
        return (fraction == 0 ? Long.toString(whole) : whole + "." + fraction) + suffix;
    }

    public static String shortFull(long minor, Currency currency) {
        return currency.symbol() + " " + shortNumber(minor, currency);
    }
}
```

### `AmountParser.java`

```java
package com.example.economy.domain;

import java.math.BigDecimal;
import java.util.OptionalLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 玩家輸入 → 最小單位。只收 {@code 整數[.小數][k|m|b]}（不分大小寫）：
 * 拒絕負號、{@code NaN}、{@code Infinity}、科學記號、千分位逗號、前後多餘字元、
 * 比幣種更細的小數（{@code 1.234} 在 2 位幣種；{@code 1.234567k} 乘上單位後仍多於 2 位）、超過 {@link Money#MAX}。
 * 全程 BigDecimal，不經過 double。
 */
public final class AmountParser {

    private static final int MAX_LENGTH = 32;
    private static final Pattern AMOUNT = Pattern.compile("(\\d{1,16})(?:\\.(\\d{1,12}))?([kKmMbB])?");
    private static final BigDecimal MAX_DECIMAL = BigDecimal.valueOf(Money.MAX);

    private AmountParser() {
    }

    public static OptionalLong parse(String text, int decimals) {
        if (text == null || text.length() > MAX_LENGTH) {
            return OptionalLong.empty();
        }
        Matcher matcher = AMOUNT.matcher(text.trim());
        if (!matcher.matches()) {
            return OptionalLong.empty();
        }
        String fraction = matcher.group(2);
        int shift = decimals + exponent(matcher.group(3));
        if (fraction != null && fraction.length() > shift) {
            return OptionalLong.empty();
        }
        BigDecimal value = new BigDecimal(matcher.group(1) + (fraction == null ? "" : "." + fraction));
        BigDecimal minor = value.movePointRight(shift);
        if (minor.compareTo(MAX_DECIMAL) > 0) {
            return OptionalLong.empty();
        }
        return OptionalLong.of(minor.longValueExact());
    }

    private static int exponent(String suffix) {
        if (suffix == null) {
            return 0;
        }
        return switch (suffix.charAt(0)) {
            case 'k', 'K' -> 3;
            case 'm', 'M' -> 6;
            default -> 9;
        };
    }
}
```

### `Transaction.java`

```java
package com.example.economy.domain;

import java.util.Objects;
import java.util.UUID;

/**
 * 一筆只增不改的交易紀錄（帳本異動的唯一憑證）。
 *
 * @param at 毫秒時間戳
 * @param delta 帶號變動量（最小單位）：入帳為正、扣款為負
 * @param balanceAfter 異動後餘額；持久層用它 upsert 餘額，所以單筆寫入失敗不會讓之後的餘額錯亂
 * @param note 來源說明，例如 {@code pay}、{@code shop:buy}、{@code vault}
 */
public record Transaction(long at, UUID account, String currency, long delta, long balanceAfter, String note) {

    public Transaction {
        Objects.requireNonNull(account, "account");
        if (currency.isBlank()) {
            throw new IllegalArgumentException("currency must not be blank");
        }
        if (delta == 0) {
            throw new IllegalArgumentException("delta must not be zero");
        }
        if (balanceAfter < 0) {
            throw new IllegalArgumentException("balanceAfter must not be negative: " + balanceAfter);
        }
        note = note == null ? "" : note;
    }
}
```

### `Ledger.java`

```java
package com.example.economy.domain;

import com.example.economy.api.EconomyResult;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

/**
 * 純帳本：沒有 Bukkit 型別，所以能直接用 JUnit 測。<b>非執行緒安全</b>，呼叫端（EconomyApiImpl）負責限定主執行緒。
 *
 * <p>每個操作：驗證 → 改餘額 → 把這次的 {@link Transaction} 批次交給 sink（write-behind 佇列）。
 * 任何非 OK 的結果都保證沒有改任何餘額，也不會呼叫 sink。
 */
public final class Ledger {

    private final Map<String, Currency> currencies;
    private final Map<UUID, Map<String, Long>> accounts = new HashMap<>();
    private final LongSupplier clock;
    private final Consumer<List<Transaction>> sink;

    public Ledger(Collection<Currency> currencies, LongSupplier clock, Consumer<List<Transaction>> sink) {
        Map<String, Currency> byId = new LinkedHashMap<>();
        for (Currency currency : currencies) {
            if (byId.put(currency.id(), currency) != null) {
                throw new IllegalArgumentException("Duplicate currency id: " + currency.id());
            }
        }
        this.currencies = Map.copyOf(byId);
        this.clock = clock;
        this.sink = sink;
    }

    public Collection<Currency> currencies() {
        return currencies.values();
    }

    public Optional<Currency> currency(String id) {
        return Optional.ofNullable(currencies.get(id));
    }

    /** 啟動時從持久層還原餘額（不產生交易）。幣種已不在設定中或數值不合法 → 回 false 並略過。 */
    public boolean restore(UUID account, String currencyId, long balance) {
        if (!currencies.containsKey(currencyId) || balance < 0 || balance > Money.MAX) {
            return false;
        }
        accounts.computeIfAbsent(account, k -> new HashMap<>()).put(currencyId, balance);
        return true;
    }

    public boolean hasAccount(UUID account) {
        return accounts.containsKey(account);
    }

    /** 開戶並依各幣種的起始餘額產生交易；已存在回 false。 */
    public boolean open(UUID account) {
        if (accounts.containsKey(account)) {
            return false;
        }
        Map<String, Long> wallet = new HashMap<>();
        List<Transaction> batch = new ArrayList<>();
        long now = clock.getAsLong();
        for (Currency currency : currencies.values()) {
            wallet.put(currency.id(), currency.startingBalance());
            if (currency.startingBalance() > 0) {
                batch.add(new Transaction(now, account, currency.id(), currency.startingBalance(),
                    currency.startingBalance(), "starting"));
            }
        }
        accounts.put(account, wallet);
        if (!batch.isEmpty()) {
            sink.accept(List.copyOf(batch));
        }
        return true;
    }

    /** 無帳號 → empty。未知幣種丟 IllegalArgumentException。 */
    public OptionalLong balance(UUID account, String currencyId) {
        requireCurrency(currencyId);
        Map<String, Long> wallet = accounts.get(account);
        return wallet == null ? OptionalLong.empty() : OptionalLong.of(wallet.getOrDefault(currencyId, 0L));
    }

    public EconomyResult deposit(UUID account, String currencyId, long amount, String note) {
        requireCurrency(currencyId);
        if (!validAmount(amount)) {
            return EconomyResult.INVALID_AMOUNT;
        }
        Map<String, Long> wallet = accounts.get(account);
        if (wallet == null) {
            return EconomyResult.NO_ACCOUNT;
        }
        OptionalLong next = Money.checkedAdd(wallet.getOrDefault(currencyId, 0L), amount);
        if (next.isEmpty()) {
            return EconomyResult.INVALID_AMOUNT;
        }
        wallet.put(currencyId, next.getAsLong());
        sink.accept(List.of(new Transaction(clock.getAsLong(), account, currencyId, amount, next.getAsLong(), note)));
        return EconomyResult.OK;
    }

    public EconomyResult withdraw(UUID account, String currencyId, long amount, String note) {
        requireCurrency(currencyId);
        if (!validAmount(amount)) {
            return EconomyResult.INVALID_AMOUNT;
        }
        Map<String, Long> wallet = accounts.get(account);
        if (wallet == null) {
            return EconomyResult.NO_ACCOUNT;
        }
        long current = wallet.getOrDefault(currencyId, 0L);
        if (current < amount) {
            return EconomyResult.INSUFFICIENT;
        }
        wallet.put(currencyId, current - amount);
        sink.accept(List.of(new Transaction(clock.getAsLong(), account, currencyId, -amount, current - amount, note)));
        return EconomyResult.OK;
    }

    /** 轉帳：兩筆交易同一批交給 sink（持久層放進同一個 SQL transaction）。轉給自己 → INVALID_AMOUNT。 */
    public EconomyResult transfer(UUID from, UUID to, String currencyId, long amount, String note) {
        requireCurrency(currencyId);
        if (!validAmount(amount) || from.equals(to)) {
            return EconomyResult.INVALID_AMOUNT;
        }
        Map<String, Long> source = accounts.get(from);
        Map<String, Long> target = accounts.get(to);
        if (source == null || target == null) {
            return EconomyResult.NO_ACCOUNT;
        }
        long sourceBalance = source.getOrDefault(currencyId, 0L);
        if (sourceBalance < amount) {
            return EconomyResult.INSUFFICIENT;
        }
        OptionalLong targetNext = Money.checkedAdd(target.getOrDefault(currencyId, 0L), amount);
        if (targetNext.isEmpty()) {
            return EconomyResult.INVALID_AMOUNT; // 收款方會溢位：兩邊都不動
        }
        source.put(currencyId, sourceBalance - amount);
        target.put(currencyId, targetNext.getAsLong());
        long now = clock.getAsLong();
        sink.accept(List.of(
            new Transaction(now, from, currencyId, -amount, sourceBalance - amount, note),
            new Transaction(now, to, currencyId, amount, targetNext.getAsLong(), note)));
        return EconomyResult.OK;
    }

    private static boolean validAmount(long amount) {
        return amount > 0 && amount <= Money.MAX;
    }

    private void requireCurrency(String id) {
        if (!currencies.containsKey(id)) {
            throw new IllegalArgumentException("Unknown currency: " + id);
        }
    }
}
```

### `Escrow.java`

```java
package com.example.economy.domain;

import com.example.economy.api.EconomyResult;

import java.util.UUID;

/**
 * 託管：先把買方的錢「保留」（從餘額扣掉），交貨成功才付給賣方，否則退回。
 *
 * <p>不變量：{@link #trade} 回傳或丟例外時，保留的錢不是已付給賣方，就是已退回買方，不會懸空。
 * 交貨（{@link Delivery}）若丟例外，{@code finally} 先退款再讓例外繼續往外丟；物品的還原由 Delivery 自己負責
 * （見 examples.md：先還物品、再重拋）。<b>非執行緒安全</b>，與 {@link Ledger} 在同一執行緒使用。
 */
public final class Escrow {

    /** 交貨動作：成功交付回 true；無法交付（缺貨、對方背包滿）回 false（會退款）；丟例外也會退款。 */
    @FunctionalInterface
    public interface Delivery {
        boolean deliver();
    }

    public enum Outcome {
        /** 已交貨、錢已付給賣方。 */
        SETTLED,
        /** 買方餘額不足、無帳號或金額無效；沒有保留任何錢（原因見 {@code funds}）。 */
        NOT_RESERVED,
        /** 交貨回 false：已全額退款。 */
        DECLINED,
        /** 已交貨但賣方無法收款（例如餘額溢位）：已全額退款，呼叫端必須還原已交出的物品。 */
        SETTLEMENT_FAILED
    }

    public record TradeResult(Outcome outcome, EconomyResult funds) {
    }

    /** 一筆保留中的款項。settle 與 refund 只有一個會成功，之後即失效。 */
    public static final class Hold {

        private final Ledger ledger;
        private final UUID payer;
        private final String currency;
        private final long amount;
        private final String note;
        private final EconomyResult reserved;
        private boolean open;

        private Hold(Ledger ledger, UUID payer, String currency, long amount, String note) {
            this.ledger = ledger;
            this.payer = payer;
            this.currency = currency;
            this.amount = amount;
            this.note = note;
            this.reserved = ledger.withdraw(payer, currency, amount, note + ":reserve");
            this.open = reserved == EconomyResult.OK;
        }

        /** 保留的結果；非 OK 代表沒有扣任何錢，Hold 一開始就是關閉的。 */
        public EconomyResult reserved() {
            return reserved;
        }

        public boolean isOpen() {
            return open;
        }

        /** 付給收款方。失敗（非 OK）時保留仍在，呼叫端應接著 {@link #refund()}。 */
        public EconomyResult settle(UUID payee) {
            if (!open) {
                throw new IllegalStateException("Escrow hold is not open");
            }
            EconomyResult result = ledger.deposit(payee, currency, amount, note + ":settle");
            if (result == EconomyResult.OK) {
                open = false;
            }
            return result;
        }

        /** 退回付款方；已結清、已退款或從未保留成功則什麼都不做。 */
        public void refund() {
            if (!open) {
                return;
            }
            EconomyResult result = ledger.deposit(payer, currency, amount, note + ":refund");
            if (result != EconomyResult.OK) {
                // 理論上不會發生（剛扣掉的錢加回去不會溢位）；若發生必須讓管理員對得回帳
                throw new IllegalStateException("Escrow refund failed (" + result + "): payer=" + payer
                    + " currency=" + currency + " amount=" + amount + " note=" + note);
            }
            open = false;
        }
    }

    private final Ledger ledger;

    public Escrow(Ledger ledger) {
        this.ledger = ledger;
    }

    /** 保留款項。自訂流程時，拿到 Hold 後必須把 settle／refund 放進 try／finally。 */
    public Hold reserve(UUID payer, String currency, long amount, String note) {
        return new Hold(ledger, payer, currency, amount, note);
    }

    /** 保留 → 交貨 → 結清或退款；任何路徑離開都不會讓錢懸空。 */
    public TradeResult trade(UUID buyer, UUID seller, String currency, long price, String note, Delivery delivery) {
        Hold hold = reserve(buyer, currency, price, note);
        if (!hold.isOpen()) {
            return new TradeResult(Outcome.NOT_RESERVED, hold.reserved());
        }
        RuntimeException failure = null;
        try {
            if (!delivery.deliver()) {
                return new TradeResult(Outcome.DECLINED, EconomyResult.OK);
            }
            EconomyResult paid = hold.settle(seller);
            return paid == EconomyResult.OK
                ? new TradeResult(Outcome.SETTLED, EconomyResult.OK)
                : new TradeResult(Outcome.SETTLEMENT_FAILED, paid);
        } catch (RuntimeException e) {
            failure = e;
            throw e;
        } finally {
            refundIfOpen(hold, failure);
        }
    }

    private static void refundIfOpen(Hold hold, RuntimeException failure) {
        if (!hold.isOpen()) {
            return;
        }
        try {
            hold.refund();
        } catch (RuntimeException refundFailure) {
            if (failure == null) {
                throw refundFailure;
            }
            failure.addSuppressed(refundFailure);
        }
    }
}
```

### `LedgerStore.java`

```java
package com.example.economy.storage;

import com.example.economy.domain.Transaction;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 持久層介面。SQLite 實作見 paper-sqlite-repository：{@code apply} 在同一個 SQL transaction 內
 * INSERT 交易紀錄並用 {@code balanceAfter} UPSERT 餘額（{@code INSERT ... ON CONFLICT DO UPDATE}）。
 */
public interface LedgerStore {

    /** 啟動時呼叫一次（可阻塞）：account → (currency → 最小單位餘額)。 */
    Map<UUID, Map<String, Long>> loadBalances();

    /** 寫入一批交易並更新餘額。只在 {@link WriteBehindQueue} 的寫入執行緒呼叫，可阻塞。 */
    void apply(List<Transaction> batch);
}
```

### `InMemoryLedgerStore.java`

```java
package com.example.economy.storage;

import com.example.economy.domain.Transaction;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** 記憶體版持久層：給 JUnit 與沒有資料庫時的開發用。方法同步化（寫入執行緒與測試執行緒共用）。 */
public final class InMemoryLedgerStore implements LedgerStore {

    private final Map<UUID, Map<String, Long>> balances = new HashMap<>();
    private final List<Transaction> log = new ArrayList<>();

    @Override
    public synchronized Map<UUID, Map<String, Long>> loadBalances() {
        Map<UUID, Map<String, Long>> copy = new HashMap<>();
        balances.forEach((account, wallet) -> copy.put(account, new HashMap<>(wallet)));
        return copy;
    }

    @Override
    public synchronized void apply(List<Transaction> batch) {
        for (Transaction tx : batch) {
            log.add(tx);
            balances.computeIfAbsent(tx.account(), k -> new HashMap<>()).put(tx.currency(), tx.balanceAfter());
        }
    }

    /** 只增不改的紀錄副本（測試用）。 */
    public synchronized List<Transaction> log() {
        return List.copyOf(log);
    }
}
```

### `WriteBehindQueue.java`

```java
package com.example.economy.storage;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * 單執行緒寫入佇列：寫入照送出順序落地（不用 Bukkit 的 async 池——池會讓兩筆寫入亂序）。
 * 失敗只記錄，不回滾記憶體：每筆交易帶絕對餘額，下一筆成功就自癒；{@link #close} 在 onDisable 同步排空。
 */
public final class WriteBehindQueue {

    private final ExecutorService worker;
    private final Logger log;

    public WriteBehindQueue(Logger log, String threadName) {
        this.log = log;
        this.worker = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, threadName);
            thread.setDaemon(true);
            return thread;
        });
    }

    /** description 必須含 uuid 與金額，寫入失敗時管理員才對得回帳。 */
    public void submit(String description, Runnable write) {
        try {
            worker.execute(() -> {
                try {
                    write.run();
                } catch (RuntimeException e) {
                    log.log(Level.SEVERE, "Ledger write failed: " + description
                        + ". Memory is ahead of the database until the next write for this account.", e);
                }
            });
        } catch (RejectedExecutionException e) {
            log.log(Level.SEVERE, "Plugin is shutting down; write rejected: " + description, e);
        }
    }

    /** 同步排空。只在 onDisable 呼叫——此時排程器已不收任務，非同步存檔永遠不會跑。 */
    public void close(long timeoutSeconds) {
        worker.shutdown();
        try {
            if (!worker.awaitTermination(timeoutSeconds, TimeUnit.SECONDS)) {
                log.severe("Write queue did not drain within " + timeoutSeconds + "s; some transactions may be missing.");
                worker.shutdownNow();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            worker.shutdownNow();
            log.warning("Interrupted while draining the write queue.");
        }
    }
}
```

### `EconomyApiImpl.java`

```java
package com.example.economy;

import com.example.economy.api.EconomyApi;
import com.example.economy.api.EconomyResult;
import com.example.economy.domain.AmountParser;
import com.example.economy.domain.Currency;
import com.example.economy.domain.Ledger;
import com.example.economy.domain.MoneyFormat;
import org.bukkit.Server;

import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

/** {@link EconomyApi} 的實作：只負責「主執行緒限定」與把幣種 id 轉成 {@link Currency}，其餘全交給 {@link Ledger}。 */
final class EconomyApiImpl implements EconomyApi {

    private final Ledger ledger;
    private final Server server;

    EconomyApiImpl(Ledger ledger, Server server) {
        this.ledger = ledger;
        this.server = server;
    }

    @Override
    public boolean hasAccount(UUID account) {
        requireMainThread();
        return ledger.hasAccount(account);
    }

    @Override
    public boolean openAccount(UUID account) {
        requireMainThread();
        return ledger.open(account);
    }

    @Override
    public OptionalLong balance(UUID account, String currency) {
        requireMainThread();
        return ledger.balance(account, currency);
    }

    @Override
    public EconomyResult deposit(UUID account, String currency, long amount, String note) {
        requireMainThread();
        return ledger.deposit(account, currency, amount, note);
    }

    @Override
    public EconomyResult withdraw(UUID account, String currency, long amount, String note) {
        requireMainThread();
        return ledger.withdraw(account, currency, amount, note);
    }

    @Override
    public EconomyResult transfer(UUID from, UUID to, String currency, long amount, String note) {
        requireMainThread();
        return ledger.transfer(from, to, currency, amount, note);
    }

    @Override
    public String format(String currency, long minor) {
        return MoneyFormat.full(minor, require(currency));
    }

    @Override
    public String formatShort(String currency, long minor) {
        return MoneyFormat.shortFull(minor, require(currency));
    }

    @Override
    public OptionalLong parse(String currency, String text) {
        return AmountParser.parse(text, require(currency).decimals());
    }

    @Override
    public List<String> currencies() {
        return ledger.currencies().stream().map(Currency::id).toList();
    }

    private Currency require(String id) {
        return ledger.currency(id).orElseThrow(() -> new IllegalArgumentException("Unknown currency: " + id));
    }

    private void requireMainThread() {
        if (!server.isPrimaryThread()) {
            throw new IllegalStateException("EconomyApi must be called on the main thread");
        }
    }
}
```

### `VaultEconomyProvider.java`（選用，只由 `VaultHook` 建構）

> **色碼警告**：別人的提供端的 `Economy.format()` 常回傳含 `§` 或 `&` 的舊式色碼字串。消費 Vault 時，不要把它塞進 MiniMessage（色碼會被當純文字顯示）；用 `LegacyComponentSerializer` 轉成 `Component`，或改用 `EconomyApi.format` 的純文字。本提供端回傳純文字，但消費端仍須假設任何提供端都可能含色碼。
>
> **double 警告**：Vault 的 API 只有 `double` 與單一幣種。所有 `double` 一律經 `Money.toMinor` 四捨五入到幣種小數位；以名字為參數的舊方法只能解析「伺服器曾見過」的玩家（`getOfflinePlayerIfCached`，不會發出 Mojang 查詢）。`AbstractEconomy` 會把 `OfflinePlayer` 版本轉成名字版本，所以下面把 `OfflinePlayer` 版本全部覆寫成 UUID 路徑。

```java
package com.example.economy.vault;

import com.example.economy.api.EconomyApi;
import com.example.economy.api.EconomyResult;
import com.example.economy.domain.Currency;
import com.example.economy.domain.Money;
import net.milkbowl.vault.economy.AbstractEconomy;
import net.milkbowl.vault.economy.EconomyResponse;
import net.milkbowl.vault.economy.EconomyResponse.ResponseType;
import org.bukkit.OfflinePlayer;
import org.bukkit.Server;

import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Vault 經濟服務。所有方法主執行緒限定（{@link EconomyApi} 會檢查）。
 * 銀行功能不支援；world 參數忽略。
 */
@SuppressWarnings("deprecation")
public final class VaultEconomyProvider extends AbstractEconomy {

    private static final String PROVIDER_NAME = "Economy";
    private static final String NO_ACCOUNT = "No such account";

    private final EconomyApi api;
    private final Currency currency;
    private final Server server;

    public VaultEconomyProvider(EconomyApi api, Currency currency, Server server) {
        this.api = api;
        this.currency = currency;
        this.server = server;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }

    @Override
    public String getName() {
        return PROVIDER_NAME;
    }

    @Override
    public boolean hasBankSupport() {
        return false;
    }

    @Override
    public int fractionalDigits() {
        return currency.decimals();
    }

    /** 純文字（無色碼）。 */
    @Override
    public String format(double amount) {
        OptionalLong minor = Money.toMinor(amount, currency.decimals());
        return minor.isPresent() ? api.format(currency.id(), minor.getAsLong()) : amount + " " + currency.symbol();
    }

    @Override
    public String currencyNamePlural() {
        return currency.symbol();
    }

    @Override
    public String currencyNameSingular() {
        return currency.symbol();
    }

    // ---- 帳號 ----

    @Override
    public boolean hasAccount(OfflinePlayer player) {
        return api.hasAccount(player.getUniqueId());
    }

    @Override
    public boolean hasAccount(OfflinePlayer player, String worldName) {
        return hasAccount(player);
    }

    @Override
    public boolean hasAccount(String playerName) {
        OfflinePlayer player = cached(playerName);
        return player != null && hasAccount(player);
    }

    @Override
    public boolean hasAccount(String playerName, String worldName) {
        return hasAccount(playerName);
    }

    @Override
    public boolean createPlayerAccount(OfflinePlayer player) {
        return api.openAccount(player.getUniqueId());
    }

    @Override
    public boolean createPlayerAccount(OfflinePlayer player, String worldName) {
        return createPlayerAccount(player);
    }

    @Override
    public boolean createPlayerAccount(String playerName) {
        OfflinePlayer player = cached(playerName);
        return player != null && createPlayerAccount(player);
    }

    @Override
    public boolean createPlayerAccount(String playerName, String worldName) {
        return createPlayerAccount(playerName);
    }

    // ---- 餘額 ----

    @Override
    public double getBalance(OfflinePlayer player) {
        return Money.toMajor(api.balance(player.getUniqueId(), currency.id()).orElse(0L), currency.decimals());
    }

    @Override
    public double getBalance(OfflinePlayer player, String world) {
        return getBalance(player);
    }

    @Override
    public double getBalance(String playerName) {
        OfflinePlayer player = cached(playerName);
        return player == null ? 0.0 : getBalance(player);
    }

    @Override
    public double getBalance(String playerName, String world) {
        return getBalance(playerName);
    }

    @Override
    public boolean has(OfflinePlayer player, double amount) {
        OptionalLong minor = Money.toMinor(amount, currency.decimals());
        return minor.isPresent()
            && api.balance(player.getUniqueId(), currency.id()).orElse(0L) >= minor.getAsLong();
    }

    @Override
    public boolean has(OfflinePlayer player, String worldName, double amount) {
        return has(player, amount);
    }

    @Override
    public boolean has(String playerName, double amount) {
        OfflinePlayer player = cached(playerName);
        return player != null && has(player, amount);
    }

    @Override
    public boolean has(String playerName, String worldName, double amount) {
        return has(playerName, amount);
    }

    // ---- 存提 ----

    @Override
    public EconomyResponse withdrawPlayer(OfflinePlayer player, double amount) {
        return change(player.getUniqueId(), amount, false);
    }

    @Override
    public EconomyResponse withdrawPlayer(OfflinePlayer player, String worldName, double amount) {
        return withdrawPlayer(player, amount);
    }

    @Override
    public EconomyResponse withdrawPlayer(String playerName, double amount) {
        OfflinePlayer player = cached(playerName);
        return player == null ? failure(amount, 0L, NO_ACCOUNT) : withdrawPlayer(player, amount);
    }

    @Override
    public EconomyResponse withdrawPlayer(String playerName, String worldName, double amount) {
        return withdrawPlayer(playerName, amount);
    }

    @Override
    public EconomyResponse depositPlayer(OfflinePlayer player, double amount) {
        return change(player.getUniqueId(), amount, true);
    }

    @Override
    public EconomyResponse depositPlayer(OfflinePlayer player, String worldName, double amount) {
        return depositPlayer(player, amount);
    }

    @Override
    public EconomyResponse depositPlayer(String playerName, double amount) {
        OfflinePlayer player = cached(playerName);
        return player == null ? failure(amount, 0L, NO_ACCOUNT) : depositPlayer(player, amount);
    }

    @Override
    public EconomyResponse depositPlayer(String playerName, String worldName, double amount) {
        return depositPlayer(playerName, amount);
    }

    private EconomyResponse change(UUID who, double raw, boolean deposit) {
        long before = api.balance(who, currency.id()).orElse(0L);
        OptionalLong amount = Money.toMinor(raw, currency.decimals());
        if (amount.isEmpty()) {
            return failure(raw, before, "Invalid amount");
        }
        if (amount.getAsLong() == 0L) { // 部分插件會以 0 查詢：視為成功的空操作
            return new EconomyResponse(raw, Money.toMajor(before, currency.decimals()), ResponseType.SUCCESS, "");
        }
        EconomyResult result = deposit
            ? api.deposit(who, currency.id(), amount.getAsLong(), "vault")
            : api.withdraw(who, currency.id(), amount.getAsLong(), "vault");
        long after = api.balance(who, currency.id()).orElse(before);
        return switch (result) {
            case OK -> new EconomyResponse(raw, Money.toMajor(after, currency.decimals()), ResponseType.SUCCESS, "");
            case NO_ACCOUNT -> failure(raw, before, NO_ACCOUNT);
            case INSUFFICIENT -> failure(raw, before, "Insufficient funds");
            case INVALID_AMOUNT -> failure(raw, before, "Invalid amount");
        };
    }

    private EconomyResponse failure(double amount, long balanceMinor, String message) {
        return new EconomyResponse(amount, Money.toMajor(balanceMinor, currency.decimals()), ResponseType.FAILURE, message);
    }

    /** 只認伺服器曾見過的名字（快取），不會觸發 Mojang 查詢；沒見過回 null。 */
    private OfflinePlayer cached(String name) {
        return server.getOfflinePlayerIfCached(name);
    }

    // ---- 銀行：不支援 ----

    private static EconomyResponse notImplemented() {
        return new EconomyResponse(0, 0, ResponseType.NOT_IMPLEMENTED, "Banks are not supported");
    }

    @Override
    public EconomyResponse createBank(String name, String player) {
        return notImplemented();
    }

    @Override
    public EconomyResponse deleteBank(String name) {
        return notImplemented();
    }

    @Override
    public EconomyResponse bankBalance(String name) {
        return notImplemented();
    }

    @Override
    public EconomyResponse bankHas(String name, double amount) {
        return notImplemented();
    }

    @Override
    public EconomyResponse bankWithdraw(String name, double amount) {
        return notImplemented();
    }

    @Override
    public EconomyResponse bankDeposit(String name, double amount) {
        return notImplemented();
    }

    @Override
    public EconomyResponse isBankOwner(String name, String playerName) {
        return notImplemented();
    }

    @Override
    public EconomyResponse isBankMember(String name, String playerName) {
        return notImplemented();
    }

    @Override
    public List<String> getBanks() {
        return List.of();
    }
}
```

### `VaultHook.java`（隔離入口）

```java
package com.example.economy.vault;

import com.example.economy.api.EconomyApi;
import com.example.economy.domain.Currency;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * 只在 Vault 插件存在時才呼叫（呼叫端先 {@code isPluginEnabled("Vault")}）：
 * 本類與 {@link VaultEconomyProvider} 都引用 net.milkbowl，沒有 Vault 時載入會 NoClassDefFoundError。
 * 隔離規則見 paper-softdepend-hook。
 */
public final class VaultHook {

    private VaultHook() {
    }

    /** 以 Highest 優先權註冊，讓本插件成為 Vault 的預設經濟提供端；{@code unregisterAll(plugin)} 一次移除。 */
    public static void register(JavaPlugin plugin, EconomyApi api, Currency vaultCurrency) {
        plugin.getServer().getServicesManager().register(
            Economy.class,
            new VaultEconomyProvider(api, vaultCurrency, plugin.getServer()),
            plugin,
            ServicePriority.Highest);
    }
}
```

### `EconomyPlugin.java`（組裝）

```java
package com.example.economy;

import com.example.economy.api.EconomyApi;
import com.example.economy.domain.AmountParser;
import com.example.economy.domain.Currency;
import com.example.economy.domain.Ledger;
import com.example.economy.domain.Transaction;
import com.example.economy.storage.InMemoryLedgerStore;
import com.example.economy.storage.LedgerStore;
import com.example.economy.storage.WriteBehindQueue;
import com.example.economy.vault.VaultHook;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalLong;
import java.util.logging.Level;

public final class EconomyPlugin extends JavaPlugin implements Listener {

    private static final long DRAIN_TIMEOUT_SECONDS = 10L;

    private WriteBehindQueue queue;
    private EconomyApi api;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        try {
            start();
        } catch (RuntimeException e) {
            getLogger().log(Level.SEVERE, "Economy failed to start; disabling.", e);
            getServer().getPluginManager().disablePlugin(this);
        }
    }

    private void start() {
        List<Currency> currencies = readCurrencies(getConfig().getConfigurationSection("currencies"));
        String vaultId = getConfig().getString("vault-currency", "");

        LedgerStore store = new InMemoryLedgerStore(); // 換成 SqliteLedgerStore（paper-sqlite-repository）
        queue = new WriteBehindQueue(getLogger(), "Economy-writer");

        Ledger ledger = new Ledger(currencies, System::currentTimeMillis, batch -> {
            Transaction first = batch.get(0);
            queue.submit("tx " + first.account() + " " + first.currency() + " " + first.delta(),
                () -> store.apply(batch));
        });
        store.loadBalances().forEach((account, wallet) ->
            wallet.forEach((currency, balance) -> {
                if (!ledger.restore(account, currency, balance)) {
                    getLogger().warning("Skipped balance of " + account + " in unknown currency " + currency);
                }
            }));

        api = new EconomyApiImpl(ledger, getServer());
        getServer().getPluginManager().registerEvents(this, this);

        // 其餘初始化完成後才註冊，確保使用端拿到的是可用的實作
        getServer().getServicesManager().register(EconomyApi.class, api, this, ServicePriority.Normal);

        if (getServer().getPluginManager().isPluginEnabled("Vault")) {
            Currency vaultCurrency = currencies.stream().filter(c -> c.id().equals(vaultId)).findFirst()
                .orElseThrow(() -> new IllegalStateException("vault-currency is not a defined currency: " + vaultId));
            VaultHook.register(this, api, vaultCurrency);
            getLogger().info("Registered Vault Economy provider for currency " + vaultId);
        } else {
            getLogger().warning("Vault not found; other plugins cannot use this economy through Vault.");
        }
    }

    private List<Currency> readCurrencies(ConfigurationSection section) {
        if (section == null || section.getKeys(false).isEmpty()) {
            throw new IllegalStateException("config.yml needs at least one entry under 'currencies'");
        }
        List<Currency> result = new ArrayList<>();
        for (String id : section.getKeys(false)) {
            ConfigurationSection c = section.getConfigurationSection(id);
            if (c == null) {
                throw new IllegalStateException("currencies." + id + " must be a section");
            }
            int decimals = c.getInt("decimals", 0);
            // starting-balance 以字串解析：YAML 的 double 可能是 0.30000000000000004
            OptionalLong starting = AmountParser.parse(c.getString("starting-balance", "0"), decimals);
            if (starting.isEmpty()) {
                throw new IllegalStateException("currencies." + id + ".starting-balance is invalid");
            }
            result.add(new Currency(id, c.getString("symbol", ""), decimals,
                c.getString("pattern", "#,##0"), starting.getAsLong()));
        }
        return List.copyOf(result);
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        api.openAccount(event.getPlayer().getUniqueId());
    }

    @Override
    public void onDisable() {
        getServer().getServicesManager().unregisterAll(this);
        if (queue != null) { // onEnable 可能半途失敗
            queue.close(DRAIN_TIMEOUT_SECONDS);
        }
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
economy/
└── src/main/java/com/example/economy/
    ├── EconomyPlugin.java
    ├── EconomyApiImpl.java
    ├── api/                       ← 不可 relocate、只加不改（JDK 型別）
    │   ├── EconomyApi.java
    │   └── EconomyResult.java
    ├── domain/                    ← 純 Java，無 org.bukkit；JUnit 直接測
    │   ├── Currency.java  Money.java  MoneyFormat.java  AmountParser.java
    │   └── Transaction.java  Ledger.java  Escrow.java
    ├── storage/
    │   ├── LedgerStore.java  InMemoryLedgerStore.java  WriteBehindQueue.java
    │   └── SqliteLedgerStore.java ← 見 paper-sqlite-repository
    └── vault/                     ← 只有這裡 import net.milkbowl
        ├── VaultEconomyProvider.java
        └── VaultHook.java
```

## 執行緒安全注意事項 / Thread Safety

- `Ledger`／`Escrow` 假設單執行緒；`EconomyApiImpl` 與 Vault 提供端只允許**主執行緒**（違反丟 `IllegalStateException`）
- 持久化只在 `WriteBehindQueue` 的單一寫入執行緒；佇列中只傳不可變的 `Transaction`（record），不傳 Bukkit 物件
- 非同步工作（HTTP、資料庫）需要金額時，先在主執行緒讀值再傳入；寫回時用 `runTask` 回主執行緒再呼叫 API
- `onDisable` 時排程器已關閉：同步 `queue.close(...)` 排空，不要再丟 `runTaskAsynchronously`
- 詳見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 餘額差 1 分、`0.1 + 0.2` 對不上 | 帳本內用了 `double` | 全程 `long` 最小單位；`double` 只在 Vault 邊界用 `Money.toMinor`（四捨五入） |
| 轉帳後總額變多或變少 | 先扣後加之間失敗、或收款方溢位 | `Ledger.transfer` 先檢查兩邊再一起改；非 OK 結果保證沒動餘額 |
| `ArithmeticException: long overflow` | 直接用 `+` 或 `Math.addExact` 沒接 | 一律走 `Money.checkedAdd`，溢位回 `INVALID_AMOUNT` |
| 玩家輸入 `1e3`、`-5`、`NaN` 被當成錢 | 用 `Double.parseDouble` 解析 | 用 `AmountParser`（regex + BigDecimal），不經過 double |
| 交貨丟例外後買方沒收到東西也沒退錢 | 保留後沒有 `finally` | 用 `Escrow.trade`；自訂流程時 `Hold.refund()` 放在 `finally` |
| 交貨例外後物品憑空消失 | 物品已從畫面／背包取出，例外跳過還原 | 在 `Delivery` 內 `catch` → 先還物品 → 重拋（見 examples.md），退款由 `Escrow` 處理 |
| 訊息顯示 `§a$ 100`／`&a100` 原文 | 把別人 `Economy.format()` 塞進 MiniMessage | 用 `LegacyComponentSerializer` 轉 `Component`，或改用 `EconomyApi.format` 純文字 |
| 其他插件仍使用舊的經濟 | 優先權不夠，或本插件未註冊 | `ServicePriority.Highest` 註冊；`softdepend: [Vault]`；啟動日誌確認已註冊 |
| 沒裝 Vault 就 `NoClassDefFoundError` | `EconomyPlugin` 欄位或簽名出現 Vault 型別 | Vault 型別只出現在 `vault/` package；先 `isPluginEnabled("Vault")` 再呼叫 `VaultHook` |
| 重啟後餘額少一筆 | 寫入失敗或關機時未排空 | 日誌找 `Ledger write failed`（含 uuid 與金額）；確認 `onDisable` 呼叫 `queue.close` |
| `getOfflinePlayerIfCached` 回 null | 以名字呼叫 Vault 舊方法，玩家從未上線 | 回傳 `FAILURE`／0；呼叫端應改用 UUID 版本 |
