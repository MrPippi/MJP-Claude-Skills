---
name: paper-config-lang
description: "Paper 插件的設定與訊息：config.yml 只解析一次成不可變 record（驗證、預設值、警告清單）、config-version、部署檔優先的分層預設、MiniMessage lang.yml、非同步 reload 後原子換快照 / Paper plugin config.yml parsed once into an immutable record, layered defaults, MiniMessage lang.yml with safe placeholders, async reload with atomic snapshot swap"
---

# Paper Config & Lang

## Skill Name

`paper-config-lang`

## Purpose

Load a plugin's `config.yml` and `lang.yml` consistently, with reload support, so a bad value written by an admin never crashes the plugin:

- `config.yml` is **parsed once** into an immutable `record`; bad values do not throw, they fall back to defaults and are added to a **warning list**
- Layered loading: jar defaults underneath, **the deployed file wins**; `saveResource` only writes when the file does not exist
- Handlers (commands, listeners, tasks) **never call `getConfig()`**; they only read the current `Settings` snapshot
- Reload = read files async -> build a new snapshot -> swap it in atomically on the main thread -> report warnings to whoever ran the command
- `lang.yml` is entirely MiniMessage templates; player-controlled values are always inserted as plain text and never parsed as MiniMessage
- A missing key shows visible fallback text and logs a single line; never use `ChatColor` or `§`

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (Bukkit `YamlConfiguration` and Adventure MiniMessage are identical on both versions; no version-specific lines)
- Pure Paper API; Paperweight is not needed

## Triggers

