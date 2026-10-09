---
id: paper-economy-ledger
title: Paper Economy Ledger
titleZh: 插件內建經濟帳本
description: An in-plugin economy core with long minor-unit amounts, multi-currency pure Ledger, append-only transaction log, k/m/b parsing, exception-safe escrow, write-behind persistence, an internal API and an optional Vault Economy provider.
descriptionZh: 插件內建經濟核心：long 最小單位金額、多幣種純 Ledger、只增不改交易紀錄、k/m/b 簡寫、例外安全的託管、write-behind 持久化、內部 API 與選用 Vault 提供端。
version: "1.0.0"
status: active
category: paper-gameplay
categoryLabel: Paper 玩法
categoryLabelEn: Paper Gameplay
tags: [paper-api, economy, ledger, vault, escrow, minor-units]
triggerKeywords:
  - "經濟"
  - "economy"
  - "ledger"
  - "multi-currency"
  - "escrow"
  - "Vault Economy 提供端"
  - "k m b"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-economy-ledger/SKILL.md
featured: false
---

# Paper Economy Ledger

## 目的

讓插件自帶一個「錢不會算錯、不會憑空消失」的經濟核心。金額一律是 `long` 最小單位；`Ledger` 是不含 Bukkit 型別的純 Java，操作回傳 `OK / INSUFFICIENT / NO_ACCOUNT / INVALID_AMOUNT`；每次異動都產生只增不改的 `Transaction`，經 write-behind 佇列落地；對外先給內部 API，再選用註冊 Vault `Economy`。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版程式碼相同，皆經編譯驗證）
- 純 Paper API + `compileOnly` VaultAPI 1.7.1，不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### Ledger.java（純帳本，核心操作）

```java
public EconomyResult withdraw(UUID account, String currencyId, long amount, String note) {
    if (amount <= 0 || amount > Money.MAX) return EconomyResult.INVALID_AMOUNT;
    Map<String, Long> wallet = accounts.get(account);
    if (wallet == null) return EconomyResult.NO_ACCOUNT;
    long current = wallet.getOrDefault(currencyId, 0L);
    if (current < amount) return EconomyResult.INSUFFICIENT;
    wallet.put(currencyId, current - amount);
    sink.accept(List.of(new Transaction(clock.getAsLong(), account, currencyId, -amount, current - amount, note)));
    return EconomyResult.OK;
}
```

### AmountParser.java（k／m／b 簡寫）

```java
AmountParser.parse("1.5k", 2);   // OptionalLong.of(150_000)  → 1,500.00
AmountParser.parse("-5", 2);     // empty
AmountParser.parse("1e3", 2);    // empty
AmountParser.parse("1.234", 2);  // empty（比幣種更細的小數）
```

### Escrow.java（託管：交貨丟例外也退款）

```java
Hold hold = reserve(buyer, currency, price, note);
if (!hold.isOpen()) return new TradeResult(Outcome.NOT_RESERVED, hold.reserved());
try {
    if (!delivery.deliver()) return new TradeResult(Outcome.DECLINED, EconomyResult.OK);
    EconomyResult paid = hold.settle(seller);
    return paid == EconomyResult.OK ? new TradeResult(Outcome.SETTLED, paid) : new TradeResult(Outcome.SETTLEMENT_FAILED, paid);
} finally {
    if (hold.isOpen()) hold.refund();   // 任何路徑離開都不讓錢懸空
}
```

### VaultHook.java（Highest 優先權註冊）

```java
plugin.getServer().getServicesManager().register(
    Economy.class,
    new VaultEconomyProvider(api, vaultCurrency, plugin.getServer()),
    plugin,
    ServicePriority.Highest);
```

---

## 規則

- 金額一律 `long` 最小單位；`double` 只在 Vault 邊界，經 `BigDecimal` 四捨五入（`0.1 + 0.2` → `0.30`）
- 玩家輸入走 `AmountParser`，不用 `Double.parseDouble`（會放行 `NaN`、`1e3`）
- 加法一律 `Math.addExact` 加上限檢查，溢位回 `INVALID_AMOUNT`；非 `OK` 的結果保證餘額沒變
- `Economy.format()` 可能含舊式色碼，不可餵進 MiniMessage；用 `LegacyComponentSerializer` 或純文字
- Vault 型別只出現在 `vault/` package，先 `isPluginEnabled("Vault")` 再建構

---

## 執行緒安全

- `Ledger`／`Escrow` 假設單執行緒；`EconomyApi` 與 Vault 提供端限主執行緒
- 持久化只在單一寫入執行緒，`onDisable` 同步排空佇列
