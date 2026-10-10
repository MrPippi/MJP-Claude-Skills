# examples - paper-service-api

## Example 1: Shop charges through Wallet on purchase

**Input:**
```
provider_plugin: Wallet
api_package: com.example.wallet.api
api_name: WalletApi
consumer_package: com.example.shop.integration
operations: withdraw
```

**Output - the consumer calls the hook on the main thread and gives the player a clear message on failure:**
```java
import com.example.shop.integration.WalletHook;
import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;

public final class PurchaseService {

    private final WalletHook wallet;

    public PurchaseService(WalletHook wallet) {
        this.wallet = wallet;
    }

    /** Call on the main thread (for example inside a GUI click event). */
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

## Example 2: Add a method to an existing API (add-only)

**Input:**
```
api_name: WalletApi
change: add a "transfer" operation
```

**Output - the new method goes at the end of the interface; existing methods are untouched (excerpt; `package` and imports are the same as in SKILL.md):**
```java
public interface WalletApi {

    OptionalLong balance(UUID player);

    ApiResult deposit(UUID player, long amount, String note);

    ApiResult withdraw(UUID player, long amount, String note);

    /**
     * Transfer (added in v2). Older Wallet versions lack this method:
     * the consumer's call throws NoSuchMethodError / AbstractMethodError, which the hook's LinkageError handling catches.
     */
    ApiResult transfer(UUID from, UUID to, long amount, String note);
}
```

**The provider's `WalletApiImpl` implements the new method (released in the same jar):**
```java
    @Override
    public ApiResult transfer(UUID from, UUID to, long amount, String note) {
        requireMainThread();
        ApiResult taken = withdraw(from, amount, note);
        if (taken != ApiResult.OK) return taken;
        return deposit(to, amount, note);
    }
```

**Add the matching method to the consumer hook:**
```java
    /** Returns false and warns once when an older Wallet has no transfer. */
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

## Example 3: Multi-module build and deployment order

**Input:**
```
build: Gradle multi-module (wallet, shop)
```

**Output - settings and consumer dependency:**
```groovy
// settings.gradle
include 'wallet', 'shop'

// shop/build.gradle
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly project(':wallet')
}
```

**Consumer plugin.yml:**
```yaml
name: Shop
main: com.example.shop.ShopPlugin
api-version: '26.2'
softdepend: [Wallet]
```

Deployment checks:
- First confirm the `shop` jar does **not** contain `com/example/wallet/api/` (check with `unzip -l`), otherwise you get a same-name-different-class problem
- After changing the API, update the provider and all consumer jars together