- 「設定檔」「config.yml」「reload」「重新載入設定」「config-version」
- 「lang.yml」「訊息檔」「MiniMessage 訊息」「多語系」「placeholder」
- 「設定檔沒更新」「新鍵沒出現」「on/off 變 true/false」「[missing」
- 「死鍵」「dead key」「LangKeysTest」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `base_package` | `com.example.home` | Plugin root package (config classes go in the `.config` subpackage) |
| `config_keys` | `max-homes`, `teleport-cooldown-seconds` | Config keys to expose to admins, with their types and valid ranges |
| `lang_keys` | `home.set`, `reload.ok` | Message keys players will see |
| `plugin_class` | `HomePlugin` | The `JavaPlugin` that does the wiring (constructor injection) |

## Outputs

- `config.yml` — shipped config with `config-version` and a version-history comment
- `lang.yml` — MiniMessage templates (English player-facing text)
- `HomeConfig.java` — immutable config record; `from(Map)` validates, falls back to defaults, and produces warnings
- `YamlFiles.java` — layered loading (deployed file + bundled defaults)
- `ConfigLoader.java` — reads YAML into raw values and hands them to `HomeConfig.from`
- `Lang.java` — immutable message table; safe placeholders; missing-key fallback
- `Settings.java` — one snapshot = `HomeConfig` + `Lang`
- `SettingsService.java` — holds the current snapshot; async reload, atomic swap on the main thread
- `ReloadCommand.java` — `/homeadmin reload`, reports warnings
- `HomePlugin.java` — wiring and startup-failure handling

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Only `paper-api` is needed (it bundles SnakeYAML, Adventure, MiniMessage, and JSpecify).

`src/main/resources/` must contain `config.yml` and `lang.yml`, and `plugin.yml` must declare the command:

```yaml
name: Home
version: '${version}'
main: com.example.home.HomePlugin
api-version: '26.2'
commands:
  homeadmin:
    description: Administrative commands
    permission: home.admin
permissions:
  home.admin:
    default: op
  home.admin.reload:
    default: op
```

## Example Files

### `config.yml`

```yaml
# Version history (bump config-version when you add, rename or retype a key):
#   1: first release
#   2: added confirm-teleport
config-version: 2

# How many homes a player may own (1-100).
max-homes: 3

# Seconds between teleports (0-3600).
teleport-cooldown-seconds: 5

# Ask the player to confirm before teleporting.
confirm-teleport: true

# Name used when /sethome is run without an argument (a-z, 0-9, _ and -).
default-home-name: home
```

### `lang.yml`

```yaml
# MiniMessage templates. {name}-style placeholders are inserted as plain text.
# Quote the keys on / off / yes / no / true / false / y / n: YAML turns them into booleans.
home:
  set: "<green>Home <white>{name}</white> saved."
  not-found: "<red>You have no home named <white>{name}</white>."
  limit: "<red>You can only have <white>{max}</white> homes."
teleport:
  cooldown: "<yellow>Wait <white>{seconds}</white>s before teleporting again."
welcome: "<gray>Welcome back, <player>!"
toggle:
  "on": "<green>enabled"
  "off": "<red>disabled"
reload:
  ok: "<green>Home settings reloaded."
  ok-warnings: "<yellow>Home settings reloaded with <white>{count}</white> warning(s):"
  warning: "<gray> - {warning}"
  failed: "<red>Reload failed, keeping the previous settings: {error}"
  busy: "<red>A reload is already running."
```

## Code Template

### `HomeConfig.java` (immutable config + validation)

```java
package com.example.home.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Immutable snapshot of config.yml, parsed once.
 *
 * <p>Bad values (missing, wrong type, out of range) do not throw: they fall back to defaults and leave a line in {@link Parsed#warnings()}.
 * Pure JDK with no Bukkit dependency, so it can be unit-tested directly with {@code Map.of(...)}.
 */
public record HomeConfig(int maxHomes, Duration teleportCooldown, boolean confirmTeleport, String defaultHomeName) {

    /** config-version of the shipped config.yml; bump it together with any key change (add, rename, retype). */
    public static final int CURRENT_VERSION = 2;

    public static final String KEY_VERSION = "config-version";
    public static final String KEY_MAX_HOMES = "max-homes";
    public static final String KEY_COOLDOWN = "teleport-cooldown-seconds";
    public static final String KEY_CONFIRM = "confirm-teleport";
    public static final String KEY_DEFAULT_NAME = "default-home-name";

    /** All keys ConfigLoader reads; update both places when adding a setting. */
    public static final List<String> KEYS =
            List.of(KEY_VERSION, KEY_MAX_HOMES, KEY_COOLDOWN, KEY_CONFIRM, KEY_DEFAULT_NAME);

    public static final HomeConfig DEFAULTS = new HomeConfig(3, Duration.ofSeconds(5), true, "home");

    private static final int MAX_HOMES_LIMIT = 100;
    private static final int MAX_COOLDOWN_SECONDS = 3600;
    private static final Pattern NAME = Pattern.compile("[a-z0-9_-]{1,16}");

    public HomeConfig {
        Objects.requireNonNull(teleportCooldown, "teleportCooldown");
        Objects.requireNonNull(defaultHomeName, "defaultHomeName");
    }

    /** Parse result: the config itself + warnings for admins (reported on reload, logged on startup). */
    public record Parsed(HomeConfig config, List<String> warnings) {
        public Parsed {
            warnings = List.copyOf(warnings);
        }
    }

    /** @param raw key -> raw value read from YAML; missing keys are not put in the map */
    public static Parsed from(Map<String, Object> raw) {
        List<String> warnings = new ArrayList<>();
        checkVersion(raw.get(KEY_VERSION), warnings);
        int maxHomes = intIn(raw, KEY_MAX_HOMES, 1, MAX_HOMES_LIMIT, DEFAULTS.maxHomes(), warnings);
        int cooldown = intIn(raw, KEY_COOLDOWN, 0, MAX_COOLDOWN_SECONDS,
                (int) DEFAULTS.teleportCooldown().toSeconds(), warnings);
        boolean confirm = bool(raw, KEY_CONFIRM, DEFAULTS.confirmTeleport(), warnings);
        String name = name(raw, KEY_DEFAULT_NAME, DEFAULTS.defaultHomeName(), warnings);
        return new Parsed(new HomeConfig(maxHomes, Duration.ofSeconds(cooldown), confirm, name), warnings);
    }

    private static void checkVersion(Object value, List<String> warnings) {
        if (!(value instanceof Integer version)) {
            warnings.add(KEY_VERSION + " is missing; this file predates versioning, compare it with the bundled config.yml");
        } else if (version < CURRENT_VERSION) {
            warnings.add("config.yml is config-version " + version + " but the plugin expects " + CURRENT_VERSION
                    + "; new keys are not added to existing files, copy them from the bundled config.yml and bump the number");
        } else if (version > CURRENT_VERSION) {
            warnings.add("config.yml is config-version " + version + ", newer than this plugin (" + CURRENT_VERSION + ")");
        }
    }

    private static int intIn(Map<String, Object> raw, String key, int min, int max, int fallback, List<String> warnings) {
        Object value = raw.get(key);
        if (value == null) {
            return fallback;
        }
        if (!(value instanceof Integer number)) {
            warnings.add(key + " must be a whole number, got '" + value + "'; using " + fallback);
            return fallback;
        }
        if (number < min || number > max) {
            warnings.add(key + " must be between " + min + " and " + max + ", got " + number + "; using " + fallback);
            return fallback;
        }
        return number;
    }

    private static boolean bool(Map<String, Object> raw, String key, boolean fallback, List<String> warnings) {
        Object value = raw.get(key);
        if (value == null) {
            return fallback;
        }
        if (!(value instanceof Boolean flag)) {
            warnings.add(key + " must be true or false, got '" + value + "'; using " + fallback);
            return fallback;
        }
        return flag;
    }

    private static String name(Map<String, Object> raw, String key, String fallback, List<String> warnings) {
        Object value = raw.get(key);
        if (value == null) {
            return fallback;
        }
        String text = String.valueOf(value);
        if (!NAME.matcher(text).matches()) {
            warnings.add(key + " must match [a-z0-9_-]{1,16}, got '" + text + "'; using " + fallback);
            return fallback;
        }
        return text;
    }
}
```

### `YamlFiles.java` (layered loading)

```java
package com.example.home.config;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Loads {@code plugins/<plugin>/<name>} and layers the same-named file in the jar underneath as defaults.
 *
 * <p>Rules:
 * <ul>
 *   <li>{@code saveResource} only when the file does <b>not exist</b>; an existing file is never touched (no overwrite, no key backfill), so the deployed file always wins</li>
 *   <li>A parse failure throws {@link IllegalArgumentException}, so reload can report it and keep the old snapshot instead of silently becoming an empty config</li>
 *   <li>{@code YamlConfiguration.loadConfiguration(File)} swallows parse errors, so this uses {@code load} / {@code loadFromString}</li>
 * </ul>
 * Performs file IO, so it may be called from an async thread.
 */
public final class YamlFiles {

    private YamlFiles() {
    }

    /** The deployed file with jar defaults layered underneath: {@code get(path)} returns the jar value when the deployed file lacks the key. */
    public static YamlConfiguration layered(JavaPlugin plugin, String name) {
        YamlConfiguration deployed = deployed(plugin, name);
        deployed.setDefaults(bundled(plugin, name));
        return deployed;
    }

    /** Only the deployed file itself (no defaults); writes the jar template first if the file does not exist. */
    public static YamlConfiguration deployed(JavaPlugin plugin, String name) {
        File file = new File(plugin.getDataFolder(), name);
        if (!file.exists()) {
            plugin.saveResource(name, false);
        }
        YamlConfiguration yaml = new YamlConfiguration();
        try {
            yaml.load(file);
        } catch (IOException | InvalidConfigurationException e) {
            throw new IllegalArgumentException(name + " cannot be parsed: " + e.getMessage(), e);
        }
        return yaml;
    }

    /** The copy shipped inside the jar. */
    public static YamlConfiguration bundled(JavaPlugin plugin, String name) {
        try (InputStream in = plugin.getResource(name)) {
            if (in == null) {
                throw new IllegalStateException(name + " is missing from the plugin jar");
            }
            YamlConfiguration yaml = new YamlConfiguration();
            yaml.loadFromString(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            return yaml;
        } catch (IOException | InvalidConfigurationException e) {
            throw new IllegalStateException("bundled " + name + " cannot be read: " + e.getMessage(), e);
        }
    }
}
```

### `ConfigLoader.java`

```java
package com.example.home.config;

import java.util.HashMap;
import java.util.Map;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

/** Reads config.yml into raw values; validation is left to {@link HomeConfig#from}. May be called from an async thread. */
public final class ConfigLoader {

    private static final String FILE = "config.yml";

    private final JavaPlugin plugin;

    public ConfigLoader(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    public HomeConfig.Parsed load() {
        YamlConfiguration yaml = YamlFiles.layered(plugin, FILE);
        Map<String, Object> raw = new HashMap<>();
        for (String key : HomeConfig.KEYS) {
            Object value = yaml.get(key); // Key missing in the deployed file -> falls through to the jar default
            if (value != null) {
                raw.put(key, value);
            }
        }
        return HomeConfig.from(raw);
    }
}
```

### `Lang.java` (MiniMessage message table)

```java
package com.example.home.config;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import net.kyori.adventure.audience.Audience;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Immutable message table for lang.yml (deployed file wins; missing keys use the jar defaults).
 *
 * <p>Insertion rules:
 * <ul>
 *   <li>{@code {name}} style: the value goes through {@link MiniMessage#escapeTags} and is inserted as plain text, so a player-typed {@code <red>} has no effect</li>
 *   <li>{@code <player>} style: use {@code Placeholder.unparsed} (plain text) or {@code Placeholder.component} (trusted Component)</li>
 * </ul>
 * A missing key returns a red {@code [missing key]} and logs only one line.
 */
public final class Lang {

    private static final MiniMessage MM = MiniMessage.miniMessage();
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{([a-z0-9_-]+)}");

    private final Map<String, String> templates;
    private final Logger log;
    private final Set<String> reportedMissing = ConcurrentHashMap.newKeySet();

    private Lang(Map<String, String> templates, Logger log) {
        this.templates = Map.copyOf(templates);
        this.log = log;
    }

    /** For tests: supply the template table directly. */
    public static Lang of(Map<String, String> templates, Logger log) {
        return new Lang(templates, log);
    }

    /** Reads lang.yml (may be called from an async thread); problems are reported via {@code warn}, and a parse failure throws {@link IllegalArgumentException}. */
    public static Lang load(JavaPlugin plugin, Consumer<String> warn) {
        YamlConfiguration deployed = YamlFiles.deployed(plugin, "lang.yml");
        YamlConfiguration bundled = YamlFiles.bundled(plugin, "lang.yml");
        Map<String, String> bundledTemplates = flatten(bundled, "bundled lang.yml", warn);
        Map<String, String> deployedTemplates = flatten(deployed, "lang.yml", warn);

        Map<String, String> merged = new HashMap<>(bundledTemplates);
        merged.putAll(deployedTemplates);
        int missing = 0;
        for (String key : bundledTemplates.keySet()) {
            if (!deployedTemplates.containsKey(key)) {
                missing++;
            }
        }
        if (missing > 0) {
            warn.accept("lang.yml is missing " + missing + " key(s); using the bundled text for them");
        }
        return new Lang(merged, plugin.getLogger());
    }

    /** Flattens into {@code a.b.c -> text}; non-text values (on/off parsed as booleans, etc.) are warned about and skipped. */
    static Map<String, String> flatten(YamlConfiguration yaml, String label, Consumer<String> warn) {
        Map<String, String> out = new HashMap<>();
        for (String key : yaml.getKeys(true)) {
            if (yaml.isConfigurationSection(key)) {
                continue;
            }
            for (String segment : key.split("\\.")) {
                if (segment.equals("true") || segment.equals("false")) {
                    warn.accept(label + ": key '" + key + "' looks like an unquoted on/off/yes/no key; quote it");
                    break;
                }
            }
            Object value = yaml.get(key);
            if (value instanceof String text) {
                out.put(key, text);
            } else {
                warn.accept(label + ": '" + key + "' is not text (" + value + "); quote the value");
            }
        }
        return out;
    }

    public Component line(String key) {
        return line(key, Map.of(), TagResolver.empty());
    }

    /** {@code {name}} style: values in vars are inserted as plain text. */
    public Component line(String key, Map<String, String> vars) {
        return line(key, vars, TagResolver.empty());
    }

    /** {@code <player>} style: use a TagResolver such as {@code Placeholder.unparsed}. */
    public Component line(String key, TagResolver resolver) {
        return line(key, Map.of(), resolver);
    }

    public Component line(String key, Map<String, String> vars, TagResolver resolver) {
        String template = templates.get(key);
        if (template == null) {
            if (reportedMissing.add(key)) {
                log.warning("Missing lang key: " + key);
            }
            return Component.text("[missing " + key + "]", NamedTextColor.RED);
        }
        return MM.deserialize(fill(template, vars), resolver);
    }

    public void send(Audience to, String key) {
        to.sendMessage(line(key));
    }

    public void send(Audience to, String key, Map<String, String> vars) {
        to.sendMessage(line(key, vars));
    }

    public void send(Audience to, String key, TagResolver resolver) {
        to.sendMessage(line(key, resolver));
    }

    /** Single-pass replacement of {@code {name}}: even if a value contains {@code {other}}, it is not replaced again; unknown placeholders are kept as-is. */
    static String fill(String template, Map<String, String> vars) {
        return PLACEHOLDER.matcher(template).replaceAll(match -> {
            String value = vars.get(match.group(1));
            return Matcher.quoteReplacement(value == null ? match.group() : MM.escapeTags(value));
        });
    }
}
```

### `Settings.java` (one snapshot)

```java
package com.example.home.config;

import java.util.Objects;

/** The currently active config and messages. Fully immutable; reload builds a new one and swaps the whole thing. */
public record Settings(HomeConfig config, Lang lang) {

    public Settings {
        Objects.requireNonNull(config, "config");
        Objects.requireNonNull(lang, "lang");
    }
}
```

### `SettingsService.java` (holds the snapshot, async reload)

```java
package com.example.home.config;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.logging.Level;
import org.bukkit.plugin.java.JavaPlugin;
import org.jspecify.annotations.Nullable;

/**
 * Holds the current {@link Settings}. Handlers only call {@link #current()} and never touch getConfig().
 *
 * <p>Reload: read files and build a new snapshot async -> swap it in on the main thread -> report the result. On failure the old snapshot is kept.
 * {@link AtomicReference} is used because PlaceholderAPI / packet listeners may read the snapshot from other threads.
 */
public final class SettingsService {

    /** Result of a reload; a null settings means failure (error holds the reason). */
    public record ReloadResult(@Nullable Settings settings, List<String> warnings, @Nullable String error) {
        public ReloadResult {
            warnings = List.copyOf(warnings);
        }

        public boolean success() {
            return settings != null;
        }
    }

    private final JavaPlugin plugin;
    private final ConfigLoader configLoader;
    private final AtomicReference<@Nullable Settings> current = new AtomicReference<>();
    private final AtomicBoolean reloading = new AtomicBoolean();

    public SettingsService(JavaPlugin plugin) {
        this.plugin = plugin;
        this.configLoader = new ConfigLoader(plugin);
    }

    public Settings current() {
        Settings settings = current.get();
        if (settings == null) {
            throw new IllegalStateException("Settings are not loaded yet");
        }
        return settings;
    }

    /** For onEnable: loads synchronously, swaps it in, and returns the warnings. A parse failure throws, and the caller disables the plugin. */
    public List<String> loadNow() {
        List<String> warnings = new ArrayList<>();
        Settings settings = build(warnings);
        current.set(settings);
        return warnings;
    }

    /**
     * Async reload. {@code onMain} is always called on the main thread (while the plugin is still enabled).
     * If a reload is already running, failure is reported immediately; requests are not queued.
     */
    public void reload(Consumer<ReloadResult> onMain) {
        if (!reloading.compareAndSet(false, true)) {
            onMain.accept(new ReloadResult(null, List.of(), "busy"));
            return;
        }
        plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
            ReloadResult result = tryBuild();
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                reloading.set(false);
                Settings fresh = result.settings();
                if (fresh != null) {
                    current.set(fresh); // Atomic swap on the main thread; on failure the old snapshot is left untouched
                }
                onMain.accept(result);
            });
        });
    }

    private ReloadResult tryBuild() {
        List<String> warnings = new ArrayList<>();
        try {
            return new ReloadResult(build(warnings), warnings, null);
        } catch (RuntimeException e) {
            plugin.getLogger().log(Level.SEVERE, "Reload failed", e);
            return new ReloadResult(null, warnings, String.valueOf(e.getMessage()));
        }
    }

    private Settings build(List<String> warnings) {
        HomeConfig.Parsed parsed = configLoader.load();
        warnings.addAll(parsed.warnings());
        Lang lang = Lang.load(plugin, warnings::add);
        return new Settings(parsed.config(), lang);
    }
}
```

### `ReloadCommand.java`

```java
package com.example.home;

import com.example.home.config.Lang;
import com.example.home.config.SettingsService;
import com.example.home.config.SettingsService.ReloadResult;
import java.util.Map;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;

/** {@code /homeadmin reload}: re-reads the config async, then reports the result and warnings to whoever ran the command. */
public final class ReloadCommand implements CommandExecutor {

    private final SettingsService settings;

    public ReloadCommand(SettingsService settings) {
        this.settings = settings;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (args.length != 1 || !args[0].equalsIgnoreCase("reload")) {
            return false;
        }
        settings.reload(result -> report(sender, result));
        return true;
    }

    /** Runs on the main thread; messages use the "current" snapshot (the new one if reload succeeded, the old one if it failed). */
    private void report(CommandSender sender, ReloadResult result) {
        Lang lang = settings.current().lang();
        if (!result.success()) {
            String key = "busy".equals(result.error()) ? "reload.busy" : "reload.failed";
            lang.send(sender, key, Map.of("error", String.valueOf(result.error())));
            return;
        }
        if (result.warnings().isEmpty()) {
            lang.send(sender, "reload.ok");
            return;
        }
        lang.send(sender, "reload.ok-warnings", Map.of("count", String.valueOf(result.warnings().size())));
        for (String warning : result.warnings()) {
            lang.send(sender, "reload.warning", Map.of("warning", warning)); // Warnings contain file content, so always treat them as plain text
        }
    }
}
```

### `HomePlugin.java` (wiring)

```java
package com.example.home;

import com.example.home.config.SettingsService;
import java.util.List;
import java.util.logging.Level;
import org.bukkit.command.PluginCommand;
import org.bukkit.plugin.java.JavaPlugin;

public final class HomePlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        SettingsService settings = new SettingsService(this);
        try {
            List<String> warnings = settings.loadNow();
            warnings.forEach(getLogger()::warning);
        } catch (RuntimeException e) {
            getLogger().log(Level.SEVERE, "Cannot load config.yml / lang.yml; disabling", e);
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        PluginCommand admin = getCommand("homeadmin");
        if (admin != null) {
            admin.setExecutor(new ReloadCommand(settings));
        }
        // Other components receive settings (or settings::current) via constructor; never hold it statically
    }
}
```

## Recommended Directory Structure

```
src/main/
├── java/com/example/home/
│   ├── HomePlugin.java                  <- wiring
│   ├── ReloadCommand.java
│   └── config/
│       ├── HomeConfig.java              <- pure-JDK record + validation
│       ├── YamlFiles.java
│       ├── ConfigLoader.java
│       ├── Lang.java
│       ├── Settings.java
│       └── SettingsService.java
└── resources/
    ├── plugin.yml
    ├── config.yml                       <- includes config-version and version history
    └── lang.yml
src/test/java/com/example/home/
├── config/HomeConfigTest.java
└── LangKeysTest.java                    <- dead-key / missing-key test (see examples.md)
```

## Deploy Checklist

Files on an already-deployed server are **not** updated with a new jar, so run these checks every time you change config or messages:

1. **New keys are not written into the deployed file automatically**: `saveResource` only runs when the file does not exist. New keys take effect through `HomeConfig.DEFAULTS` and the layered jar defaults; if you want admins to see them, list them in the update notes and ask them to paste them in manually.
2. **Type changes to existing keys are silently ignored**: the old value in the deployed file still wins, and when the type is wrong `HomeConfig.from` only warns and falls back to the default. Changing a type or meaning = use a new key name; do not reuse the old key.
3. **List the "deployed keys that must be deleted or edited by hand"**: each PR's test plan should state which keys need manual handling on deployed servers, and verify them one by one after deployment (for example, check that a message is not `[missing ...]`).
4. **When `config.yml` changes, bump `config-version` and add a history line at the top of the file**: it is compared on startup and reload, and a stale file produces warnings in the log and the command reply.
5. **Do not backfill keys with `copyDefaults(true)` + `save()`**: Bukkit's file write drops comments and reorders keys, wiping out the admin's edits.
6. **A parse failure must not turn into an empty config**: a failed reload keeps the old snapshot and reports the reason; a startup failure disables the plugin.

## YAML Traps

| Written as | Actually parsed as | Fix |
|------|---------|------|
| `on:` / `off:` / `yes:` / `no:` as a key | Boolean key `true` / `false` | Add quotes: `"on":` |
| `toggle: on` | The value is a boolean, not text | `toggle: "on"` |
| `name: 1.10` | Float `1.1` | Always quote values meant to be strings |
| `max: 010` | Octal | No leading 0, or add quotes |
| Message contains `: ` or starts with `#` or `<` | Treated as a mapping or a comment | Wrap the whole string in double quotes |
| Text contains `"` | Ends the string early | Use single quotes outside, or `\"` |

`Lang.load` warns about "non-text values" and "keys that look like booleans", turning these mistakes into visible messages.

## Thread Safety

- File reading and parsing (`YamlFiles`, `ConfigLoader`, `Lang.load`) may run on an async thread; **do not** touch `Player` or `World` there
- The snapshot swap happens on the main thread; `Settings` is fully immutable, so reading `current()` from any thread is safe (PlaceholderAPI, packet listeners)
- The async phase only collects warnings into its own `ArrayList`, never shared with other threads
- If a handler crosses an async boundary, read the needed config values on the main thread and pass them in, or call `current()` again each time; do not store a particular `Settings` in a long-lived field (it goes stale after reload)
- See [`references/paper-threading.md`](references/paper-threading.md)

## Fallback

| Error | Cause | Fix |
|------|------|------|
| A key added in a new version does not appear on the server | `saveResource` only writes when the file does not exist | Paste it in manually per the "Deploy Checklist"; layered defaults and `DEFAULTS` keep the feature working |
| Changed a key's type but server behavior did not change | The old deployed value wins; the type mismatch is warned about and falls back to the default | Use a new key name; list the old key to delete in the deploy checklist |
| Message shows `[missing toggle.on]` | The `on`/`off` keys were parsed as booleans by YAML | Quote the keys; check the `Lang.load` warnings |
| A player name `<red>` colors the message | Player input was parsed as MiniMessage | Use the `Map` overload (auto-escapes) or `Placeholder.unparsed` |
| Message shows a literal `{name}` | The template placeholder name does not match the vars key | Keep names lowercase; test that templates and call sites match |
| Behavior unchanged after reload | A handler cached an old `Settings` or called `getConfig()` | Handlers must only call `settings.current()` |
| Settings revert to defaults after reload | A YAML parse failure was swallowed | Use `YamlConfiguration.load` (throws), keep the old snapshot, and report |
| lang.yml keeps growing after features are removed | Nobody cleans up dead keys | Add a dead-key test (`LangKeysTest`, see examples.md) |
| Message shows `§` or garbled color codes | `ChatColor` / legacy color codes were used | Use MiniMessage only; escape legacy-colored text from external sources before inserting |
