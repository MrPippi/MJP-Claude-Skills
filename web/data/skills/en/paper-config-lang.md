
# Paper Config & Lang

## Purpose

Make config and message loading consistent: parse `config.yml` once into an immutable `record` (bad values fall back to defaults and produce a warning list, no exceptions thrown); the deployed file takes priority with the defaults inside the jar layered underneath; handlers read only the current snapshot; reload reads the file asynchronously, swaps it in atomically on the main thread, and reports warnings to whoever ran the command. `lang.yml` holds MiniMessage templates, and player-controlled values are always inserted as plain text.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (compile-verified on both, no differing lines)
- Pure Paper API, no Paperweight needed
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### HomeConfig.java (immutable config + validation)

```java
import java.time.Duration;
import java.util.List;
import java.util.Map;

public record HomeConfig(int maxHomes, Duration teleportCooldown, boolean confirmTeleport, String defaultHomeName) {
    public static final int CURRENT_VERSION = 2;

    public record Parsed(HomeConfig config, List<String> warnings) {}

    /** raw: key -> raw YAML value; bad values fall back to defaults with a warning, no exceptions thrown. */
    public static Parsed from(Map<String, Object> raw) { /* ... */ }
}
```

### Lang.java (safe placeholders)

```java
// {name} style: the value is inserted as plain text via escapeTags
lang.send(player, "home.set", Map.of("name", playerTypedName));

// <player> style: Placeholder.unparsed is also plain text
lang.send(player, "welcome", Placeholder.unparsed("player", player.getName()));
```

### SettingsService.java (async reload)

```java
public void reload(Consumer<ReloadResult> onMain) {
    if (!reloading.compareAndSet(false, true)) {
        onMain.accept(new ReloadResult(null, List.of(), "busy"));
        return;
    }
    plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
        ReloadResult result = tryBuild();                       // Async: read file, parse, validate
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            reloading.set(false);
            Settings fresh = result.settings();
            if (fresh != null) current.set(fresh);              // Atomic swap on the main thread
            onMain.accept(result);
        });
    });
}
```

---

## Rules

- Handlers do not call `getConfig()`; they read only `settings.current()`; do not store a particular `Settings` in a long-lived field
- `saveResource` runs only when the file does not exist; new keys are not written into an already deployed file, and type changes are silently ignored -> attach a "deployment checklist" to every PR
- When a key changes, bump `config-version` by one and write a version note; when behind, both startup and reload list warnings
- YAML `on` / `off` / `yes` / `no` become booleans: quote both keys and values
- Use a `Map` (auto-escaped) or `Placeholder.unparsed` for player-controlled values, never concatenate them into a MiniMessage string
- A missing key shows a red `[missing key]` and logs only one line; do not use `ChatColor` or `§`
- Add dead-key / missing-key JUnit tests so lang.yml does not keep bloating

---

## Thread Safety

- File reading and parsing run on an async thread; swapping in the snapshot happens on the main thread
- `Settings` is fully immutable, so reading `current()` from any thread (PlaceholderAPI, packet listeners) is safe
- If reload fails, keep the old snapshot and report the reason to the command sender
