---
name: paper-economy-ledger
description: "插件內建經濟核心：long 最小單位金額（不用 double）、多幣種、純 Ledger（OK/INSUFFICIENT/NO_ACCOUNT/INVALID_AMOUNT）、只增不改交易紀錄、k/m/b 簡寫解析與格式化、託管（escrow）例外安全、write-behind 持久化、內部 API 與選用 Vault Economy 提供端 / In-plugin economy core with long minor units, multi-currency pure Ledger, append-only transaction log, k/m/b parsing, exception-safe escrow, write-behind persistence, internal API and optional Vault provider"
---

# Paper Economy Ledger

## Skill Name

`paper-economy-ledger`

## Purpose

Provide an economy core you can drop straight into a plugin. The point: money must never be miscalculated or vanish.

1. **Amounts are always `long` minor units** (`decimals = 2` -> 1 dollar = 100). `double` appears only at the Vault boundary, and every crossing goes through `BigDecimal` rounded to the minor unit.
2. **A pure `Ledger`**: no Bukkit types. Deposit/withdraw/transfer return an explicit result `OK / INSUFFICIENT / NO_ACCOUNT / INVALID_AMOUNT`, never throw, never apply half a change; additions use `Math.addExact` to guard against overflow.
3. **Append-only transaction log**: every change produces a `Transaction` (who, delta, balance after, note, time), written to the persistence layer atomically as one batch.
4. **Shorthand and formatting**: parse `1.2k / 3m / 4b` (rejecting negatives, `NaN`, scientific notation, too many decimals, and values over the cap) and display amounts.
5. **Escrow**: reserve the buyer's money first, pay the seller only after delivery succeeds; if delivery throws, refund in `finally`, so money or items never vanish.
6. **Write-behind persistence**: memory is authoritative, and a single-thread queue writes to storage in order (implementation in [`paper-sqlite-repository`](../paper-sqlite-repository/SKILL.md)).
7. **External surface**: expose the internal API first (see [`paper-service-api`](../paper-service-api/SKILL.md)), then optionally register a Vault `Economy` provider (isolation rules in [`paper-softdepend-hook`](../paper-softdepend-hook/SKILL.md)).

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (uses only the Bukkit API and Vault 1.7.1; the code is identical on both versions, with no version-specific lines)
- Pure Paper API, no Paperweight needed; `Ledger`, `Escrow`, formatting and parsing do not depend on Bukkit at all and can be tested directly with JUnit

## Triggers

- 「經濟」「economy」「帳本」「ledger」「餘額」「balance」「轉帳」「pay」
- 「貨幣」「multi-currency」「小數」「minor units」「k m b」「1.5k」「簡寫金額」
- 「託管」「escrow」「退款」「refund」「訂單」「交易紀錄」「transaction log」
- 「Vault Economy 提供端」「register Economy」「ServicePriority.Highest」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.economy` | Root package; the API lives in `<base>.api` (must not be relocated) |
| `currencies` | `coins` (2 decimals), `gems` (0) | Per currency: `id`, symbol, decimals, display pattern, starting balance |
| `vault_currency` | `coins` | The one currency exposed to Vault (Vault supports a single currency) |
| `persistence` | `sqlite` | Persistence layer; the template includes an in-memory `InMemoryLedgerStore` for tests |
| `expose_vault` | `true` | Whether to register the Vault provider |

## Outputs

- `EconomyResult.java`, `EconomyApi.java` - public API (JDK types only)
- `Currency.java`, `Money.java`, `MoneyFormat.java`, `AmountParser.java` - currencies, minor-unit conversion, display, parsing
- `Transaction.java`, `Ledger.java` - pure ledger and transaction log
- `Escrow.java` - exception-safe escrow
- `LedgerStore.java`, `InMemoryLedgerStore.java`, `WriteBehindQueue.java` - persistence interface and write-behind queue
- `EconomyApiImpl.java` - API implementation restricted to the main thread
- `VaultEconomyProvider.java`, `VaultHook.java` - optional Vault provider and registration entry point
- `EconomyPlugin.java` - wiring, registration, and draining the queue on disable

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Vault is `compileOnly` and must not be shaded; add JUnit for tests:

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11: '1.21.11-R0.1-SNAPSHOT'
    compileOnly('com.github.MilkBowl:VaultAPI:1.7.1') { exclude group: 'org.bukkit' }

    testImplementation platform('org.junit:junit-bom:5.12.2')
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.withType(Test).configureEach { useJUnitPlatform() }
```

`plugin.yml`:

```yaml
name: Economy
main: com.example.economy.EconomyPlugin
api-version: '26.2'
softdepend: [Vault]
```

`config.yml` (currency definitions; `decimals` is 0 to 2, `pattern` only controls thousands grouping and the fraction digits come from `decimals`; quote `starting-balance` so it is parsed as a string):

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

## Code Template

### Core Rules

1. **Amounts are `long` minor units**, capped at `Money.MAX` (9x10^15, below 2^53, so `double` can still represent integers exactly up to that point). Never use `double` inside the ledger.
2. **`Ledger` never touches Bukkit**; the outer layer (`EconomyApiImpl`) checks the thread, and `Ledger` itself assumes single-threaded use.
3. **Validate first, mutate second, record third**: change balances only after every check (account, amount, balance, overflow) passes; a non-`OK` result guarantees balances are unchanged.
4. **Memory is authoritative, persistence is write-behind**: a failed write is only logged and memory is not rolled back; each transaction carries the "balance after", so the next successful write self-heals, and `onDisable` drains synchronously.
5. **Escrow refunds in `finally`**: on every path out of `trade`, the reserved money has either been paid to the seller or returned to the buyer.
6. Vault `double` values always go through `Money.toMinor`, rounded to the minor unit; the return value of `Economy.format()` is **not** MiniMessage (see the note on `VaultEconomyProvider`).

### `EconomyResult.java` (api package)

```java
package com.example.economy.api;

/** Ledger operation result. Append-only: new values may only be added at the end. A non-OK result guarantees no balance changed. */
public enum EconomyResult {
    OK,
    INSUFFICIENT,
    NO_ACCOUNT,
    /** Amount <= 0, over the cap, sum overflow, or a transfer to oneself. */
    INVALID_AMOUNT
}
```

### `EconomyApi.java` (api package, JDK types only)

