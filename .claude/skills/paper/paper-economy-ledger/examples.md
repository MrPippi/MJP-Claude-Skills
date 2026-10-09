# examples — paper-economy-ledger

## 範例 1：Ledger、解析與格式化的 JUnit 測試

**Input:**
```
base_package: com.example.economy
currencies: coins（2 位小數）、gems（0 位）
```

**Output — `Ledger` 是純 Java，不需要 MockBukkit 或伺服器:**
```java
package com.example.economy.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.example.economy.api.EconomyResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

class LedgerTest {

    private static final Currency COINS = new Currency("coins", "$", 2, "#,##0", 10_000L); // 100.00
    private static final Currency GEMS = new Currency("gems", "G", 0, "#,##0", 0L);

    private final List<Transaction> log = new ArrayList<>();
    private Ledger ledger;
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        log.clear();
        ledger = new Ledger(List.of(COINS, GEMS), () -> 1_000L, log::addAll);
        ledger.open(alice);
        ledger.open(bob);
        log.clear(); // 忽略開戶的 STARTING 交易
    }

    @Test
    void depositAndWithdrawUpdateBalanceAndLog() {
        assertEquals(EconomyResult.OK, ledger.deposit(alice, "coins", 550L, "test"));
        assertEquals(OptionalLong.of(10_550L), ledger.balance(alice, "coins"));
        assertEquals(EconomyResult.OK, ledger.withdraw(alice, "coins", 50L, "test"));

        assertEquals(2, log.size());
        assertEquals(550L, log.get(0).delta());
        assertEquals(10_550L, log.get(0).balanceAfter());
        assertEquals(-50L, log.get(1).delta());
        assertEquals(10_500L, log.get(1).balanceAfter());
    }

    @Test
    void failedOperationsNeverChangeBalanceOrLog() {
        assertEquals(EconomyResult.INSUFFICIENT, ledger.withdraw(alice, "coins", 10_001L, "t"));
        assertEquals(EconomyResult.INVALID_AMOUNT, ledger.deposit(alice, "coins", 0L, "t"));
        assertEquals(EconomyResult.INVALID_AMOUNT, ledger.deposit(alice, "coins", -5L, "t"));
        assertEquals(EconomyResult.NO_ACCOUNT, ledger.deposit(UUID.randomUUID(), "coins", 1L, "t"));
        assertEquals(OptionalLong.of(10_000L), ledger.balance(alice, "coins"));
        assertTrue(log.isEmpty());
    }

    @Test
    void depositOverflowIsRejectedNotWrapped() {
        ledger.restore(alice, "coins", Money.MAX - 1);
        assertEquals(EconomyResult.INVALID_AMOUNT, ledger.deposit(alice, "coins", 2L, "t"));
        assertEquals(EconomyResult.INVALID_AMOUNT, ledger.deposit(alice, "coins", Long.MAX_VALUE, "t"));
        assertEquals(OptionalLong.of(Money.MAX - 1), ledger.balance(alice, "coins"));
    }

    @Test
    void transferMovesMoneyAtomicallyAndLogsBothSides() {
        assertEquals(EconomyResult.OK, ledger.transfer(alice, bob, "coins", 2_500L, "pay"));
        assertEquals(OptionalLong.of(7_500L), ledger.balance(alice, "coins"));
        assertEquals(OptionalLong.of(12_500L), ledger.balance(bob, "coins"));
        assertEquals(2, log.size());
        assertEquals(-2_500L, log.get(0).delta());
        assertEquals(2_500L, log.get(1).delta());
    }

    @Test
    void transferRejectsSelfInsufficientAndReceiverOverflow() {
        assertEquals(EconomyResult.INVALID_AMOUNT, ledger.transfer(alice, alice, "coins", 1L, "pay"));
        assertEquals(EconomyResult.INSUFFICIENT, ledger.transfer(alice, bob, "coins", 10_001L, "pay"));

        ledger.restore(bob, "coins", Money.MAX);
        assertEquals(EconomyResult.INVALID_AMOUNT, ledger.transfer(alice, bob, "coins", 1L, "pay"));
        assertEquals(OptionalLong.of(10_000L), ledger.balance(alice, "coins")); // 付款方沒被扣
        assertTrue(log.isEmpty());
    }

    @Test
    void unknownCurrencyIsAProgrammingError() {
        assertThrows(IllegalArgumentException.class, () -> ledger.balance(alice, "nope"));
    }

    @Test
    void parserAcceptsShortSuffixesAndRejectsGarbage() {
        assertEquals(OptionalLong.of(150_000L), AmountParser.parse("1.5k", 2));   // 1,500.00
        assertEquals(OptionalLong.of(300_000_000L), AmountParser.parse("3M", 2)); // 3,000,000.00
        assertEquals(OptionalLong.of(4_000_000_000L), AmountParser.parse("4b", 0));
        assertEquals(OptionalLong.of(1_250L), AmountParser.parse("12.5", 2));

        for (String bad : new String[] {"-5", "NaN", "Infinity", "1e3", "1,000", "1.234", "1.234567k", "k", "", " ",
            "12.5.1", "9999999999999999999", "5 coins"}) {
            assertTrue(AmountParser.parse(bad, 2).isEmpty(), "should reject: " + bad);
        }
        assertTrue(AmountParser.parse("1.5", 0).isEmpty()); // 整數幣不收小數
        assertTrue(AmountParser.parse("9000000000001", 2).isPresent());   // 約 9e12 主單位 = 9e14 最小單位，在上限內
        assertTrue(AmountParser.parse("90000000000000b", 0).isEmpty());   // 超過 Money.MAX
    }

    @Test
    void formatTruncatesInsteadOfRoundingUp() {
        assertEquals("1,234.50", MoneyFormat.number(123_450L, COINS));
        assertEquals("$ 1,234.50", MoneyFormat.full(123_450L, COINS));
        assertEquals("999.99", MoneyFormat.shortNumber(99_999L, COINS));
        assertEquals("1.9k", MoneyFormat.shortNumber(199_999L, COINS)); // 1,999.99 → 1.9k，不是 2k
        assertEquals("1k", MoneyFormat.shortNumber(100_000L, COINS));
        assertEquals("3m", MoneyFormat.shortNumber(300_000_000L, COINS));
        assertEquals("4b", MoneyFormat.shortNumber(4_000_000_000L, GEMS));
    }

    @Test
    void vaultDoubleBoundaryRoundsToMinorUnits() {
        assertEquals(OptionalLong.of(30L), Money.toMinor(0.1 + 0.2, 2)); // 0.30000000000000004
        assertEquals(OptionalLong.of(1L), Money.toMinor(0.005, 2));       // HALF_UP
        assertFalse(Money.toMinor(Double.NaN, 2).isPresent());
        assertFalse(Money.toMinor(-1.0, 2).isPresent());
        assertFalse(Money.toMinor(Double.POSITIVE_INFINITY, 2).isPresent());
    }
}
```

