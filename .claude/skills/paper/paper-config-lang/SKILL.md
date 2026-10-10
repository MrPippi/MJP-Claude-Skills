---
name: paper-config-lang
description: "Paper 插件的設定與訊息：config.yml 只解析一次成不可變 record（驗證、預設值、警告清單）、config-version、部署檔優先的分層預設、MiniMessage lang.yml、非同步 reload 後原子換快照 / Paper plugin config.yml parsed once into an immutable record, layered defaults, MiniMessage lang.yml with safe placeholders, async reload with atomic snapshot swap"
---

# Paper Config & Lang / 設定與訊息

## 技能名稱 / Skill Name

`paper-config-lang`

## 目的 / Purpose

讓插件的 `config.yml` 與 `lang.yml` 載入方式一致、可 reload、不會因為管理員寫錯值而崩潰：

- `config.yml` **只解析一次**成不可變 `record`；壞值不丟例外，而是回退預設並加進**警告清單**
- 載入分層：jar 內預設疊底，**部署檔優先**；`saveResource` 只在檔案不存在時才寫出
- 處理器（指令、listener、任務）**不呼叫 `getConfig()`**，只讀目前的 `Settings` 快照
- reload = 非同步讀檔 → 建新快照 → 主執行緒原子換入 → 把警告回報給下指令的人
- `lang.yml` 全部是 MiniMessage 模板；玩家可控的值一律當純文字插入，不會被當成 MiniMessage 解析
- 缺鍵時顯示可見的後備文字並只記一行 log；不使用 `ChatColor` 或 `§`

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（Bukkit `YamlConfiguration` 與 Adventure MiniMessage，兩版相同，無差異行）
- 純 Paper API，不需要 Paperweight

## 觸發條件 / Triggers

