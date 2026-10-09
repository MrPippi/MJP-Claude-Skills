# examples — paper-softdepend-hook

## 範例 1：購買流程使用 Vault 扣款（沒裝 Vault 時優雅降級）

**Input:**
```
dependency: Vault
role: consumer
port_name: MoneyPort
integration_package: com.example.market.integration
```

**Output — 業務程式碼只依賴 `MoneyPort`，不 import 任何 Vault 類別:**
```java
import com.example.market.integration.MoneyPort;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.entity.Player;

public final class PurchaseService {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final MoneyPort money;

    public PurchaseService(MoneyPort money) {
        this.money = money;
    }

    /** 在主執行緒呼叫（例如 GUI 點擊事件中）。 */
    public boolean buy(Player player, double price) {
        if (!money.available()) {
            player.sendMessage(Component.text("The shop is temporarily unavailable."));
            return false;
        }
        if (!money.has(player.getUniqueId(), price)) {
            player.sendMessage(MINI.deserialize("<red>You need <price>.</red>",
                Placeholder.component("price", money.format(price))));
            return false;
        }
        if (!money.withdraw(player.getUniqueId(), price)) {
            player.sendMessage(Component.text("The payment was refused."));
            return false;
        }
        return true;
    }
}
```

重點：

- `money.format(price)` 回傳 `Component`（已把 `Economy.format()` 的 § 色碼解析掉），以 `Placeholder.component` 傳給 MiniMessage；不要寫成 `"<red>You need " + economy.format(price)`。
- 先 `has` 再 `withdraw` 之間仍可能被別的插件搶先扣款，所以 `withdraw` 的結果一定要檢查。
- Vault 沒有交易機制：一次「轉帳」是兩個獨立呼叫，先扣款、後入帳，扣款失敗就不要入帳。

---

## 範例 2：packetevents 軟依賴（Hook + Bridge + 封包監聽器）

**Input:**
```
dependency: packetevents
role: packet
purpose: 計算每個玩家收到的 SET_SLOT 封包數（示範用）
```

**Output — Hook（沒有 packetevents 型別）:**
```java
package com.example.market.packet;

import org.bukkit.plugin.Plugin;

import java.util.logging.Level;

/**
 * packetevents 的接點。沒有 packetevents 型別：監聽器以 Object 持有，真正碰型別的程式碼全在 {@link PacketEventsBridge}，
 * 只在 isPluginEnabled 為真之後才被觸碰，並接 LinkageError。
 */
public final class PacketEventsHook {

    public static final String PLUGIN_NAME = "packetevents";

    private final Plugin plugin;
    private final PacketStats stats;
    private Object listener;

    public PacketEventsHook(Plugin plugin, PacketStats stats) {
        this.plugin = plugin;
        this.stats = stats;
    }

    /** softdepend 保證 packetevents 在本插件之前啟用。 */
    public boolean install() {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
            plugin.getLogger().warning("packetevents not found; packet statistics are disabled.");
            return false;
        }
        try {
            listener = PacketEventsBridge.register(stats);
            return true;
        } catch (LinkageError | RuntimeException e) {
            plugin.getLogger().log(Level.WARNING, "packetevents is present but the listener could not be registered.", e);
            return false;
        }
    }

    /** 沒掛上就是 no-op。packetevents 若先被停用，它的監聽器已跟著消失，失敗只記 FINE。 */
    public void uninstall() {
        Object registered = listener;
        listener = null;
        if (registered == null) return;
        try {
            PacketEventsBridge.unregister(registered);
        } catch (LinkageError | RuntimeException e) {
            plugin.getLogger().log(Level.FINE, "Could not unregister the packet listener", e);
        }
    }
}
```

