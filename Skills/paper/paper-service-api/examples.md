# examples — paper-service-api

## 範例 1：Shop 購買時透過 Wallet 扣款

**Input:**
```
provider_plugin: Wallet
api_package: com.example.wallet.api
api_name: WalletApi
consumer_package: com.example.shop.integration
operations: withdraw
```

**Output — 使用端在主執行緒呼叫 Hook，失敗時給玩家明確訊息:**
```java
import com.example.shop.integration.WalletHook;
import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;

public final class PurchaseService {

    private final WalletHook wallet;

    public PurchaseService(WalletHook wallet) {
        this.wallet = wallet;
    }

    /** 在主執行緒呼叫（例如 GUI 點擊事件中）。 */
    public boolean buy(Player player, long price) {
        if (!wallet.available()) {
            player.sendMessage(Component.text("The shop is temporarily unavailable."));
            return false;
        }
        if (!wallet.withdraw(player.getUniqueId(), price, "Shop")) {
            player.sendMessage(Component.text("You cannot afford this item."));
            return false;
        }
        return true;
    }
}
```

---

## 範例 2：在既有 API 新增方法（只加不改）

**Input:**
```
api_name: WalletApi
change: 新增「轉帳」操作
```

**Output — 新方法加在介面最後；舊方法完全不動:**
```java
package com.example.wallet.api;

import java.util.OptionalLong;
import java.util.UUID;

public interface WalletApi {

    OptionalLong balance(UUID player);

    ApiResult deposit(UUID player, long amount, String note);

    ApiResult withdraw(UUID player, long amount, String note);

    /**
     * 轉帳（v2 新增）。舊版 Wallet 沒有此方法：
     * 使用端呼叫時會丟 NoSuchMethodError / AbstractMethodError，由 Hook 的 LinkageError 處理接住。
     */
    ApiResult transfer(UUID from, UUID to, long amount, String note);
}
```

**使用端 Hook 新增對應方法:**
```java
    /** 舊版 Wallet 沒有 transfer 時回 false 並警告一次。 */
    public boolean transfer(UUID from, UUID to, long amount, String note) {
        if (!available()) return false;
        try {
            WalletApi api = plugin.getServer().getServicesManager().load(WalletApi.class);
            return api != null && api.transfer(from, to, amount, note) == ApiResult.OK;
        } catch (LinkageError e) {
            warnOnce(e);
            return false;
        }
    }
```

---

## 範例 3：多模組建置與部署順序

**Input:**
```
build: Gradle 多模組（wallet、shop）
```

**Output — settings 與使用端依賴:**
```groovy
// settings.gradle
include 'wallet', 'shop'

// shop/build.gradle
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly project(':wallet')
}
```

**使用端 plugin.yml:**
```yaml
name: Shop
main: com.example.shop.ShopPlugin
api-version: '26.2'
softdepend: [Wallet]
```

部署檢查：
- 先確認 `shop` 的 jar 內**沒有** `com/example/wallet/api/`（`unzip -l` 檢查），否則會發生同名不同類
- 修改 API 後，提供端與所有使用端的 jar 一起更新
