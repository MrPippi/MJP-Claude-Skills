# examples — paper-softdepend-hook

## Example 1: Purchase flow withdraws via Vault (graceful degradation when Vault is not installed)

**Input:**
```
dependency: Vault
role: consumer
port_name: MoneyPort
integration_package: com.example.market.integration
```

**Output — business code depends only on `MoneyPort` and imports no Vault classes:**
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

    /** Call on the main thread (for example inside a GUI click event). */
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

Key points:

- `money.format(price)` returns a `Component` (the § color codes from `Economy.format()` are already parsed) and is passed to MiniMessage with `Placeholder.component`; do not write `"<red>You need " + economy.format(price)`.
- Another plugin can still withdraw between `has` and `withdraw`, so always check the result of `withdraw`.
- Vault has no transaction mechanism: a "transfer" is two independent calls, withdraw first and deposit second; if the withdrawal fails, do not deposit.

---

## Example 2: packetevents soft dependency (Hook + Bridge + packet listener)

**Input:**
```
dependency: packetevents
role: packet
purpose: Count the SET_SLOT packets each player receives (demo)
```

**Output — Hook (no packetevents types):**
```java
package com.example.market.packet;

import org.bukkit.plugin.Plugin;

import java.util.logging.Level;

/**
 * Hook for packetevents. It has no packetevents types: the listener is held as an Object, and all code that touches the types lives in {@link PacketEventsBridge},
 * which is only touched after isPluginEnabled is true, and LinkageError is caught.
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

    /** softdepend guarantees packetevents is enabled before this plugin. */
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

    /** A no-op if nothing was hooked. If packetevents was disabled first, its listeners have already gone with it, so a failure is logged at FINE only. */
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

**Output — Bridge and packet listener (the only code touching packetevents types):**
```java
package com.example.market.packet;

import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerCommon;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;

/**
 * This class must never be loaded when packetevents is not installed. It only registers and unregisters the listener and never calls load()/init()/terminate():
 * the API lifecycle belongs to the packetevents plugin, and other plugins are attached to the same instance.
 */
final class PacketEventsBridge {

    private PacketEventsBridge() {
    }

    /** @return the registered listener, handed back unchanged to {@link #unregister} when unregistering */
    static Object register(PacketStats stats) {
        return PacketEvents.getAPI().getEventManager().registerListener(new SlotCounter(stats));
    }

    static void unregister(Object listener) {
        PacketEvents.getAPI().getEventManager().unregisterListener((PacketListenerCommon) listener);
    }

    /** Runs on the Netty IO thread: calls no Bukkit API and only updates a thread-safe counter. */
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

**Output — a counter unrelated to packetevents (safe to read and write from any thread):**
```java
package com.example.market.packet;

import java.util.concurrent.atomic.LongAdder;

/** Packet counter: written by the Netty thread and read by the main thread or PlaceholderAPI; LongAdder is itself thread-safe. */
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

## Example 3: Boundary test — load the Hook on a classpath without third-party jars

**Input:**
```
test: Hook / Listener / Plugin classes can still be reflected without Vault, PlaceholderAPI, or packetevents
```

**Output — JUnit 5 boundary test:**

Rationale: in Gradle the soft dependencies are `compileOnly`, so the **test classpath already lacks them**, and reflection in a test behaves exactly like "the server does not have that plugin installed". `getDeclaredFields()` / `getDeclaredMethods()` resolve the type of every member (which is what Bukkit's `registerEvents` does), and any signature that touches the absent third-party type throws `NoClassDefFoundError`, which fails the test.

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
 * Class-load boundary for soft dependencies: without Vault/PlaceholderAPI/packetevents,
 * every class that is "always constructed" must be fully reflectable.
 *
 * <p>Precondition: build.gradle declares these three dependencies with {@code compileOnly} only; do not add {@code testImplementation}/{@code testCompileOnly}.
 */
class SoftDependBoundaryTest {

    /** Classes that are loaded/constructed/registered even with no soft dependency at all (including the Listener and the plugin main class). */
    private static final List<Class<?>> ALWAYS_LOADED = List.of(
        MarketPlugin.class, VaultHook.class, PapiHook.class, PacketEventsHook.class,
        JoinListener.class, MoneyPort.class, NoMoney.class, SnapshotPublisher.class);

    @Test
    void testClasspathReallyLacksTheDependencies() {
        // Otherwise the tests below would always pass and be meaningless
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
                type.getDeclaredMethods(); // This is exactly what Bukkit registerEvents does
            }, type.getSimpleName() + " exposes a third-party type in a member signature");
        }
    }

    @Test
    void bridgesDoFailWithoutTheDependencies() throws ClassNotFoundException {
        // Reverse check: a Bridge is supposed to be non-reflectable when the dependency is missing; failing here means it is protected by code other than the Hook
        Class<?> bridge = Class.forName("com.example.market.integration.VaultBridge");
        assertThrows(NoClassDefFoundError.class, bridge::getDeclaredMethods);
    }
}
```

`build.gradle` test dependencies (note there are no soft dependencies):

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
    compileOnly('com.github.MilkBowl:VaultAPI:1.7.1') { exclude group: 'org.bukkit' }
    compileOnly 'me.clip:placeholderapi:2.11.6'
    compileOnly 'com.github.retrooper:packetevents-spigot:2.13.0'

