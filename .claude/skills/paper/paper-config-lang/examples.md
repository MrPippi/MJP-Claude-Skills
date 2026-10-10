# examples — paper-config-lang

## Example 1: Handler Reads the Snapshot, Player Input Inserted Safely Into Messages

**Input:**
```
base_package: com.example.home
config_keys: max-homes, teleport-cooldown-seconds
lang_keys: home.set, home.limit, welcome
```

**Output — the `/sethome` handler: reads `settings.current()` on every call, never calls `getConfig()`, never stores `Settings` in a field:**
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
        Settings now = settings.current();          // One consistent snapshot used for this whole command
        HomeConfig config = now.config();
        Lang lang = now.lang();

        String name = args.length > 0 ? args[0] : config.defaultHomeName();
        if (ownedHomes(player) >= config.maxHomes()) {
            lang.send(player, "home.limit", Map.of("max", String.valueOf(config.maxHomes())));
            return true;
        }
        // name is typed by the player: the Map overload escapes it, so "<rainbow>" is displayed literally
        lang.send(player, "home.set", Map.of("name", name));
        return true;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        // <player> style: Placeholder.unparsed treats the name as plain text, so MiniMessage does not parse it
        settings.current().lang().send(event.getPlayer(), "welcome",
                Placeholder.unparsed("player", event.getPlayer().getName()));
    }

    private int ownedHomes(Player player) {
        return 0; // In practice, queried from the Repository
    }
}
```

**Key rules:**
- `{name}` style (`Map<String,String>`): values are escaped automatically; suited to player names, home names, and chat content
- `<player>` style (`TagResolver`): `Placeholder.unparsed` is plain text; use `Placeholder.component` only for a `Component` **built by your own code** (for example item names or fragments with hover text)
- Never do `MiniMessage.deserialize(template.replace("{name}", playerInput))`: players could inject tags such as `<click:run_command:...>`

---

## Example 2: The `/homeadmin reload` Flow and Adding a Config Key

**Input:**
```
change: add "teleport-warmup-seconds" (0-30, default 3)
```

**Step 1 — add the field, key, and validation to `HomeConfig`, and bump `CURRENT_VERSION` (only the changed fragments are shown):**
```java

import java.time.Duration;
import java.util.List;

public final class WarmupKeyChange {

    // The HomeConfig record gains a Duration teleportWarmup field, and DEFAULTS gains Duration.ofSeconds(3)
    public static final int CURRENT_VERSION = 3;

    public static final String KEY_WARMUP = "teleport-warmup-seconds";

    // Update KEYS too, otherwise ConfigLoader cannot read the new key
    public static final List<String> KEYS = List.of(
            HomeConfig.KEY_VERSION, HomeConfig.KEY_MAX_HOMES, HomeConfig.KEY_COOLDOWN,
            HomeConfig.KEY_CONFIRM, HomeConfig.KEY_DEFAULT_NAME, KEY_WARMUP);

    // Inside from(...): int warmup = intIn(raw, KEY_WARMUP, 0, 30, 3, warnings);
    public static final Duration DEFAULT_WARMUP = Duration.ofSeconds(3);

    private WarmupKeyChange() {
    }
}
```

**Step 2 — the shipped `config.yml` (one more version-history line, number bumped, new key with a comment):**
```yaml
# Version history (bump config-version when you add, rename or retype a key):
#   1: first release
#   2: added confirm-teleport
#   3: added teleport-warmup-seconds
config-version: 3

# Seconds a player must stand still before the teleport happens (0-30).
teleport-warmup-seconds: 3
```

**Step 3 — reload on an already-deployed server; what the admin sees:**
```
> /homeadmin reload
Home settings reloaded with 1 warning(s):
 - config.yml is config-version 2 but the plugin expects 3; new keys are not added to existing files, copy them from the bundled config.yml and bump the number
```
The feature keeps working (`teleport-warmup-seconds` uses the layered default of 3 seconds). After the admin pastes the new key and changes `config-version` to `3`, reloading again clears the warning.

**Reload sequence (`SettingsService.reload`):**

| Step | Thread | What happens |
|------|--------|--------|
| 1 | Main | The command calls `reload(cb)`; if a reload is already running -> returns `busy` immediately |
| 2 | Async | `ConfigLoader.load()`, `Lang.load()`: read files, parse, validate, collect warnings |
| 3 | Main | Success -> `current.set(new snapshot)`; failure -> old snapshot untouched |
| 4 | Main | `cb`: reports the result and warnings to the command sender using the "current" `Lang` |

**Deploy checklist (put it in the PR test plan):**
- [ ] The deployed `config.yml` has no `teleport-warmup-seconds`: after reload a warning appears and the teleport waits 3 seconds
- [ ] The admin pastes `teleport-warmup-seconds: 10` and changes `config-version` to 3: reload shows no warning and the wait is 10 seconds
- [ ] Writing `teleport-warmup-seconds: abc`: warns `must be a whole number`, and the wait stays at the default 3 seconds

---

## Example 3: JUnit Dead-Key / Missing-Key Test and Config Validation Test

**Input:**
```
test_goal: every leaf key in lang.yml is read by some code (dead keys), every key the code reads exists in lang.yml (missing keys), and bad config values fall back to defaults with a warning
```

**Output — `LangKeysTest.java` (no Bukkit server needed; it only reads the source code and the bundled lang.yml):**
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
 * Dead key: a leaf key in lang.yml that no source string literal reads -> delete it.
 * Missing key: a key used in source via line("...") / send(..., "...") that is not in lang.yml -> players would see [missing ...].
 * Composed keys ("dialog.pref." + id) are covered by a prefix literal ending in "."; only add to DYNAMIC_PREFIXES what the scan cannot find.
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
                bad.add(key + " = " + lang.get(key)); // on/off/yes/no values were parsed as booleans
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

    /** Scans the double-quoted string literals of all .java files (skipping comments, so a key mentioned only in a comment does not count as read). */
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

**Output — `HomeConfigTest.java` (`HomeConfig.from` is pure JDK; no Bukkit needed):**
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

**Run:** `./gradlew test`. The working directory of `LangKeysTest` is the module root (the Gradle default), so `Path.of("src", "main", "java")` finds the source code.
