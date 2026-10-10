# Paper Softdepend Hook

## Purpose

Let a plugin gain an extra feature when a third-party plugin is installed and still start normally when it is not. This is the third-party counterpart of `paper-service-api` (between your own plugins): third-party types are not in your jar, and the JVM throws `NoClassDefFoundError` as soon as it loads a class that references them, so isolate them with three layers: Hook + Bridge + your own Port.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both compile-verified, no version differences)
- Pure Paper API; VaultAPI 1.7.1, PlaceholderAPI 2.11.6 and packetevents-spigot 2.13.0 are all `compileOnly`
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### VaultHook.java (no Vault types at all)

```java
public boolean install() {
    if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
        return false;                         // not installed: degrade directly
    }
    try {
        money = new Guarded(VaultBridge.create(plugin.getServer().getServicesManager()));
        return true;
    } catch (LinkageError e) {                // load failure or version mismatch
        warnOnce(e);
        return false;
    }
}
```

### MarketExpansion.java (PlaceholderAPI, reads a snapshot from any thread)

```java
@Override public boolean persist() { return true; }

@Override
public String onRequest(OfflinePlayer player, String params) {
    if (player == null) return null;
    double balance = publisher.current().balance(player.getUniqueId()); // volatile immutable snapshot
    return "balance".equals(params) ? String.format(Locale.ROOT, "%,.2f", balance) : null;
}
```

### Boundary test

```java
// soft dependencies are compileOnly only: they are not on the test classpath, so reflection behaves as if "the server does not have them installed"
assertDoesNotThrow(() -> { type.getDeclaredFields(); type.getDeclaredMethods(); });
```

---

## Rules

- `isPluginEnabled` comes before any code that would load third-party types; the Bridge is the only class that `import`s third-party packages
- No member signature of a Listener (including lambda captures) may contain a soft-dependency type, otherwise `registerEvents` fails and the listener silently stops working
- `Economy.format()` often contains legacy color codes: convert it to a Component and use it as a MiniMessage placeholder instead of concatenating strings
- Fetch `Economy` from `ServicesManager` anew on every operation; do not cache the provider
- Catch `LinkageError`, degrade, and warn only once; `onDisable` unregisters the expansion and services

---

## Thread Safety

- The Vault provider is called only on the main thread
- PlaceholderAPI `onRequest` may run on any thread: read only the immutable volatile snapshot published by the main thread
- The packetevents listener runs on the Netty thread: read snapshots only and do not call the Bukkit API
