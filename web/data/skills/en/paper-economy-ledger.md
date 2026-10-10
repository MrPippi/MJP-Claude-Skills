# Paper Economy Ledger

## Purpose

Give a plugin its own economy core where money is never miscounted and never vanishes. Amounts are always `long` minor units; `Ledger` is pure Java with no Bukkit types, and its operations return `OK / INSUFFICIENT / NO_ACCOUNT / INVALID_AMOUNT`; every change produces an append-only `Transaction`, persisted through a write-behind queue; expose an internal API first, then optionally register a Vault `Economy`.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (same code on both versions, compile-verified)
- Pure Paper API + `compileOnly` VaultAPI 1.7.1, no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### Ledger.java (pure ledger, core operation)

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

### AmountParser.java (k / m / b shorthand)

```java
AmountParser.parse("1.5k", 2);   // OptionalLong.of(150_000)  -> 1,500.00
AmountParser.parse("-5", 2);     // empty
AmountParser.parse("1e3", 2);    // empty
AmountParser.parse("1.234", 2);  // empty (finer decimals than the currency allows)
```

### Escrow.java (escrow: refund even if delivery throws)

```java
Hold hold = reserve(buyer, currency, price, note);
if (!hold.isOpen()) return new TradeResult(Outcome.NOT_RESERVED, hold.reserved());
try {
    if (!delivery.deliver()) return new TradeResult(Outcome.DECLINED, EconomyResult.OK);
    EconomyResult paid = hold.settle(seller);
    return paid == EconomyResult.OK ? new TradeResult(Outcome.SETTLED, paid) : new TradeResult(Outcome.SETTLEMENT_FAILED, paid);
} finally {
    if (hold.isOpen()) hold.refund();   // no path leaves money dangling
}
```

### VaultHook.java (register at Highest priority)

```java
plugin.getServer().getServicesManager().register(
    Economy.class,
    new VaultEconomyProvider(api, vaultCurrency, plugin.getServer()),
    plugin,
    ServicePriority.Highest);
```

---

## Rules

- Amounts are always `long` minor units; `double` appears only at the Vault boundary, rounded via `BigDecimal` (`0.1 + 0.2` -> `0.30`)
- Player input goes through `AmountParser`, not `Double.parseDouble` (which accepts `NaN` and `1e3`)
- Always add with `Math.addExact` plus a cap check; overflow returns `INVALID_AMOUNT`; any non-`OK` result guarantees the balance is unchanged
- `Economy.format()` may contain legacy color codes and must not be fed into MiniMessage; use `LegacyComponentSerializer` or plain text
- Vault types appear only in the `vault/` package; check `isPluginEnabled("Vault")` before constructing

---

## Thread Safety

- `Ledger` / `Escrow` assume a single thread; `EconomyApi` and the Vault provider are restricted to the main thread
- Persistence runs only on a single writer thread, and `onDisable` drains the queue synchronously
