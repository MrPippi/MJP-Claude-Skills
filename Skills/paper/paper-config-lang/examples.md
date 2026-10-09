# examples — paper-config-lang

## 範例 1：處理器讀快照、玩家輸入安全插入訊息

**Input:**
```
base_package: com.example.home
config_keys: max-homes, teleport-cooldown-seconds
lang_keys: home.set, home.limit, welcome
```

**Output — `/sethome` 的處理器：每次呼叫都讀 `settings.current()`，不呼叫 `getConfig()`，不把 `Settings` 存進欄位:**
```java

import com.example.home.config.HomeConfig;
import com.example.home.config.Lang;
import com.example.home.config.Settings;
import com.example.home.config.SettingsService;
import java.util.Map;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;

public final class SetHomeCommand implements CommandExecutor, Listener {

    private final SettingsService settings;

    public SetHomeCommand(SettingsService settings) {
        this.settings = settings;
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            return false;
        }
        Settings now = settings.current();          // 這次指令使用的整份一致快照
        HomeConfig config = now.config();
        Lang lang = now.lang();

        String name = args.length > 0 ? args[0] : config.defaultHomeName();
        if (ownedHomes(player) >= config.maxHomes()) {
            lang.send(player, "home.limit", Map.of("max", String.valueOf(config.maxHomes())));
            return true;
        }
        // name 是玩家打的：Map 版會 escape，所以 "<rainbow>" 只會原樣顯示
        lang.send(player, "home.set", Map.of("name", name));
        return true;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        // <player> 風格：Placeholder.unparsed 把名字當純文字，不會被 MiniMessage 解析
        settings.current().lang().send(event.getPlayer(), "welcome",
                Placeholder.unparsed("player", event.getPlayer().getName()));
    }

    private int ownedHomes(Player player) {
        return 0; // 實際由 Repository 查詢
    }
}
```

**規則重點:**
- `{name}` 風格（`Map<String,String>`）：值自動 escape；適合玩家名、家的名稱、聊天內容
- `<player>` 風格（`TagResolver`）：`Placeholder.unparsed` 是純文字；`Placeholder.component` 只給**程式自己建的** `Component`（例如物品名稱、帶 hover 的片段）
- 絕對不要 `MiniMessage.deserialize(template.replace("{name}", playerInput))`：玩家可以注入 `<click:run_command:...>` 之類的標籤

---

## 範例 2：`/homeadmin reload` 流程與新增一個設定鍵

**Input:**
```
change: 新增 "teleport-warmup-seconds"（0-30，預設 3）
```

**Step 1 — `HomeConfig` 新增欄位、鍵、驗證，並把 `CURRENT_VERSION` 加一（只列出變動的片段）:**
```java

import java.time.Duration;
import java.util.List;

public final class WarmupKeyChange {

    // HomeConfig 的 record 多一個 Duration teleportWarmup 欄位，DEFAULTS 多 Duration.ofSeconds(3)
    public static final int CURRENT_VERSION = 3;

    public static final String KEY_WARMUP = "teleport-warmup-seconds";

    // KEYS 一起更新，否則 ConfigLoader 讀不到新鍵
    public static final List<String> KEYS = List.of(
            HomeConfig.KEY_VERSION, HomeConfig.KEY_MAX_HOMES, HomeConfig.KEY_COOLDOWN,
            HomeConfig.KEY_CONFIRM, HomeConfig.KEY_DEFAULT_NAME, KEY_WARMUP);

    // from(...) 裡：int warmup = intIn(raw, KEY_WARMUP, 0, 30, 3, warnings);
    public static final Duration DEFAULT_WARMUP = Duration.ofSeconds(3);

    private WarmupKeyChange() {
    }
}
```

**Step 2 — 出貨的 `config.yml`（版本紀錄多一行、number 加一、新鍵附註解）:**
```yaml
# Version history (bump config-version when you add, rename or retype a key):
#   1: first release
#   2: added confirm-teleport
#   3: added teleport-warmup-seconds
config-version: 3

# Seconds a player must stand still before the teleport happens (0-30).
teleport-warmup-seconds: 3
```