**Output — Bridge 與封包監聽器（唯一碰 packetevents 型別）:**
```java
package com.example.market.packet;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerCommon;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;

/**
 * 沒裝 packetevents 時這個類別永遠不能被載入。只註冊與撤銷監聽器，不呼叫 load()／init()／terminate()：
 * API 的生命週期屬於 packetevents 插件，其他插件掛在同一個實例上。
 */
final class PacketEventsBridge {

    private PacketEventsBridge() {
    }

    /** @return 已註冊的監聽器，撤銷時原樣交回 {@link #unregister} */
    static Object register(PacketStats stats) {
        return PacketEvents.getAPI().getEventManager().registerListener(new SlotCounter(stats));
    }

    static void unregister(Object listener) {
        PacketEvents.getAPI().getEventManager().unregisterListener((PacketListenerCommon) listener);
    }

    /** 跑在 Netty IO 執行緒：不呼叫 Bukkit API，只更新執行緒安全的計數器。 */
    private static final class SlotCounter extends PacketListenerAbstract {

        private final PacketStats stats;

        private SlotCounter(PacketStats stats) {
            this.stats = stats;
        }

        @Override
        public void onPacketSend(PacketSendEvent event) {
            if (event.getPacketType() == PacketType.Play.Server.SET_SLOT) {
                stats.increment();
            }
        }
    }
}
```

**Output — 與 packetevents 無關的計數器（可被任何執行緒安全讀寫）:**
```java
package com.example.market.packet;

import java.util.concurrent.atomic.LongAdder;

/** 封包計數：Netty 執行緒寫、主執行緒或 PlaceholderAPI 讀，LongAdder 本身執行緒安全。 */
public final class PacketStats {

    private final LongAdder setSlot = new LongAdder();

    void increment() {
        setSlot.increment();
    }

    public long setSlotCount() {
        return setSlot.sum();
    }
}
```

---

## 範例 3：邊界測試——在沒有第三方 jar 的 classpath 載入 Hook

**Input:**
```
test: Hook / Listener / Plugin 類別在沒有 Vault、PlaceholderAPI、packetevents 時仍可反射
```

**Output — JUnit 5 邊界測試:**

原理：軟依賴在 Gradle 是 `compileOnly`，**測試 classpath 本來就沒有它們**，所以測試裡的反射行為與「伺服器沒裝該插件」完全一樣。`getDeclaredFields()` / `getDeclaredMethods()` 會解析每個成員的型別（Bukkit 的 `registerEvents` 做的就是這件事），只要簽名碰到缺席的第三方型別就丟 `NoClassDefFoundError`，測試因此失敗。

```java
package com.example.market;

import com.example.market.integration.JoinListener;
import com.example.market.integration.MoneyPort;
import com.example.market.integration.NoMoney;
import com.example.market.integration.PapiHook;
import com.example.market.integration.SnapshotPublisher;
import com.example.market.integration.VaultHook;
import com.example.market.packet.PacketEventsHook;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 軟依賴的 class-load 邊界：沒有 Vault／PlaceholderAPI／packetevents 時，
 * 「一定會被建構」的類別必須能完整反射。
 *
 * <p>前提：build.gradle 只用 {@code compileOnly} 宣告這三個依賴，不要加 {@code testImplementation}／{@code testCompileOnly}。
 */
class SoftDependBoundaryTest {

    /** 即使沒有任何軟依賴也會被載入／建構／註冊的類別（含 Listener 與外掛主類別）。 */
    private static final List<Class<?>> ALWAYS_LOADED = List.of(
        MarketPlugin.class, VaultHook.class, PapiHook.class, PacketEventsHook.class,
        JoinListener.class, MoneyPort.class, NoMoney.class, SnapshotPublisher.class);

    @Test
    void testClasspathReallyLacksTheDependencies() {
        // 否則下面的測試永遠會過，沒有意義
        for (String name : List.of(
            "net.milkbowl.vault.economy.Economy",
            "me.clip.placeholderapi.expansion.PlaceholderExpansion",
            "com.github.retrooper.packetevents.PacketEvents")) {
            assertThrows(ClassNotFoundException.class, () -> Class.forName(name),
                "The test classpath contains " + name + "; the boundary test cannot detect leaks");
        }
    }

    @Test
    void alwaysLoadedClassesReflectWithoutTheDependencies() {
        for (Class<?> type : ALWAYS_LOADED) {
            assertDoesNotThrow(() -> {
                type.getDeclaredConstructors();
                type.getDeclaredFields();
                type.getDeclaredMethods(); // Bukkit registerEvents 做的就是這個
            }, type.getSimpleName() + " exposes a third-party type in a member signature");
        }
    }

    @Test
    void bridgesDoFailWithoutTheDependencies() throws ClassNotFoundException {
        // 反向確認：Bridge 本來就不能在缺依賴時反射；失敗代表它被 Hook 以外的程式碼保護著
        Class<?> bridge = Class.forName("com.example.market.integration.VaultBridge");
        assertThrows(NoClassDefFoundError.class, bridge::getDeclaredMethods);
    }
}
```