- 「設定檔」「config.yml」「reload」「重新載入設定」「config-version」
- 「lang.yml」「訊息檔」「MiniMessage 訊息」「多語系」「placeholder」
- 「設定檔沒更新」「新鍵沒出現」「on/off 變 true/false」「[missing」
- 「死鍵」「dead key」「LangKeysTest」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.home` | 插件根 package（設定類放 `.config` 子 package） |
| `config_keys` | `max-homes`, `teleport-cooldown-seconds` | 要開放給管理員的設定鍵、型別與合法範圍 |
| `lang_keys` | `home.set`, `reload.ok` | 玩家會看到的訊息鍵 |
| `plugin_class` | `HomePlugin` | 負責接線（建構子注入）的 `JavaPlugin` |

## 輸出產物 / Outputs

- `config.yml` — 含 `config-version` 與版本紀錄註解的出貨設定
- `lang.yml` — MiniMessage 模板（英文玩家文字）
- `HomeConfig.java` — 不可變設定 record；`from(Map)` 驗證、回退預設、產生警告
- `YamlFiles.java` — 分層載入（部署檔 + jar 內預設）
- `ConfigLoader.java` — 把 YAML 讀成原始值交給 `HomeConfig.from`
- `Lang.java` — 不可變訊息表；安全 placeholder；缺鍵後備
- `Settings.java` — 一份快照 = `HomeConfig` + `Lang`
- `SettingsService.java` — 持有目前快照；非同步 reload、主執行緒原子換入
- `ReloadCommand.java` — `/homeadmin reload`，回報警告
- `HomePlugin.java` — 接線與啟動失敗處理

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。只需要 `paper-api`（內含 SnakeYAML、Adventure、MiniMessage、JSpecify）。

`src/main/resources/` 必須有 `config.yml` 與 `lang.yml`，並在 `plugin.yml` 宣告指令：

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

## 設定檔範例 / Example Files

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

## 代碼範本 / Code Template

### `HomeConfig.java`（不可變設定 + 驗證）

```java
package com.example.home.config;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * config.yml 解析一次後的不可變快照。
 *
 * <p>壞值（缺少、型別錯、超出範圍）不丟例外：回退預設並在 {@link Parsed#warnings()} 留一行說明。
 * 純 JDK、不碰 Bukkit，可以直接用 {@code Map.of(...)} 單元測試。
 */
public record HomeConfig(int maxHomes, Duration teleportCooldown, boolean confirmTeleport, String defaultHomeName) {

    /** 出貨 config.yml 的 config-version；改鍵（新增、改名、改型別）時一起加一。 */
    public static final int CURRENT_VERSION = 2;

    public static final String KEY_VERSION = "config-version";
    public static final String KEY_MAX_HOMES = "max-homes";
    public static final String KEY_COOLDOWN = "teleport-cooldown-seconds";
    public static final String KEY_CONFIRM = "confirm-teleport";
    public static final String KEY_DEFAULT_NAME = "default-home-name";

    /** ConfigLoader 要讀的全部鍵；新增設定時兩邊一起改。 */
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

    /** 解析結果：設定本體 + 給管理員看的警告（reload 時回報、啟動時寫 log）。 */
    public record Parsed(HomeConfig config, List<String> warnings) {
        public Parsed {
            warnings = List.copyOf(warnings);
        }
    }

    /** @param raw 鍵 → 從 YAML 讀到的原始值；缺少的鍵不放進 map */
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

### `YamlFiles.java`（分層載入）

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
 * 載入 {@code plugins/<plugin>/<name>}，並把 jar 內同名檔當預設疊在底下。
 *
 * <p>規則：
 * <ul>
 *   <li>檔案<b>不存在</b>時才 {@code saveResource}；存在就不碰（不覆寫、不補鍵），所以部署檔永遠優先</li>
 *   <li>解析失敗丟 {@link IllegalArgumentException}，讓 reload 能回報並保留舊快照，而不是靜靜變成空設定</li>
 *   <li>{@code YamlConfiguration.loadConfiguration(File)} 會吞掉解析錯誤，所以這裡用 {@code load}／{@code loadFromString}</li>
 * </ul>
 * 會做檔案 IO，可以在非同步執行緒呼叫。
 */
public final class YamlFiles {

    private YamlFiles() {
    }

    /** 部署檔，jar 內預設疊在底下：{@code get(path)} 在部署檔缺鍵時回 jar 內的值。 */
    public static YamlConfiguration layered(JavaPlugin plugin, String name) {
        YamlConfiguration deployed = deployed(plugin, name);
        deployed.setDefaults(bundled(plugin, name));
        return deployed;
    }

    /** 只有部署檔本身（不含預設）；檔案不存在時先寫出 jar 內的模板。 */
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

    /** jar 內出貨的那份。 */
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

/** 把 config.yml 讀成原始值，驗證交給 {@link HomeConfig#from}。可在非同步執行緒呼叫。 */
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
            Object value = yaml.get(key); // 部署檔缺鍵 → 落到 jar 內預設
            if (value != null) {
                raw.put(key, value);
            }
        }
        return HomeConfig.from(raw);
    }
}
```

### `Lang.java`（MiniMessage 訊息表）

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
 * lang.yml 的不可變訊息表（部署檔優先、缺鍵用 jar 內預設）。
 *
 * <p>插入規則：
 * <ul>
 *   <li>{@code {name}} 風格：值經 {@link MiniMessage#escapeTags} 後以純文字插入，玩家打的 {@code <red>} 不會生效</li>
 *   <li>{@code <player>} 風格：用 {@code Placeholder.unparsed}（純文字）或 {@code Placeholder.component}（可信的 Component）</li>
 * </ul>
 * 缺鍵時回傳紅色的 {@code [missing key]} 並只記一行 log。
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

    /** 測試用：直接給模板表。 */
    public static Lang of(Map<String, String> templates, Logger log) {
        return new Lang(templates, log);
    }

    /** 讀 lang.yml（可在非同步執行緒呼叫）；問題用 {@code warn} 回報，解析失敗丟 {@link IllegalArgumentException}。 */
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

    /** 攤平成 {@code a.b.c → 文字}；非文字的值（on/off 被解析成布林等）警告並略過。 */
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

    /** {@code {name}} 風格：vars 的值以純文字插入。 */
    public Component line(String key, Map<String, String> vars) {
        return line(key, vars, TagResolver.empty());
    }

    /** {@code <player>} 風格：用 {@code Placeholder.unparsed} 等 TagResolver。 */
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

    /** 單趟取代 {@code {name}}：值裡面即使含 {@code {other}} 也不會再被取代；未知的 placeholder 原樣保留。 */
    static String fill(String template, Map<String, String> vars) {
        return PLACEHOLDER.matcher(template).replaceAll(match -> {
            String value = vars.get(match.group(1));
            return Matcher.quoteReplacement(value == null ? match.group() : MM.escapeTags(value));
        });
    }
}
```

### `Settings.java`（一份快照）

```java
package com.example.home.config;

import java.util.Objects;

/** 目前生效的設定與訊息。整份不可變；reload 時建新的一份整個換掉。 */
public record Settings(HomeConfig config, Lang lang) {

    public Settings {
        Objects.requireNonNull(config, "config");
        Objects.requireNonNull(lang, "lang");
    }
}
```

### `SettingsService.java`（持有快照、非同步 reload）

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
 * 持有目前的 {@link Settings}。處理器只呼叫 {@link #current()}，不碰 getConfig()。
 *
 * <p>reload：非同步讀檔並建新快照 → 主執行緒換入 → 回報結果。失敗時保留舊快照。
 * 用 {@link AtomicReference} 是因為 PlaceholderAPI／封包 listener 可能在別的執行緒讀快照。
 */
public final class SettingsService {

    /** reload 的結果；settings 為 null 代表失敗（error 有原因）。 */
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

    /** onEnable 用：同步載入並換入，回傳警告。解析失敗會丟例外，由呼叫端停用插件。 */
    public List<String> loadNow() {
        List<String> warnings = new ArrayList<>();
        Settings settings = build(warnings);
        current.set(settings);
        return warnings;
    }

    /**
     * 非同步 reload。{@code onMain} 一定在主執行緒呼叫（插件仍啟用時）。
     * 已有 reload 在跑時立刻回報失敗，不排隊。
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
                    current.set(fresh); // 主執行緒原子換入；失敗時舊快照原封不動
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

/** {@code /homeadmin reload}：非同步重讀設定，完成後把結果與警告回報給下指令的人。 */
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

    /** 在主執行緒執行；訊息用「目前」的快照（reload 成功就是新的，失敗就是舊的）。 */
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
            lang.send(sender, "reload.warning", Map.of("warning", warning)); // 警告含檔案內容，一律當純文字
        }
    }
}
```

### `HomePlugin.java`（接線）

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
        // 其他元件以建構子拿到 settings（或 settings::current），不靜態持有
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/
├── java/com/example/home/
│   ├── HomePlugin.java                  ← 接線
│   ├── ReloadCommand.java
│   └── config/
│       ├── HomeConfig.java              ← 純 JDK 的 record + 驗證
│       ├── YamlFiles.java
│       ├── ConfigLoader.java
│       ├── Lang.java
│       ├── Settings.java
│       └── SettingsService.java
└── resources/
    ├── plugin.yml
    ├── config.yml                       ← 含 config-version 與版本紀錄
    └── lang.yml
src/test/java/com/example/home/
├── config/HomeConfigTest.java
└── LangKeysTest.java                    ← 死鍵／缺鍵測試（見 examples.md）
```