**Step 3 — 在已部署的伺服器上 reload，管理員看到的結果:**
```
> /homeadmin reload
Home settings reloaded with 1 warning(s):
 - config.yml is config-version 2 but the plugin expects 3; new keys are not added to existing files, copy them from the bundled config.yml and bump the number
```
功能照常運作（`teleport-warmup-seconds` 走分層預設 3 秒）。管理員貼上新鍵並把 `config-version` 改成 `3` 後再 reload，警告消失。

**reload 的時序（`SettingsService.reload`）:**

| 階段 | 執行緒 | 做什麼 |
|------|--------|--------|
| 1 | 主 | 指令呼叫 `reload(cb)`；已有 reload 在跑 → 立刻回 `busy` |
| 2 | 非同步 | `ConfigLoader.load()`、`Lang.load()`：讀檔、解析、驗證，收集警告 |
| 3 | 主 | 成功 → `current.set(新快照)`；失敗 → 舊快照不動 |
| 4 | 主 | `cb`：用「目前」的 `Lang` 把結果與警告回報給指令發送者 |

**部署檢查清單（寫進 PR 的測試計畫）:**
- [ ] 已部署的 `config.yml` 沒有 `teleport-warmup-seconds`：reload 後警告出現，傳送等待 3 秒
- [ ] 管理員貼上 `teleport-warmup-seconds: 10` 並把 `config-version` 改成 3：reload 無警告，等待 10 秒
- [ ] 寫 `teleport-warmup-seconds: abc`：警告 `must be a whole number`，等待仍是預設 3 秒

---

## 範例 3：JUnit 死鍵／缺鍵測試與設定驗證測試

**Input:**
```
test_goal: lang.yml 的每個葉鍵都有程式在讀（死鍵）、程式讀的每個鍵都在 lang.yml（缺鍵）、壞設定值回退預設並給警告
```

**Output — `LangKeysTest.java`（不需要 Bukkit 伺服器，只讀原始碼與 jar 內的 lang.yml）:**
```java

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.bukkit.configuration.InvalidConfigurationException;
import org.bukkit.configuration.file.YamlConfiguration;
import org.junit.jupiter.api.Test;

/**
 * 死鍵：lang.yml 的葉鍵沒有任何原始碼字串常值在讀 → 刪掉它。
 * 缺鍵：原始碼 line("…")／send(…, "…") 用到的鍵不在 lang.yml → 玩家會看到 [missing …]。
 * 組鍵（"dialog.pref." + id）用「以 . 結尾的前綴常值」覆蓋；掃不到的才加進 DYNAMIC_PREFIXES。
 */
class LangKeysTest {

    private static final Set<String> DYNAMIC_PREFIXES = Set.of();
    private static final Pattern USED_KEY =
            Pattern.compile("(?:line|send)\\((?:[^\"\\n,]*,\\s*)?\"([a-z0-9_.-]+)\"");

    @Test
    void everyLangKeyIsReadBySomeCode() throws IOException {
        Set<String> literals = literals(Path.of("src", "main", "java"));
        literals.addAll(DYNAMIC_PREFIXES);
        List<String> dead = new ArrayList<>();
        YamlConfiguration lang = bundledLang();
        for (String key : lang.getKeys(true)) {
            if (!lang.isConfigurationSection(key) && !covered(key, literals)) {
                dead.add(key);
            }
        }
        assertEquals(List.of(), dead, "dead lang keys: delete them, or add a prefix to DYNAMIC_PREFIXES");
    }

    @Test
    void everyKeyUsedInCodeExistsInLang() throws IOException {
        YamlConfiguration lang = bundledLang();
        List<String> missing = new ArrayList<>();
        try (Stream<Path> files = Files.walk(Path.of("src", "main", "java"))) {
            for (Path file : (Iterable<Path>) files.filter(p -> p.toString().endsWith(".java"))::iterator) {
                Matcher m = USED_KEY.matcher(Files.readString(file, StandardCharsets.UTF_8));
                while (m.find()) {
                    String key = m.group(1);
                    if (key.contains(".") && !lang.isString(key)) {
                        missing.add(file.getFileName() + " -> " + key);
                    }
                }
            }
        }
        assertEquals(List.of(), missing, "keys used in code but absent from lang.yml");
    }

    @Test
    void noBooleanSurprisesInLang() throws IOException {
        YamlConfiguration lang = bundledLang();
        List<String> bad = new ArrayList<>();
        for (String key : lang.getKeys(true)) {
            boolean leaf = !lang.isConfigurationSection(key);
            if (leaf && !lang.isString(key)) {
                bad.add(key + " = " + lang.get(key)); // on/off/yes/no 值被解析成布林
            }
            for (String segment : key.split("\\.")) {
                if (segment.equals("true") || segment.equals("false")) {
                    bad.add(key + " (unquoted on/off key)");
                }
            }
        }
        assertEquals(List.of(), bad);
    }

    @Test
    void coverageRuleCatchesDeadKeys() {
        Set<String> lits = Set.of("home.set", "dialog.pref.");
        assertTrue(covered("home.set", lits));
        assertTrue(covered("dialog.pref.pay", lits));
        assertFalse(covered("home.gone", lits));
        assertFalse(covered("dialog.prefs.pay", lits));
    }

    static boolean covered(String key, Set<String> literals) {
        if (literals.contains(key)) {
            return true;
        }
        for (String literal : literals) {
            if (literal.endsWith(".") && key.startsWith(literal)) {
                return true;
            }
        }
        return false;
    }

    private static YamlConfiguration bundledLang() throws IOException {
        try (InputStream in = LangKeysTest.class.getResourceAsStream("/lang.yml")) {
            assertTrue(in != null, "lang.yml must be on the test classpath");
            YamlConfiguration yaml = new YamlConfiguration();
            yaml.loadFromString(new String(in.readAllBytes(), StandardCharsets.UTF_8));
            return yaml;
        } catch (InvalidConfigurationException e) {
            throw new IOException("lang.yml is not valid YAML", e);
        }
    }

    /** 掃所有 .java 的雙引號字串常值（略過註解，所以註解裡提到的鍵不算有人讀）。 */
    private static Set<String> literals(Path root) throws IOException {
        Set<String> out = new HashSet<>();
        Pattern literal = Pattern.compile("\"((?:[^\"\\\\\\n]|\\\\.)*)\"");
        try (Stream<Path> files = Files.walk(root)) {
            for (Path file : (Iterable<Path>) files.filter(p -> p.toString().endsWith(".java"))::iterator) {
                String src = Files.readString(file, StandardCharsets.UTF_8)
                        .replaceAll("(?s)/\\*.*?\\*/", "")
                        .replaceAll("(?m)//.*$", "");
                Matcher m = literal.matcher(src);
                while (m.find()) {
                    out.add(m.group(1));
                }
            }
        }
        return out;
    }
}
```

