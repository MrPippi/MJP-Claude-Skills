# NMS Version Adapter

## Purpose

Define an abstract Adapter interface for common NMS operations, provide a concrete implementation for each supported MC version, and select one automatically at runtime based on the server version.

---

## Platform Requirements

- Paper 1.21.11 / 26.x (adapter examples use 26.2 / 26.3)
- A multi-module Gradle build is recommended (each version in its own module, compiled with Paperweight)

---

## Generated Code

### NmsAdapter.java (interface)

```java
public interface NmsAdapter {
    NmsVersion version();
    void sendActionBar(Player player, Component message);
    int getLatency(Player player);
    void spawnParticleClient(Location loc, String particleKey, int count);
}
```

### AdapterRegistry.java

```java
// Register each version's adapter at startup
AdapterRegistry.register(new V26_2_Adapter());
AdapterRegistry.register(new V26_3_Adapter());
AdapterRegistry.initialize(); // auto-detect the version and select

// Usage (version-independent)
AdapterRegistry.get().sendActionBar(player, Component.text("Welcome!"));
```

### NmsVersion.java

```java
public enum NmsVersion {
    V26_1, V26_2, V26_3, UNSUPPORTED;

    public static NmsVersion detect() {
        String[] parts = Bukkit.getMinecraftVersion().split("\."); // "26.2", "26.1.2"
        return switch (parts[0] + "." + parts[1]) {
            case "26.1" -> V26_1;
            case "26.2" -> V26_2;
            case "26.3" -> V26_3;
            default -> UNSUPPORTED;
        };
    }
}
```

---

## Multi-module Gradle Layout

```
my-plugin/
├── core/           # NmsAdapter interface (depends only on paper-api)
├── adapter-v26_2/  # Compiled against the Paper 26.2 dev bundle
├── adapter-v26_3/# Compiled against the Paper 26.3 dev bundle
└── plugin/         # shadowJar bundles everything together
```