`build.gradle` 測試依賴（注意沒有任何軟依賴）：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly('com.github.MilkBowl:VaultAPI:1.7.1') { exclude group: 'org.bukkit' }
    compileOnly 'me.clip:placeholderapi:2.11.6'
    compileOnly 'com.github.retrooper:packetevents-spigot:2.13.0'

    // paper-api 在測試也要有，否則 JavaPlugin、Listener 載入不了；軟依賴不要加
    testImplementation 'io.papermc.paper:paper-api:26.2.build.132-stable'
    testImplementation platform('org.junit:junit-bom:5.11.4')
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

test {
    useJUnitPlatform()
}
```

要點：

- `bridgesDoFailWithoutTheDependencies` 是反向對照：確認 Bridge 在缺依賴時確實無法反射，證明第二個測試真的有偵測能力；Bridge 與 Expansion **不要**放進 `ALWAYS_LOADED`。
- 把新增的 Listener、指令類別都加進 `ALWAYS_LOADED`；它們是最容易在簽名上引入第三方型別的地方。
- 這個測試不需要 MockBukkit，也不需要啟動伺服器。

---

## 範例 4：選用的 Vault 提供端註冊與 PlaceholderAPI 發佈

**Input:**
```
role: provider + expansion
ledger: 自家帳本（LedgerPort）
```

**Output — onEnable 加上提供端註冊（帳本就緒後才註冊）:**
```java
import com.example.market.integration.LedgerPort;
import com.example.market.integration.VaultHook;
import org.bukkit.plugin.java.JavaPlugin;

public final class LedgerPlugin extends JavaPlugin {

    private VaultHook vault;

    @Override
    public void onEnable() {
        LedgerPort ledger = createLedger();   // 設定、資料庫都載入完成後才註冊，避免 Vault 消費者拿到半成品
        vault = new VaultHook(this);
        if (!vault.registerProvider(ledger)) {
            getLogger().info("Vault not available; the ledger is only reachable through its own API.");
        }
    }

    @Override
    public void onDisable() {
        // 取消本插件註冊的所有服務（包含 Economy）
        getServer().getServicesManager().unregisterAll(this);
    }

    private LedgerPort createLedger() {
        throw new UnsupportedOperationException("build your ledger here");
    }
}
```

**Output — 驗證 expansion（遊戲內）:**
```
/papi parse me %market_balance%
/papi parse me %market_balance_raw%
/papi info market
```

提醒：

- 提供端的方法都在**主執行緒**被 Vault 消費者呼叫；`LedgerPort` 的實作要有主執行緒檢查，或確保是執行緒安全的。
- `Economy.format()` 回傳含 § 色碼的字串是常態（EssentialsX、CMI 皆然），消費端一律以 `LegacyComponentSerializer.legacySection()` 轉 Component。
- PlaceholderAPI 的 `onRequest` 讀 `SnapshotPublisher.current()`；主執行緒的 `runTaskTimer` 每 5 秒（100 tick）整份重建快照，數值最多落後 5 秒，這是用延遲換執行緒安全的取捨。
