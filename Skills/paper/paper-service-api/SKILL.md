---
name: paper-service-api
description: "透過 Bukkit ServicesManager 發布與取用跨插件 API：只加不改的 api 介面、提供端註冊、使用端 Hook（每次 load、容忍版本落差）/ Cross-plugin API via ServicesManager with add-only interfaces and version-skew-tolerant consumer hooks"
---

# Paper Service API / 跨插件 API

## 技能名稱 / Skill Name

`paper-service-api`

## 目的 / Purpose

讓同一個插件集裡的插件安全地互相呼叫（例如 Shop 扣 Economy 的錢、Chat 顯示 Country 的國旗）。
各插件的 jar 會各自 relocate 共用程式碼，無法直接共享型別，因此提供端把**只含 JDK 型別的 `api` 介面**註冊到 Bukkit `ServicesManager`，使用端以 `compileOnly` 依賴並在執行期取得。

重點是處理「兩個 jar 版本不一致」：使用端比提供端新時，呼叫到不存在的方法會丟 `NoSuchMethodError` / `AbstractMethodError`（都是 `LinkageError`），Hook 必須接住並降級，而不是讓整個功能崩潰。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（只用 Bukkit `ServicesManager`，兩版相同）
- 純 Paper API，不需要 Paperweight

## 觸發條件 / Triggers

- 「跨插件 API」「cross-plugin API」「ServicesManager」「service provider」
- 「插件之間呼叫」「別的插件取得資料」「API 介面」「api package」
- 「NoSuchMethodError」「AbstractMethodError」「API 版本不合」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `provider_plugin` | `Wallet` | 提供 API 的插件（plugin.yml `name`） |
| `api_package` | `com.example.wallet.api` | API 介面所在 package（**不可被 relocate**） |
| `api_name` | `WalletApi` | 介面名稱 |
| `consumer_package` | `com.example.shop.integration` | 使用端 Hook 所在 package |
| `operations` | `balance`, `withdraw` | 要開放的操作 |

## 輸出產物 / Outputs

- `WalletApi.java` — 提供端的 API 介面（只用 JDK 型別、只加不改）
- `ApiResult.java` — 操作結果 enum（取代例外，讓呼叫端好處理）
- `WalletApiImpl.java` — 提供端實作（檢查主執行緒）
- `WalletPlugin.java` — 提供端註冊／取消註冊
- `WalletHook.java` — 使用端 Hook（每次 load、接 `LinkageError`、只警告一次）

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。多模組專案中，使用端以 `compileOnly` 依賴提供端：

```groovy
// shop/build.gradle
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly project(':wallet')   // 只為了編譯期看得到 WalletApi，不可打包進 jar
}
```

使用端 `plugin.yml` 宣告 `softdepend: [Wallet]`（功能可缺）或 `depend: [Wallet]`（缺了就不啟動）。

## 代碼範本 / Code Template

### `WalletApi.java`（提供端，api package）

```java
package com.example.wallet.api;

import java.util.OptionalLong;
import java.util.UUID;

/**
 * Wallet 給其他插件使用的介面。
 *
 * <p>取得方式：{@code getServer().getServicesManager().load(WalletApi.class)}，<b>每次呼叫前取一次、不要快取</b>；
 * null 代表 Wallet 未啟用。
 *
 * <p>規則：
 * <ul>
 *   <li>只用 JDK 型別（不要出現 Bukkit 或本插件內部型別），避免 relocate 與 class 載入問題</li>
 *   <li><b>只加不改</b>：已發布的方法不得改簽名或刪除；新增方法放在介面最後</li>
 *   <li>所有方法只能在主執行緒呼叫，否則丟 {@link IllegalStateException}</li>
 * </ul>
 */
public interface WalletApi {

    /** 無帳號 → empty。金額單位為最小單位（例如 1 元 = 100）。 */
    OptionalLong balance(UUID player);

    /** 入帳；amount &lt; 0 → INVALID_AMOUNT。note 為呼叫端自報來源，存入交易紀錄。 */
    ApiResult deposit(UUID player, long amount, String note);

    /** 扣款；餘額不足 → INSUFFICIENT，餘額不變。 */
    ApiResult withdraw(UUID player, long amount, String note);
}
```

