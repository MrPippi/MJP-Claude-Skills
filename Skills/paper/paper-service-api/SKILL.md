---
name: paper-service-api
description: "透過 Bukkit ServicesManager 發布與取用跨插件 API：只加不改的 api 介面、提供端註冊、使用端 Hook（每次 load、容忍版本落差）/ Cross-plugin API via ServicesManager with add-only interfaces and version-skew-tolerant consumer hooks"
---

# Paper Service API

## Skill Name

`paper-service-api`

## Purpose

Lets plugins in the same plugin suite call each other safely (for example, Shop charging money from Economy, or Chat showing a flag from Country).
Each plugin's jar relocates its shared code separately, so they cannot share types directly. The provider therefore registers an **`api` interface that uses only JDK types** with the Bukkit `ServicesManager`, and the consumer depends on it as `compileOnly` and looks it up at runtime.

The key concern is handling "the two jars are different versions": when the consumer is newer than the provider, calling a method that does not exist throws `NoSuchMethodError` / `AbstractMethodError` (both are `LinkageError`). The hook must catch it and degrade, instead of letting the whole feature crash.

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (uses only the Bukkit `ServicesManager`, identical on both versions)
- Pure Paper API, no Paperweight needed

## Triggers

- 「跨插件 API」「cross-plugin API」「ServicesManager」「service provider」
- 「插件之間呼叫」「別的插件取得資料」「API 介面」「api package」
- 「NoSuchMethodError」「AbstractMethodError」「API 版本不合」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `provider_plugin` | `Wallet` | The plugin that provides the API (plugin.yml `name`) |
| `api_package` | `com.example.wallet.api` | Package containing the API interface (**must not be relocated**) |
| `api_name` | `WalletApi` | Interface name |
| `consumer_package` | `com.example.shop.integration` | Package containing the consumer hook |
| `operations` | `balance`, `withdraw` | Operations to expose |

## Outputs

- `WalletApi.java` - the provider's API interface (JDK types only, add-only)
- `ApiResult.java` - operation result enum (replaces exceptions so callers can handle results easily)
- `WalletApiImpl.java` - provider implementation (checks the main thread)
- `WalletPlugin.java` - provider registration / unregistration
- `WalletHook.java` - consumer hook (loads on every call, catches `LinkageError`, warns only once)

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). In a multi-module project, the consumer depends on the provider with `compileOnly`:

```groovy
// shop/build.gradle
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly project(':wallet')   // only so WalletApi is visible at compile time; must not be packaged into the jar
}
```

The consumer's `plugin.yml` declares `softdepend: [Wallet]` (the feature is optional) or `depend: [Wallet]` (do not start without it).

## Code Template

### `WalletApi.java` (provider, api package)

```java
package com.example.wallet.api;

import java.util.OptionalLong;
import java.util.UUID;

/**
 * The interface Wallet exposes to other plugins.
 *
 * <p>How to obtain it: {@code getServer().getServicesManager().load(WalletApi.class)}, <b>load it before each call and do not cache it</b>;
 * null means Wallet is not enabled.
 *
 * <p>Rules:
 * <ul>
 *   <li>Use JDK types only (no Bukkit types or this plugin's internal types) to avoid relocation and class loading problems</li>
 *   <li><b>Add-only</b>: published methods must not change signature or be removed; add new methods at the end of the interface</li>
 *   <li>All methods may be called only on the main thread, otherwise {@link IllegalStateException} is thrown</li>
 * </ul>
 */
public interface WalletApi {

    /** No account -> empty. Amounts are in the smallest unit (for example 1 dollar = 100). */
    OptionalLong balance(UUID player);

    /** Deposit; amount &lt; 0 -> INVALID_AMOUNT. note is the caller's self-reported source, stored in the transaction log. */
    ApiResult deposit(UUID player, long amount, String note);

    /** Withdraw; insufficient balance -> INSUFFICIENT, balance unchanged. */
    ApiResult withdraw(UUID player, long amount, String note);
}
```

### `ApiResult.java` (provider, api package)

```java
package com.example.wallet.api;

/** API operation result. New values may only be added at the end (add-only). */
public enum ApiResult {
    OK,
    NO_ACCOUNT,
    INSUFFICIENT,
    INVALID_AMOUNT
}
```

### `WalletApiImpl.java` (provider implementation)

