# Paper Service API

## Purpose

Let plugins within the same plugin suite call each other safely. The provider registers an `api` interface containing only JDK types with the `ServicesManager`; the consumer depends on it with `compileOnly`, calls `load` every time at runtime, and catches the `LinkageError` that occurs when the two jar versions disagree.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both compile-verified)
- Pure Paper API, no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### WalletApi.java (provider api package)

```java
public interface WalletApi {
    OptionalLong balance(UUID player);
    ApiResult deposit(UUID player, long amount, String note);
    ApiResult withdraw(UUID player, long amount, String note);
}
```

### WalletPlugin.java (registration)

```java
getServer().getServicesManager().register(WalletApi.class, new WalletApiImpl(), this, ServicePriority.Normal);
// onDisable
getServer().getServicesManager().unregisterAll(this);
```

### WalletHook.java (consumer)

```java
public boolean withdraw(UUID player, long amount, String note) {
    if (!available()) return false;
    try {
        WalletApi api = plugin.getServer().getServicesManager().load(WalletApi.class);
        return api != null && api.withdraw(player, amount, note) == ApiResult.OK;
    } catch (LinkageError e) {   // the two jar versions disagree
        warnOnce(e);
        return false;
    }
}
```

---

## Rules

- The API interface uses only JDK types and is **additive only**; new methods go at the end
- The consumer calls `load` again on every call and never caches the implementation
- API types appear only inside the `try` in method bodies, to avoid class-loading failure when the provider is not installed
- The API package must not be shaded / relocated into the consumer jar

---

## Thread Safety

- Provider methods are main-thread only by default and throw `IllegalStateException` when violated
- Methods that need to be read from any thread must read an immutable snapshot