    // paper-api is also needed in tests, otherwise JavaPlugin and Listener cannot be loaded; do not add the soft dependencies
    testImplementation 'io.papermc.paper:paper-api:26.2.build.132-stable'
    testImplementation platform('org.junit:junit-bom:5.11.4')
    testImplementation 'org.junit.jupiter:junit-jupiter'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

test {
    useJUnitPlatform()
}
```

Key points:

- `bridgesDoFailWithoutTheDependencies` is a reverse control: it confirms the Bridge really cannot be reflected without the dependency, proving the second test can actually detect leaks; do **not** put the Bridge or Expansion in `ALWAYS_LOADED`.
- Add every new Listener and command class to `ALWAYS_LOADED`; they are the places most likely to introduce a third-party type in a signature.
- This test needs neither MockBukkit nor a running server.

---

## Example 4: Optional Vault provider registration and PlaceholderAPI publishing

**Input:**
```
role: provider + expansion
ledger: own ledger (LedgerPort)
```

**Output — add provider registration to onEnable (register only once the ledger is ready):**
```java
import com.example.market.integration.LedgerPort;
import com.example.market.integration.VaultHook;
import org.bukkit.plugin.java.JavaPlugin;

public final class LedgerPlugin extends JavaPlugin {

    private VaultHook vault;

    @Override
    public void onEnable() {
        LedgerPort ledger = createLedger();   // Register only after config and database are fully loaded, so Vault consumers never get a half-built provider
        vault = new VaultHook(this);
        if (!vault.registerProvider(ledger)) {
            getLogger().info("Vault not available; the ledger is only reachable through its own API.");
        }
    }

    @Override
    public void onDisable() {
        // Unregister every service registered by this plugin (including Economy)
        getServer().getServicesManager().unregisterAll(this);
    }

    private LedgerPort createLedger() {
        throw new UnsupportedOperationException("build your ledger here");
    }
}
```

**Output — verify the expansion (in game):**
```
/papi parse me %market_balance%
/papi parse me %market_balance_raw%
/papi info market
```

Reminders:

- Provider methods are called by Vault consumers on the **main thread**; the `LedgerPort` implementation needs a main-thread check, or must be thread-safe.
- It is normal for `Economy.format()` to return a string containing § color codes (EssentialsX and CMI both do); consumers always convert it to a Component with `LegacyComponentSerializer.legacySection()`.
- PlaceholderAPI's `onRequest` reads `SnapshotPublisher.current()`; the main thread's `runTaskTimer` rebuilds the whole snapshot every 5 seconds (100 ticks), so values lag by at most 5 seconds. This is the trade-off of paying latency for thread safety.