---

## 範例 2：以託管完成「買物品」交易（交貨丟例外時錢與物品都不丟）

**Input:**
```
情境: 買方 Alice 用 coins 向賣方 Bob 買 16 個鑽石；庫存以 Map 表示（真實插件換成 Inventory 操作，規則相同）
需求: 缺貨 → 退款；交貨途中丟例外 → 物品還回賣方、錢退回買方、例外繼續往外丟
```

**Output — `Delivery` 內先還原物品再重拋；退款由 `Escrow.trade` 的 `finally` 負責:**
```java
package com.example.economy.trade;

import com.example.economy.domain.Escrow;
import com.example.economy.domain.Escrow.Outcome;
import com.example.economy.domain.Escrow.TradeResult;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** 在主執行緒呼叫。stock 是「玩家 → 物品 → 數量」，只用來示範還原順序。 */
public final class ItemTrade {

    private final Escrow escrow;
    private final Map<UUID, Map<String, Integer>> stock;

    public ItemTrade(Escrow escrow, Map<UUID, Map<String, Integer>> stock) {
        this.escrow = escrow;
        this.stock = stock;
    }

    public TradeResult buy(UUID buyer, UUID seller, String item, int count, String currency, long price) {
        return escrow.trade(buyer, seller, currency, price, "market:" + item, () -> transfer(seller, buyer, item, count));
    }

    /** 缺貨回 false（Escrow 會退款）；中途失敗先把已搬動的物品搬回，再重拋讓 Escrow 退款。 */
    private boolean transfer(UUID from, UUID to, String item, int count) {
        Map<String, Integer> source = stock.computeIfAbsent(from, k -> new HashMap<>());
        if (source.getOrDefault(item, 0) < count) {
            return false;
        }
        source.merge(item, -count, Integer::sum);
        try {
            grant(to, item, count);
            return true;
        } catch (RuntimeException e) {
            source.merge(item, count, Integer::sum); // 先還物品
            throw e;                                 // 再重拋；錢由 Escrow 的 finally 退
        }
    }

    /** 真實插件：把物品放進買方背包，放不下的掉在腳下或丟例外。 */
    private void grant(UUID to, String item, int count) {
        stock.computeIfAbsent(to, k -> new HashMap<>()).merge(item, count, Integer::sum);
    }

    public static String describe(TradeResult result) {
        return switch (result.outcome()) {
            case SETTLED -> "Purchase complete.";
            case NOT_RESERVED -> "You cannot afford this (" + result.funds() + ").";
            case DECLINED -> "The seller does not have enough stock. You were not charged.";
            case SETTLEMENT_FAILED -> "The seller cannot receive that much money. You were not charged.";
        };
    }

    public static boolean succeeded(TradeResult result) {
        return result.outcome() == Outcome.SETTLED;
    }
}
```