## 部署檢查清單 / Deploy Checklist

已部署伺服器的檔案**不會**跟著新 jar 更新，每次改設定或訊息都要做以下檢查：

1. **新鍵不會自動寫進部署檔**：`saveResource` 只在檔案不存在時執行。新鍵靠 `HomeConfig.DEFAULTS` 與 jar 內分層預設生效；若希望管理員看得到，要在更新說明列出，並請他們手動貼上。
2. **已存在鍵的型別變更會被靜靜忽略**：部署檔裡的舊值仍然優先，型別不對時 `HomeConfig.from` 只會警告並回退預設。改型別或改語意＝換新鍵名，不要重用舊鍵。
3. **列出「要手動刪除或修改的部署鍵」**：每個 PR 的測試計畫寫清楚哪些鍵在已部署伺服器上必須人工處理，部署後逐條驗證（例如看某則訊息不是 `[missing ...]`）。
4. **改了 `config.yml` 就加 `config-version` 並在檔案上方寫一行紀錄**：啟動與 reload 時比對，落後會在 log 與指令回覆列出警告。
5. **不要用 `copyDefaults(true)` + `save()` 補鍵**：Bukkit 寫檔會吃掉註解、重排鍵，管理員的調整會被洗掉。
6. **解析失敗不能變空設定**：reload 失敗要保留舊快照並回報原因；啟動失敗要停用插件。