**Output — `HomeConfigTest.java`（`HomeConfig.from` 純 JDK，不需要 Bukkit）:**
```java

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

class HomeConfigTest {

    @Test
    void validValuesAreUsedWithoutWarnings() {
        HomeConfig.Parsed parsed = HomeConfig.from(Map.of(
                HomeConfig.KEY_VERSION, HomeConfig.CURRENT_VERSION,
                HomeConfig.KEY_MAX_HOMES, 10,
                HomeConfig.KEY_COOLDOWN, 0));
        assertEquals(10, parsed.config().maxHomes());
        assertEquals(Duration.ZERO, parsed.config().teleportCooldown());
        assertEquals(java.util.List.of(), parsed.warnings());
    }

    @Test
    void badValuesFallBackToDefaultsWithWarnings() {
        HomeConfig.Parsed parsed = HomeConfig.from(Map.of(
                HomeConfig.KEY_VERSION, HomeConfig.CURRENT_VERSION,
                HomeConfig.KEY_MAX_HOMES, "many",
                HomeConfig.KEY_COOLDOWN, 99999,
                HomeConfig.KEY_CONFIRM, "yes",
                HomeConfig.KEY_DEFAULT_NAME, "Bad Name!"));
        assertEquals(HomeConfig.DEFAULTS, parsed.config());
        assertEquals(4, parsed.warnings().size());
    }

    @Test
    void oldOrMissingVersionWarns() {
        assertTrue(HomeConfig.from(Map.of()).warnings().get(0).contains(HomeConfig.KEY_VERSION));
        assertTrue(HomeConfig.from(Map.of(HomeConfig.KEY_VERSION, 1)).warnings().get(0).contains("expects"));
    }
}
```

**執行:** `./gradlew test`。`LangKeysTest` 的工作目錄是模組根目錄（Gradle 預設），所以 `Path.of("src", "main", "java")` 找得到原始碼。