```java
package com.example.economy.api;

import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Economy API for other plugins (obtained through ServicesManager, see paper-service-api).
 *
 * <p>Rules: amounts are long minor units; every method may only be called on the main thread, otherwise it throws {@link IllegalStateException};
 * an unknown currency id throws {@link IllegalArgumentException} (a programming error in the caller, not a game condition).
 * Append-only: new methods go at the end.
 */
public interface EconomyApi {

    boolean hasAccount(UUID account);

    /** Opens an account and grants each currency's starting balance; returns false if it already exists. */
    boolean openAccount(UUID account);

    /** No account -> empty. */
    OptionalLong balance(UUID account, String currency);

    /** Credits the account; amount <= 0 -> INVALID_AMOUNT. note is the caller's self-reported source, stored in the transaction log. */
    EconomyResult deposit(UUID account, String currency, long amount, String note);

    /** Debits the account; insufficient balance -> INSUFFICIENT, balance unchanged. */
    EconomyResult withdraw(UUID account, String currency, long amount, String note);

    EconomyResult transfer(UUID from, UUID to, String currency, long amount, String note);

    /** Plain text (no color codes) full amount, e.g. {@code $ 1,234.50}. */
    String format(String currency, long minor);

    /** Plain text short amount, e.g. {@code $ 1.2k}. */
    String formatShort(String currency, long minor);

    /** Parses player input (supports k/m/b); malformed -> empty. */
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
 * Currency definition. Amounts are always minor units: decimals = 2 -> 1.00 = 100.
 *
 * @param pattern {@link java.text.DecimalFormat} pattern, used only for thousands grouping; the fraction digits are forced by decimals
 * @param startingBalance in minor units
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

    /** 10^decimals: the divisor that converts minor units to major units. */
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

/** Minor-unit cap and double-boundary conversion (only for double-based APIs such as Vault). */
public final class Money {

    /** Minor-unit cap: below 2^53, so double can still represent integers exactly up to here. */
    public static final long MAX = 9_000_000_000_000_000L;
    private static final BigDecimal MAX_DECIMAL = BigDecimal.valueOf(MAX);

    private Money() {
    }

    /**
     * Vault double (major units) -> minor units, <b>rounded</b> (half up) to decimals places:
     * {@code 0.1 + 0.2 = 0.30000000000000004} becomes 0.30.
     * Negative, NaN/infinite, or over {@link #MAX} -> empty. Uses BigDecimal, no floating-point multiplication.
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

    /** Minor units -> double major units (used only when returning to Vault; no loss within the cap). */
    public static double toMajor(long minor, int decimals) {
        return BigDecimal.valueOf(minor, decimals).doubleValue();
    }

    /** Overflow-safe addition: beyond long or {@link #MAX} -> empty. */
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
 * Amount display: input is always minor units, output is always plain text (no color codes). Fixed to {@link Locale#ROOT} so the server locale cannot change the decimal separator.
 * Short form uses integer arithmetic, truncates to one decimal (never rounds up) and strips a trailing zero: 1_999 -> 1.9k (not 2k), so the displayed amount is never more than the real one.
 */
public final class MoneyFormat {

    private static final long THOUSAND = 1_000L;
    private static final long MILLION = 1_000_000L;
    private static final long BILLION = 1_000_000_000L;

    private MoneyFormat() {
    }

    /** Thousands grouping + fixed decimals: {@code 1,234.50}. */
    public static String number(long minor, Currency currency) {
        DecimalFormat format = new DecimalFormat(currency.pattern(), DecimalFormatSymbols.getInstance(Locale.ROOT));
        format.setRoundingMode(RoundingMode.UNNECESSARY);
        format.setMinimumFractionDigits(currency.decimals());
        format.setMaximumFractionDigits(currency.decimals());
        return format.format(BigDecimal.valueOf(minor, currency.decimals()));
    }

    /** Symbol + number: {@code $ 1,234.50}. */
    public static String full(long minor, Currency currency) {
        return currency.symbol() + " " + number(minor, currency);
    }

    /** Shortens to k/m/b when the major amount >= 1,000; otherwise same as {@link #number}. */
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
        long tenths = major * 10 / unit; // major <= 9e15 -> x10 cannot overflow
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
 * Player input -> minor units. Accepts only {@code integer[.fraction][k|m|b]} (case-insensitive):
 * rejects a minus sign, {@code NaN}, {@code Infinity}, scientific notation, thousands commas, extra surrounding characters,
 * fractions finer than the currency ({@code 1.234} for a 2-decimal currency; {@code 1.234567k} still has more than 2 decimals after applying the unit), and values over {@link Money#MAX}.
 * BigDecimal throughout, never via double.
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
 * An append-only transaction record (the sole evidence of a ledger change).
 *
 * @param at timestamp in milliseconds
 * @param delta signed change (minor units): positive for a credit, negative for a debit
 * @param balanceAfter balance after the change; persistence upserts the balance from it, so one failed write cannot corrupt later balances
 * @param note source description, e.g. {@code pay}, {@code shop:buy}, {@code vault}
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
 * Pure ledger: no Bukkit types, so it can be tested directly with JUnit. <b>Not thread-safe</b>; the caller (EconomyApiImpl) is responsible for restricting it to the main thread.
 *
 * <p>Each operation: validate -> change balances -> hand this operation's {@link Transaction}s as one batch to the sink (the write-behind queue).
 * Any non-OK result is guaranteed to change no balance and not call the sink.
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

    /** Restores balances from persistence at startup (produces no transactions). Currency no longer in config or invalid value -> returns false and skips. */
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

    /** Opens an account and produces transactions from each currency's starting balance; returns false if it already exists. */
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

    /** No account -> empty. An unknown currency throws IllegalArgumentException. */
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

    /** Transfer: both transactions go to the sink in the same batch (persistence puts them in one SQL transaction). Transfer to oneself -> INVALID_AMOUNT. */
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
            return EconomyResult.INVALID_AMOUNT; // the receiver would overflow: neither side changes
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
 * Escrow: first "reserve" the buyer's money (deduct it from the balance), pay the seller only after delivery succeeds, otherwise refund.
 *
 * <p>Invariant: when {@link #trade} returns or throws, the reserved money has either been paid to the seller or refunded to the buyer; it never dangles.
 * If delivery ({@link Delivery}) throws, {@code finally} refunds first and then lets the exception propagate; restoring items is Delivery's own responsibility
 * (see examples.md: restore the items first, then rethrow). <b>Not thread-safe</b>; use it on the same thread as {@link Ledger}.
 */
public final class Escrow {

    /** The delivery action: returns true on successful delivery; returns false when it cannot deliver (out of stock, receiver's inventory full), which refunds; throwing also refunds. */
    @FunctionalInterface
    public interface Delivery {
        boolean deliver();
    }

    public enum Outcome {
        /** Delivered, and the money has been paid to the seller. */
        SETTLED,
        /** Buyer has insufficient balance, no account, or the amount is invalid; no money was reserved (see {@code funds} for the reason). */
        NOT_RESERVED,
        /** Delivery returned false: fully refunded. */
        DECLINED,
        /** Delivered but the seller cannot receive the payment (e.g. balance overflow): fully refunded, and the caller must restore the items already handed over. */
        SETTLEMENT_FAILED
    }

    public record TradeResult(Outcome outcome, EconomyResult funds) {
    }

    /** A reserved sum. Only one of settle and refund can succeed; afterwards the hold is dead. */
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

        /** Result of the reservation; non-OK means no money was deducted, and the Hold starts out closed. */
        public EconomyResult reserved() {
            return reserved;
        }

        public boolean isOpen() {
            return open;
        }

        /** Pays the payee. On failure (non-OK) the reservation remains and the caller should follow with {@link #refund()}. */
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

        /** Refunds the payer; does nothing if already settled, already refunded, or the reservation never succeeded. */
        public void refund() {
            if (!open) {
                return;
            }
            EconomyResult result = ledger.deposit(payer, currency, amount, note + ":refund");
            if (result != EconomyResult.OK) {
                // Should be impossible (adding back money just deducted cannot overflow); if it happens, admins must be able to reconcile
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

    /** Reserves funds. In a custom flow, once you hold the Hold you must put settle/refund inside try/finally. */
    public Hold reserve(UUID payer, String currency, long amount, String note) {
        return new Hold(ledger, payer, currency, amount, note);
    }

    /** Reserve -> deliver -> settle or refund; leaving by any path never leaves money dangling. */
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
 * Persistence interface. For the SQLite implementation see paper-sqlite-repository: {@code apply} INSERTs the transaction records inside one SQL transaction
 * and UPSERTs balances using {@code balanceAfter} ({@code INSERT ... ON CONFLICT DO UPDATE}).
 */
public interface LedgerStore {

    /** Called once at startup (may block): account -> (currency -> minor-unit balance). */
    Map<UUID, Map<String, Long>> loadBalances();

    /** Writes a batch of transactions and updates balances. Called only on the {@link WriteBehindQueue} writer thread; may block. */
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

/** In-memory persistence: for JUnit and for development without a database. Methods are synchronized (the writer thread and the test thread share it). */
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

    /** Append-only copy of the records (for tests). */
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
 * Single-thread write queue: writes land in submission order (do not use Bukkit's async pool, since a pool can reorder two writes).
 * Failures are only logged and memory is not rolled back: each transaction carries the absolute balance, so the next successful write self-heals; {@link #close} drains synchronously in onDisable.
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

    /** The description must contain the uuid and amount, so admins can reconcile when a write fails. */
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

    /** Synchronous drain. Call only in onDisable - the scheduler no longer accepts tasks then, so an async save would never run. */
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

/** Implementation of {@link EconomyApi}: only responsible for "main thread only" and mapping the currency id to a {@link Currency}; everything else is delegated to {@link Ledger}. */
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

### `VaultEconomyProvider.java` (optional, constructed only by `VaultHook`)

> **Color code warning**: other providers' `Economy.format()` often returns legacy color-code strings containing `§` or `&`. When consuming Vault, do not put it into MiniMessage (the color codes would show as plain text); convert it to a `Component` with `LegacyComponentSerializer`, or use the plain text from `EconomyApi.format` instead. This provider returns plain text, but consumers must still assume any provider may contain color codes.
>
> **double warning**: the Vault API has only `double` and a single currency. Every `double` goes through `Money.toMinor`, rounded to the currency's decimals; the legacy name-based methods can only resolve players "the server has seen before" (`getOfflinePlayerIfCached`, which issues no Mojang lookup). `AbstractEconomy` converts the `OfflinePlayer` variants into name variants, so all `OfflinePlayer` variants are overridden below to use the UUID path.

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
 * Vault economy service. All methods are main-thread only (checked by {@link EconomyApi}).
 * Banks are not supported; the world parameter is ignored.
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

    /** Plain text (no color codes). */
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

    // ---- Accounts ----

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

    // ---- Balances ----

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

    // ---- Deposit / withdraw ----

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
        if (amount.getAsLong() == 0L) { // some plugins query with 0: treat as a successful no-op
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

    /** Only recognizes names the server has seen (cache); never triggers a Mojang lookup; returns null if unseen. */
    private OfflinePlayer cached(String name) {
        return server.getOfflinePlayerIfCached(name);
    }

    // ---- Banks: unsupported ----

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

### `VaultHook.java` (isolated entry point)

```java
package com.example.economy.vault;