```java
package com.example.wallet;

import com.example.wallet.api.ApiResult;
import com.example.wallet.api.WalletApi;
import org.bukkit.Bukkit;

import java.util.Map;
import java.util.OptionalLong;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory ledger for the example; in practice replace it with the Repository from paper-sqlite-repository. */
final class WalletApiImpl implements WalletApi {

    private final Map<UUID, Long> balances = new ConcurrentHashMap<>();

    @Override
    public OptionalLong balance(UUID player) {
        requireMainThread();
        Long value = balances.get(player);
        return value == null ? OptionalLong.empty() : OptionalLong.of(value);
    }

    @Override
    public ApiResult deposit(UUID player, long amount, String note) {
        requireMainThread();
        if (amount < 0) return ApiResult.INVALID_AMOUNT;
        balances.merge(player, amount, Long::sum);
        return ApiResult.OK;
    }

    @Override
    public ApiResult withdraw(UUID player, long amount, String note) {
        requireMainThread();
        if (amount < 0) return ApiResult.INVALID_AMOUNT;
        Long current = balances.get(player);
        if (current == null) return ApiResult.NO_ACCOUNT;
        if (current < amount) return ApiResult.INSUFFICIENT;
        balances.put(player, current - amount);
        return ApiResult.OK;
    }

    private static void requireMainThread() {
        if (!Bukkit.isPrimaryThread()) {
            throw new IllegalStateException("WalletApi must be called on the main thread");
        }
    }
}
```

### `WalletPlugin.java` (provider registration)

```java
package com.example.wallet;

import com.example.wallet.api.WalletApi;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

public final class WalletPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        // Register only after the rest of initialization (config, database) is done, so consumers get a usable implementation
        getServer().getServicesManager().register(WalletApi.class, new WalletApiImpl(), this, ServicePriority.Normal);
    }

    @Override
    public void onDisable() {
        getServer().getServicesManager().unregisterAll(this);
    }
}
```

### `WalletHook.java` (consumer)

```java
package com.example.shop.integration;

import com.example.wallet.api.ApiResult;
import com.example.wallet.api.WalletApi;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.OptionalLong;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Consumer-side entry point for Wallet.
 *
 * <p>Rules:
 * <ul>
 *   <li>{@code WalletApi} appears only inside the {@code try} of a method body (not in fields or method signatures),
 *       so this class can still be loaded when Wallet is not installed</li>
 *   <li>Call {@code load} again on every call: after Wallet is reloaded or disabled you never get a stale implementation</li>
 *   <li>Catch {@link LinkageError}: when the two jars are different versions (calling a method the other side lacks), degrade and warn only once</li>
 * </ul>
 */
public final class WalletHook {

    public static final String PLUGIN_NAME = "Wallet";

    private final JavaPlugin plugin;
    private boolean warned;

    public WalletHook(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public boolean available() {
        return plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME);
    }

    /** Returns empty when Wallet is unavailable or the version mismatches. Call only on the main thread. */
    public OptionalLong balance(UUID player) {
        if (!available()) return OptionalLong.empty();
        try {
            WalletApi api = plugin.getServer().getServicesManager().load(WalletApi.class);
            return api == null ? OptionalLong.empty() : api.balance(player);
        } catch (LinkageError e) {
            warnOnce(e);
            return OptionalLong.empty();
        }
    }

    /** Returns true on a successful withdrawal; false when Wallet is unavailable, the balance is insufficient, or the version mismatches. Call only on the main thread. */
    public boolean withdraw(UUID player, long amount, String note) {
        if (!available()) return false;
        try {
            WalletApi api = plugin.getServer().getServicesManager().load(WalletApi.class);
            return api != null && api.withdraw(player, amount, note) == ApiResult.OK;
        } catch (LinkageError e) {
            warnOnce(e);
            return false;
        }
    }

    private void warnOnce(LinkageError e) {
        if (warned) return;
        warned = true;
        plugin.getLogger().log(Level.WARNING,
            PLUGIN_NAME + " API version mismatch; update both jars together. Feature disabled.", e);
    }
}
```

## Recommended Directory Structure

```
wallet/                                   <- provider
└── src/main/java/com/example/wallet/
    ├── WalletPlugin.java
    ├── WalletApiImpl.java
    └── api/                              <- do not relocate, add-only
        ├── WalletApi.java
        └── ApiResult.java
shop/                                     <- consumer (compileOnly project(':wallet'))
└── src/main/java/com/example/shop/
    └── integration/
        └── WalletHook.java
```

## Thread Safety

- Provider methods are **main-thread only** by default (`requireMainThread()`); state this in the Javadoc
- If the consumer needs data during an async phase, fetch the value on the main thread first and pass it into the async task; do not call the API from an async thread
- If a method must really support any thread (for example PlaceholderAPI reads), the implementation must read an immutable snapshot and say so in the Javadoc
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| `NoSuchMethodError` / `AbstractMethodError` | The consumer is newer than the provider and called a method the provider lacks | The hook catches `LinkageError` and degrades; update both jars together when deploying |
| `NoClassDefFoundError: .../WalletApi` | The provider is not installed, and `WalletApi` appears in a field or method signature | Keep the API type only inside the `try` of a method body |
| `ClassCastException` (same name, different class) | The API package was shaded/relocated into the consumer jar | Depend on the API with `compileOnly` and do not package it; exclude that package in the shadow config |
| `load()` returns null | The provider is not enabled or starts later | Declare the provider in `softdepend` / `depend`; call `load` at call time |
| Got a stale implementation from before disable | The consumer cached the API instance | Do not cache; `load` every time |
| Old consumers break after an existing method signature was changed | Violates add-only | Add a new method instead of modifying; keep the old method and mark it `@Deprecated` |