### `ApiResult.java`（提供端，api package）

```java
package com.example.wallet.api;

/** API 操作結果。新增值只能加在最後（只加不改）。 */
public enum ApiResult {
    OK,
    NO_ACCOUNT,
    INSUFFICIENT,
    INVALID_AMOUNT
}
```

### `WalletApiImpl.java`（提供端實作）

```java
package com.example.wallet;

import com.example.wallet.api.ApiResult;
import com.example.wallet.api.WalletApi;
import org.bukkit.Bukkit;

import java.util.Map;
import java.util.OptionalLong;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** 範例用的記憶體帳本；實務上換成 paper-sqlite-repository 的 Repository。 */
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

### `WalletPlugin.java`（提供端註冊）

```java
package com.example.wallet;

import com.example.wallet.api.WalletApi;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

public final class WalletPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        // 其餘初始化（設定、資料庫）完成後才註冊，確保使用端拿到的是可用的實作
        getServer().getServicesManager().register(WalletApi.class, new WalletApiImpl(), this, ServicePriority.Normal);
    }

    @Override
    public void onDisable() {
        getServer().getServicesManager().unregisterAll(this);
    }
}
```

### `WalletHook.java`（使用端）

```java
package com.example.shop.integration;

import com.example.wallet.api.ApiResult;
import com.example.wallet.api.WalletApi;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.OptionalLong;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Wallet 的使用端接點。
 *
 * <p>規則：
 * <ul>
 *   <li>{@code WalletApi} 只出現在方法本體的 {@code try} 裡（不放欄位、不放方法簽名），
 *       Wallet 未安裝時本類別仍可被載入</li>
 *   <li>每次呼叫都重新 {@code load}：Wallet 被 reload／停用後不會拿到舊實作</li>
 *   <li>接 {@link LinkageError}：兩個 jar 版本不一致（呼叫到對方沒有的方法）時降級並只警告一次</li>
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

    /** Wallet 不可用或版本不合時回 empty。只在主執行緒呼叫。 */
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

    /** 扣款成功回 true；Wallet 不可用、餘額不足或版本不合回 false。只在主執行緒呼叫。 */
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

## 推薦目錄結構 / Recommended Directory Structure

```
wallet/                                   ← 提供端
└── src/main/java/com/example/wallet/
    ├── WalletPlugin.java
    ├── WalletApiImpl.java
    └── api/                              ← 不可 relocate、只加不改
        ├── WalletApi.java
        └── ApiResult.java
shop/                                     ← 使用端（compileOnly project(':wallet')）
└── src/main/java/com/example/shop/
    └── integration/
        └── WalletHook.java
```

## 執行緒安全注意事項 / Thread Safety

- 提供端方法預設**只允許主執行緒**（`requireMainThread()`），在 Javadoc 寫明
- 使用端若在非同步階段需要資料，先在主執行緒取值再傳入非同步工作；不要在非同步執行緒呼叫 API
- 若某方法確實要支援任意執行緒（例如 PlaceholderAPI 讀取），實作必須讀不可變快照，並在 Javadoc 標明
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `NoSuchMethodError` / `AbstractMethodError` | 使用端比提供端新，呼叫了對方沒有的方法 | Hook 接 `LinkageError` 降級；部署時兩個 jar 一起更新 |
| `NoClassDefFoundError: .../WalletApi` | 提供端未安裝，且 `WalletApi` 出現在欄位或方法簽名 | 讓 API 型別只出現在方法本體的 `try` 內 |
| `ClassCastException`（同名不同類） | API package 被 shade/relocate 進使用端 jar | API 以 `compileOnly` 依賴，不打包；shadow 設定排除該 package |
| `load()` 回 null | 提供端未啟用、啟動順序較晚 | `softdepend`／`depend` 宣告提供端；每次呼叫時才 `load` |
| 拿到停用前的舊實作 | 使用端快取了 API 實例 | 不快取，每次 `load` |
| 改了既有方法簽名後舊使用端壞掉 | 違反只加不改 | 新增方法取代修改；舊方法保留並標 `@Deprecated` |