import com.example.economy.api.EconomyApi;
import com.example.economy.domain.Currency;
import net.milkbowl.vault.economy.Economy;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Call only when the Vault plugin is present (the caller first checks {@code isPluginEnabled("Vault")}):
 * this class and {@link VaultEconomyProvider} both reference net.milkbowl, so loading without Vault causes NoClassDefFoundError.
 * See paper-softdepend-hook for the isolation rules.
 */
public final class VaultHook {

    private VaultHook() {
    }

    /** Registers at Highest priority so this plugin becomes Vault's default economy provider; {@code unregisterAll(plugin)} removes it in one call. */
    public static void register(JavaPlugin plugin, EconomyApi api, Currency vaultCurrency) {
        plugin.getServer().getServicesManager().register(
            Economy.class,
            new VaultEconomyProvider(api, vaultCurrency, plugin.getServer()),
            plugin,
            ServicePriority.Highest);
    }
}
```

### `EconomyPlugin.java` (wiring)

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

        LedgerStore store = new InMemoryLedgerStore(); // replace with SqliteLedgerStore (paper-sqlite-repository)
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

        // Register only after the rest of initialization completes, so consumers get a usable implementation
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
        // starting-balance is parsed as a string: a YAML double may be 0.30000000000000004
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
        if (queue != null) { // onEnable may fail halfway
            queue.close(DRAIN_TIMEOUT_SECONDS);
        }
    }
}
```