## YAML 陷阱 / YAML Traps

| 寫法 | 實際解析 | 對策 |
|------|---------|------|
| `on:` / `off:` / `yes:` / `no:` 當鍵 | 布林鍵 `true` / `false` | 加引號：`"on":` |
| `toggle: on` | 值是布林，不是文字 | `toggle: "on"` |
| `name: 1.10` | 浮點數 `1.1` | 當字串的值一律加引號 |
| `max: 010` | 八進位 | 不要前導 0，或加引號 |
| 訊息含 `: ` 或以 `#`、`<` 開頭 | 被當成對應或註解 | 整串加雙引號 |
| 文字含 `"` | 提早結束字串 | 外層改單引號，或用 `\"` |

`Lang.load` 會對「非文字的值」與「看起來像布林的鍵」發出警告，把這類錯誤變成看得見的訊息。

## 執行緒安全注意事項 / Thread Safety

- 讀檔與解析（`YamlFiles`、`ConfigLoader`、`Lang.load`）可在非同步執行緒；**不要**在那裡碰 `Player`、`World`
- 換入快照在主執行緒；`Settings` 整份不可變，所以任何執行緒讀 `current()` 都安全（PlaceholderAPI、封包 listener）
- 非同步階段只收集警告到自己的 `ArrayList`，不與其他執行緒共用
- 處理器若跨越非同步邊界，先在主執行緒取出需要的設定值再傳入，或每次呼叫都重新 `current()`；不要把某次的 `Settings` 存進長壽欄位（reload 後會過時）
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 新版加的鍵在伺服器上沒出現 | `saveResource` 只在檔案不存在時寫出 | 依「部署檢查清單」手動貼上；靠分層預設與 `DEFAULTS` 讓功能照常運作 |
| 改了鍵的型別，伺服器行為沒變 | 部署檔舊值優先，型別不符被警告後回退預設 | 換新鍵名；部署檢查清單列出要刪的舊鍵 |
| 訊息顯示 `[missing toggle.on]` | `on`/`off` 鍵被 YAML 解析成布林 | 鍵加引號；看 `Lang.load` 的警告 |
| 玩家名字 `<red>` 讓訊息變色 | 玩家輸入被當成 MiniMessage 解析 | 用 `Map` 版（自動 escape）或 `Placeholder.unparsed` |
| 訊息顯示字面 `{name}` | 模板的 placeholder 名稱與 vars 的鍵不一致 | 名稱統一小寫；測試比對模板與呼叫端 |
| reload 後行為沒變 | 處理器快取了舊 `Settings` 或呼叫了 `getConfig()` | 處理器只呼叫 `settings.current()` |
| reload 後設定變回預設 | YAML 解析失敗被吞 | 用 `YamlConfiguration.load`（會丟例外），保留舊快照並回報 |
| 刪功能後 lang.yml 越來越肥 | 死鍵沒人清 | 加死鍵測試（`LangKeysTest`，見 examples.md） |
| 訊息顯示 `§` 或亂碼色碼 | 使用了 `ChatColor`／舊式色碼 | 只用 MiniMessage；外部傳來的舊式色碼文字先 escape 再插入 |
