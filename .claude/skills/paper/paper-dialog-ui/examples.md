# examples — paper-dialog-ui

## Example 1: Delete-Home Confirmation (async delete after confirming, then back to the main thread to notify)

**Input:**
```
dialog_kind: confirm
after_action: CLOSE
Scenario: /home delete base -> confirm first; the delete writes to the database, so it must not run on the main thread
```

**Output — confirm is on the right; after confirming, leave the main thread for IO, then return to the main thread and re-validate the player:**
```java
import com.example.menu.gui.ConfirmDialog;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.UUID;

public final class HomeDeleteFlow {

    /** Data-layer interface for the example; use a Repository in practice. */
    public interface HomeRepository {
        boolean delete(UUID owner, String name);
    }

    private final Plugin plugin;
    private final ConfirmDialog confirm;
    private final HomeRepository homes;

    public HomeDeleteFlow(Plugin plugin, ConfirmDialog confirm, HomeRepository homes) {
        this.plugin = plugin;
        this.confirm = confirm;
        this.homes = homes;
    }

    /** Call on the main thread (command or GUI click). */
    public void ask(Player player, String homeName) {
        confirm.open(player, "<red>Delete home",
            "Delete home <yellow>" + homeName + "</yellow>? This cannot be undone.",
            clicker -> delete(clicker.getUniqueId(), homeName));
    }

    /** The confirm callback is already on the main thread; push the database work to async, then return to the main thread with the result. */
    private void delete(UUID playerId, String homeName) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            boolean deleted = homes.delete(playerId, homeName);
            Bukkit.getScheduler().runTask(plugin, () -> {
                Player player = Bukkit.getPlayer(playerId);   // Re-fetch: the player may have gone offline
                if (player == null || !player.isOnline()) {
                    return;
                }
                player.sendMessage(deleted
                    ? Component.text("Home deleted.")
                    : Component.text("That home no longer exists."));
            });
        });
    }
}
```

Key points:
- `ConfirmDialog` already handles "hop to the main thread + player is online" in the callback; the async part after `delete` must still return to the main thread and call `getPlayer` again
- The cancel button has no callback, and Esc just closes, so confirm is never triggered by accident

---

## Example 2: In-Place Toggle Settings Page (`afterAction = NONE`, no flicker)

**Input:**
```
dialog_kind: multi
after_action: NONE
Scenario: /settings shows several toggles on one page; clicking one toggles it and the page updates in place, with only "Close" in the footer
```

**Output — rebuild the whole page on every click (the old callback's uses are spent), and use `NONE` so the screen does not close:**
```java
import com.example.menu.gui.Dialogs;
import io.papermc.paper.registry.data.dialog.DialogBase.DialogAfterAction;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class SettingsDialog {

    private final Dialogs dialogs;
    /** In-memory cache of player settings; use a service in practice. */
    private final Map<UUID, Map<String, Boolean>> state = new ConcurrentHashMap<>();
    private final List<String> keys = List.of("Join messages", "Sound effects", "Action bar hints");

    public SettingsDialog(Dialogs dialogs) {
        this.dialogs = dialogs;
    }

    public void open(Player player) {
        Map<String, Boolean> current = state.getOrDefault(player.getUniqueId(), Map.of());
        List<Dialogs.Button> buttons = new ArrayList<>();
        for (String key : keys) {
            boolean on = current.getOrDefault(key, true);
            Component label = Component.text(key + ": ")
                .append(Component.text(on ? "ON" : "OFF", on ? NamedTextColor.GREEN : NamedTextColor.RED));
            buttons.add(dialogs.button(label, p -> {
                toggle(p.getUniqueId(), key);
                open(p);   // Redraw in place: afterAction is NONE, so the screen does not close and reopen
            }));
        }
        // NONE never closes automatically, so Close must call closeDialog() explicitly
        buttons.add(dialogs.button(Component.text("Close"), Player::closeDialog));

        Dialogs.Page page = Dialogs.Page.of(Component.text("Settings"), buttons)
            .withBody(List.of(DialogBody.plainMessage(Component.text("Click a row to toggle it."))))
            .withColumns(1)
            .withAfterAction(DialogAfterAction.NONE);
        dialogs.show(player, page);
    }

    private void toggle(UUID id, String key) {
        state.compute(id, (ignored, old) -> {
            Map<String, Boolean> next = new ConcurrentHashMap<>(old == null ? Map.of() : old);
            next.put(key, !next.getOrDefault(key, true));
            return Map.copyOf(next);
        });
    }
}
```

Key points:
- A `uses(1)` callback is spent after one click, so redrawing must go through `open(p)` and build a new Dialog; old buttons cannot be reused
- When the page needs async-loaded data, use `DialogAfterAction.WAIT_FOR_RESPONSE` on the clicked page: the player sees a waiting screen until you `showDialog` a new page or call `closeDialog()`

---

## Example 3: Opening an Input Form and Handling the Result (with validation)

**Input:**
```
dialog_kind: input
inputs: text, boolean, number, option
Scenario: /prefs opens the form, validates the nickname on save, and closes only on success
```

**Output — opening the form and the save callback:**
```java
import com.example.menu.gui.PreferencesDialog;
import com.example.menu.gui.PreferencesDialog.Preferences;
import net.kyori.adventure.text.Component;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.jspecify.annotations.NonNull;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class PrefsCommand implements CommandExecutor {

    private final PreferencesDialog dialog;
    private final Map<UUID, Preferences> saved = new ConcurrentHashMap<>();

    public PrefsCommand(PreferencesDialog dialog) {
        this.dialog = dialog;
    }

    @Override
    public boolean onCommand(@NonNull CommandSender sender, @NonNull Command command,
                             @NonNull String label, @NonNull String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage(Component.text("Players only."));
            return true;
        }
        Preferences current = saved.getOrDefault(player.getUniqueId(),
            new Preferences(player.getName(), true, 5, "safe"));
        dialog.open(player, current, this::save);
        return true;
    }

    /** onSave is called on the main thread while the player is online; the nickname is already confirmed non-empty. */
    private void save(Player player, Preferences value) {
        saved.put(player.getUniqueId(), value);
        player.sendMessage(Component.text("Saved. Radius " + value.radius() + ", mode " + value.mode() + "."));
    }
}
```

---

## Example 4: `paper-plugin.yml` for Attaching a Static Dialog to the Pause Menu

**Input:**
```
dialog_kind: pause-screen
pause_screen: true
```

**Output — `paper-plugin.yml` (see SKILL.md for `PauseMenuBootstrap`):**
```yaml
name: PauseMenu
version: '${version}'
main: com.example.menu.PauseMenuPlugin
bootstrapper: com.example.menu.PauseMenuBootstrap
api-version: '26.2'
```

Deployment checks:
- The server startup log has no `Failed to register the pause menu dialog`; if it does, `PauseMenuPlugin#onEnable` also prints a WARNING line
- In game, press ESC; the pause menu should show the new entry. If not, check the `bootstrapper` path and `api-version`
- A Dialog registered during bootstrap is static: buttons use `staticAction(ClickEvent.runCommand(...))`; for dynamic pages that carry player data, open them with `Dialogs` after the plugin starts