## Recommended Directory Structure

```
economy/
└── src/main/java/com/example/economy/
    ├── EconomyPlugin.java
    ├── EconomyApiImpl.java
    ├── api/                       <- must not be relocated, append-only (JDK types)
    │   ├── EconomyApi.java
    │   └── EconomyResult.java
    ├── domain/                    <- pure Java, no org.bukkit; test directly with JUnit
    │   ├── Currency.java  Money.java  MoneyFormat.java  AmountParser.java
    │   └── Transaction.java  Ledger.java  Escrow.java
    ├── storage/
    │   ├── LedgerStore.java  InMemoryLedgerStore.java  WriteBehindQueue.java
    │   └── SqliteLedgerStore.java <- see paper-sqlite-repository
    └── vault/                     <- the only place that imports net.milkbowl
        ├── VaultEconomyProvider.java
        └── VaultHook.java
```

## Thread Safety

- `Ledger`/`Escrow` assume a single thread; `EconomyApiImpl` and the Vault provider allow only the **main thread** (violations throw `IllegalStateException`)
- Persistence runs only on the single writer thread of `WriteBehindQueue`; only immutable `Transaction` records go through the queue, never Bukkit objects
- When async work (HTTP, database) needs an amount, read the value on the main thread first and pass it in; to write back, return to the main thread with `runTask` and then call the API
- The scheduler is already shut down in `onDisable`: drain synchronously with `queue.close(...)` and do not submit `runTaskAsynchronously` again
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| Balance off by 1 cent, `0.1 + 0.2` does not add up | `double` was used inside the ledger | Use `long` minor units throughout; `double` is used only at the Vault boundary via `Money.toMinor` (rounded) |
| Total goes up or down after a transfer | Failure between debit and credit, or the receiver overflowed | `Ledger.transfer` checks both sides first and then changes both; a non-OK result guarantees balances are unchanged |
| `ArithmeticException: long overflow` | Used `+` directly, or `Math.addExact` was not caught | Always use `Money.checkedAdd`; overflow returns `INVALID_AMOUNT` |
| Player input `1e3`, `-5`, `NaN` is accepted as money | Parsed with `Double.parseDouble` | Use `AmountParser` (regex + BigDecimal), never via double |
| After a delivery exception the buyer got nothing and no refund | No `finally` after reserving | Use `Escrow.trade`; in custom flows put `Hold.refund()` in `finally` |
| Items vanish after a delivery exception | Items were already taken from the screen/inventory and the exception skipped restoration | In `Delivery`, `catch` -> restore items first -> rethrow (see examples.md); `Escrow` handles the refund |
| Messages show raw `§a$ 100` / `&a100` | Another provider's `Economy.format()` was put into MiniMessage | Convert to `Component` with `LegacyComponentSerializer`, or use the plain text from `EconomyApi.format` |
| Other plugins still use the old economy | Priority too low, or this plugin is not registered | Register with `ServicePriority.Highest`; `softdepend: [Vault]`; confirm registration in the startup log |
| `NoClassDefFoundError` without Vault installed | A Vault type appears in an `EconomyPlugin` field or signature | Vault types appear only in the `vault/` package; check `isPluginEnabled("Vault")` before calling `VaultHook` |
| One entry missing after restart | A write failed, or the queue was not drained on shutdown | Look for `Ledger write failed` in the log (includes uuid and amount); confirm `onDisable` calls `queue.close` |
| `getOfflinePlayerIfCached` returns null | Legacy Vault method called by name for a player who never joined | Return `FAILURE`/0; callers should switch to the UUID variant |