**JUnit — 驗證「例外時錢退回」的不變量:**
```java
package com.example.economy.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.example.economy.domain.Escrow.Outcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.OptionalLong;
import java.util.UUID;

class EscrowTest {

    private static final Currency COINS = new Currency("coins", "$", 2, "#,##0", 10_000L);

    private final UUID buyer = UUID.randomUUID();
    private final UUID seller = UUID.randomUUID();
    private Ledger ledger;
    private Escrow escrow;

    @BeforeEach
    void setUp() {
        ledger = new Ledger(List.of(COINS), () -> 0L, batch -> { });
        ledger.open(buyer);
        ledger.open(seller);
        escrow = new Escrow(ledger);
    }

    @Test
    void settlesWhenDeliverySucceeds() {
        var result = escrow.trade(buyer, seller, "coins", 2_500L, "t", () -> true);
        assertEquals(Outcome.SETTLED, result.outcome());
        assertEquals(OptionalLong.of(7_500L), ledger.balance(buyer, "coins"));
        assertEquals(OptionalLong.of(12_500L), ledger.balance(seller, "coins"));
    }

    @Test
    void refundsWhenDeliveryDeclines() {
        var result = escrow.trade(buyer, seller, "coins", 2_500L, "t", () -> false);
        assertEquals(Outcome.DECLINED, result.outcome());
        assertEquals(OptionalLong.of(10_000L), ledger.balance(buyer, "coins"));
        assertEquals(OptionalLong.of(10_000L), ledger.balance(seller, "coins"));
    }

    @Test
    void refundsAndRethrowsWhenDeliveryThrows() {
        assertThrows(IllegalStateException.class, () ->
            escrow.trade(buyer, seller, "coins", 2_500L, "t", () -> {
                throw new IllegalStateException("inventory exploded");
            }));
        assertEquals(OptionalLong.of(10_000L), ledger.balance(buyer, "coins")); // 錢沒丟
        assertEquals(OptionalLong.of(10_000L), ledger.balance(seller, "coins"));
    }

    @Test
    void refundsWhenSellerCannotReceive() {
        ledger.restore(seller, "coins", Money.MAX);
        var result = escrow.trade(buyer, seller, "coins", 2_500L, "t", () -> true);
        assertEquals(Outcome.SETTLEMENT_FAILED, result.outcome());
        assertEquals(OptionalLong.of(10_000L), ledger.balance(buyer, "coins"));
    }

    @Test
    void nothingReservedWhenBuyerIsBroke() {
        var result = escrow.trade(buyer, seller, "coins", 10_001L, "t", () -> {
            throw new AssertionError("must not deliver without payment");
        });
        assertEquals(Outcome.NOT_RESERVED, result.outcome());
    }
}
```

---

## 範例 3：`/pay` 指令（解析簡寫金額、轉帳、顯示結果）

**Input:**
```
指令: /pay <player> <amount>   例如 /pay Bob 1.5k
幣種: coins
```

**Output — 指令只做「解析 → 呼叫 API → 把結果翻成訊息」；訊息用純文字金額，不拼接 Vault 的 format():**
```java
package com.example.economy.command;

import com.example.economy.api.EconomyApi;
import com.example.economy.api.EconomyResult;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.OfflinePlayer;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.OptionalLong;

public final class PayCommand implements CommandExecutor {

    private static final String CURRENCY = "coins";

    private final EconomyApi api;

    public PayCommand(EconomyApi api) {
        this.api = api;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player payer)) {
            sender.sendMessage(Component.text("Only players can pay."));
            return true;
        }
        if (args.length != 2) {
            return false; // 顯示 plugin.yml 的 usage
        }
        OfflinePlayer target = Bukkit.getOfflinePlayerIfCached(args[0]);
        OptionalLong amount = api.parse(CURRENCY, args[1]);
        if (target == null || !api.hasAccount(target.getUniqueId())) {
            payer.sendMessage(Component.text("Unknown player."));
            return true;
        }
        if (amount.isEmpty()) {
            payer.sendMessage(Component.text("Invalid amount. Examples: 100, 12.5, 1.5k, 3m."));
            return true;
        }
        EconomyResult result = api.transfer(payer.getUniqueId(), target.getUniqueId(), CURRENCY, amount.getAsLong(), "pay");
        String shown = api.format(CURRENCY, amount.getAsLong()); // 純文字：Component.text 不會解析色碼，也不經 MiniMessage
        payer.sendMessage(Component.text(switch (result) {
            case OK -> "Sent " + shown + " to " + target.getName() + ".";
            case INSUFFICIENT -> "You do not have " + shown + ".";
            case NO_ACCOUNT -> "That player has no account.";
            case INVALID_AMOUNT -> "That amount is not allowed.";
        }));
        return true;
    }
}
```

**消費別人 Vault 提供端的 `format()` 時（舊式色碼要轉成 Component，不能進 MiniMessage）:**
```java
package com.example.economy.command;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.legacy.LegacyComponentSerializer;

public final class VaultText {

    private VaultText() {
    }

    /** Economy.format() 可能回傳 "§a$100.00" 或 "&a$100.00"：先統一成 §，再轉成 Component。 */
    public static Component fromFormat(String formatted) {
        return LegacyComponentSerializer.legacySection().deserialize(formatted.replace('&', '§'));
    }
}
```
