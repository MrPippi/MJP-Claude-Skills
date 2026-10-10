---
name: paper-dialog-ui
description: "Paper Dialog API 介面模式：薄 Dialogs 包裝、通知／確認／多按鈕／輸入表單、customClick 回呼切回主執行緒、確認鍵在右、暫停選單（pause_screen_additions）註冊 / Paper Dialog API UI patterns: thin helper, notice/confirm/multi-action/input dialogs, main-thread hop in callbacks, confirm-on-right, pause-screen registration from a bootstrapper"
---

# Paper Dialog UI

## Skill Name

`paper-dialog-ui`

## Purpose

Build player UIs with Paper's Dialog API (Paper 1.21.7+): notices, confirmations, multi-button menus, forms with input fields, and custom pages attached to the ESC pause menu.
The API has four common pitfalls, and this skill folds them into one thin `Dialogs` helper:

1. **Button callbacks are not guaranteed to run on the main thread**: hop back to the main thread inside the `DialogAction.customClick` callback, and re-check that the player is online and the plugin is still enabled.
2. **The confirm button is always on the right**: do not rely on the ordering of `DialogType.confirmation`; use a two-column `multiAction([cancel, confirm])` instead.
3. **`afterAction` decides whether the screen flickers**: closing, redrawing in place, and waiting for a server response are three different choices.
4. **`uses` / `lifetime` in `ClickCallback.Options`**: callbacks have a use count and an expiry, so build a new `Dialog` every time a page opens.

The second template shows how to register a static Dialog from a `PluginBootstrap` (`paper-plugin.yml`) using registry/lifecycle events, add it to the `pause_screen_additions` tag, and never throw from bootstrap.

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (the Dialog API is available since Paper 1.21.7; both versions are compile-verified and the template code is identical on both)
- Pure Paper API, no Paperweight needed
- A plugin using Dialogs needs `api-version` of at least `1.21.7`

## Triggers

- 「Dialog」「對話框」「Paper Dialog API」「showDialog」「DialogAction」
- 「確認視窗」「輸入表單」「文字輸入框」「按鈕選單」「confirm dialog」
- 「ESC 選單」「暫停選單」「pause_screen_additions」「PluginBootstrap」
- 「customClick」「ClickCallback」「DialogResponseView」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `package` | `com.example.menu.gui` | Package of the Dialog classes |
| `dialog_kind` | `notice` / `confirm` / `multi` / `input` / `pause-screen` | Which kind of page to build |
| `inputs` | `text`, `boolean`, `number`, `option` | Form fields (`input` only) |
| `after_action` | `CLOSE` / `NONE` / `WAIT_FOR_RESPONSE` | Screen behavior after a button press |
| `pause_screen` | `true` | Whether the bootstrapper registers it and attaches it to the pause menu |

## Outputs

- `Dialogs.java` - thin helper: `Button`, `Page`, main-thread hop in callbacks, input value reading
- `ConfirmDialog.java` - confirmation page (cancel on the left, confirm on the right) and notice page
- `PreferencesDialog.java` - input form with text / toggle / number slider / single-option fields
- `PauseMenuBootstrap.java` - registers the Dialog during bootstrap and attaches it to `pause_screen_additions`
- `PauseMenuPlugin.java` - the main plugin class returned by `createPlugin`
- `paper-plugin.yml` - declares the `bootstrapper`

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Only `paper-api` (`compileOnly`) is required.

`api-version` in `plugin.yml` or `paper-plugin.yml` must be at least `'1.21.7'`; only plugins that use a bootstrapper need `paper-plugin.yml`:

```yaml
name: PauseMenu
version: '${version}'
main: com.example.menu.PauseMenuPlugin
bootstrapper: com.example.menu.PauseMenuBootstrap
api-version: '26.2'   # 1.21.11 server: '1.21.11'
```

## Code Template

### `Dialogs.java` (thin helper)

```java
package com.example.menu.gui;

import io.papermc.paper.dialog.Dialog;
import io.papermc.paper.dialog.DialogResponseView;
import io.papermc.paper.registry.data.dialog.ActionButton;
import io.papermc.paper.registry.data.dialog.DialogBase;
import io.papermc.paper.registry.data.dialog.DialogBase.DialogAfterAction;
import io.papermc.paper.registry.data.dialog.action.DialogAction;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import io.papermc.paper.registry.data.dialog.input.DialogInput;
import io.papermc.paper.registry.data.dialog.type.DialogType;
import io.papermc.paper.registry.data.dialog.type.MultiActionType;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickCallback;
import org.bukkit.entity.Player;
import org.bukkit.plugin.IllegalPluginAccessException;
import org.bukkit.plugin.Plugin;
import org.jspecify.annotations.Nullable;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.logging.Level;

/**
 * Thin helper around Paper Dialogs.
 *
 * <p>Rules:
 * <ul>
 *   <li>Button callbacks always hop back to the main thread first, then re-fetch the player and check they are online (callbacks carry only a UUID, never a Player)</li>
 *   <li>{@code customClick} callbacks are limited by {@code uses} and {@code lifetime}, so <b>build a new Dialog every time a page opens</b>; never cache it</li>
 *   <li>A button without a callback only closes the screen (when {@code afterAction = CLOSE})</li>
 * </ul>
 */
public final class Dialogs {

    public static final int BUTTON_WIDTH = 150;

    /** Each button can be clicked once and expires after ten minutes; redrawing a page creates a new callback. */
    private static final ClickCallback.Options OPTIONS = ClickCallback.Options.builder()
        .uses(1)
        .lifetime(Duration.ofMinutes(10))
        .build();

    /** A button; a null {@code onClick} means "just close / do nothing". */
    public record Button(Component label, int width, @Nullable BiConsumer<Player, DialogResponseView> onClick) {
    }

    /** Immutable description of a page; derive new pages with withXxx. */
    public record Page(Component title, List<DialogBody> body, List<DialogInput> inputs, List<Button> buttons,
                       int columns, DialogAfterAction afterAction, @Nullable Button exit) {

        public Page {
            body = List.copyOf(body);
            inputs = List.copyOf(inputs);
            buttons = List.copyOf(buttons);
            columns = Math.max(1, columns);
        }

        public static Page of(Component title, List<Button> buttons) {
            return new Page(title, List.of(), List.of(), buttons, buttons.size(), DialogAfterAction.CLOSE, null);
        }

        public Page withBody(List<DialogBody> value) {
            return new Page(title, value, inputs, buttons, columns, afterAction, exit);
        }

        public Page withInputs(List<DialogInput> value) {
            return new Page(title, body, value, buttons, columns, afterAction, exit);
        }

        public Page withColumns(int value) {
            return new Page(title, body, inputs, buttons, value, afterAction, exit);
        }

        public Page withAfterAction(DialogAfterAction value) {
            return new Page(title, body, inputs, buttons, columns, value, exit);
        }

        /** With an exit button set, pressing Esc triggers it; leave it unset on normal confirm pages so Esc just closes. */
        public Page withExit(@Nullable Button value) {
            return new Page(title, body, inputs, buttons, columns, afterAction, value);
        }
    }

    private final Plugin plugin;

    public Dialogs(Plugin plugin) {
        this.plugin = plugin;
    }

    // ---- Button factories ----

    /** Regular button: the callback runs only on the main thread while the player is still online. */
    public Button button(Component label, Consumer<Player> onClick) {
        return new Button(label, BUTTON_WIDTH, (player, view) -> onClick.accept(player));
    }

    /** Submit button: the callback can read the input field values. */
    public Button submit(Component label, BiConsumer<Player, DialogResponseView> onClick) {
        return new Button(label, BUTTON_WIDTH, onClick);
    }

    /** Close-only button (no callback). */
    public Button close(Component label) {
        return new Button(label, BUTTON_WIDTH, null);
    }

    // ---- Display ----

    /** Multi-button page (including confirm pages and input forms). */
    public void show(Player player, Page page) {
        UUID id = player.getUniqueId();
        List<ActionButton> actions = new ArrayList<>();
        for (Button button : page.buttons()) {
            actions.add(toAction(id, button));
        }
        MultiActionType.Builder type = DialogType.multiAction(actions).columns(page.columns());
        Button exit = page.exit();
        if (exit != null) {
            type.exitAction(toAction(id, exit));
        }
        DialogBase base = DialogBase.builder(page.title())
            .canCloseWithEscape(true)
            .pause(false)
            .afterAction(page.afterAction())
            .body(page.body())
            .inputs(page.inputs())
            .build();
        MultiActionType built = type.build();
        player.showDialog(Dialog.create(factory -> factory.empty().base(base).type(built)));
    }

    /** Notice page: a single "OK" button. */
    public void showNotice(Player player, Component title, List<DialogBody> body, Button ok) {
        DialogBase base = DialogBase.builder(title)
            .canCloseWithEscape(true)
            .pause(false)
            .afterAction(DialogAfterAction.CLOSE)
            .body(body)
            .build();
        ActionButton action = toAction(player.getUniqueId(), ok);
        player.showDialog(Dialog.create(factory -> factory.empty().base(base).type(DialogType.notice(action))));
    }

    // ---- Reading input values (field keys are the same as when building the DialogInput) ----

    public static String readText(DialogResponseView view, String key) {
        String value = view.getText(key);
        return value == null ? "" : value.trim();
    }

    public static boolean readBoolean(DialogResponseView view, String key) {
        return Boolean.TRUE.equals(view.getBoolean(key));
    }

    /** A number slider returns a Float; round it for integers. */
    public static int readInt(DialogResponseView view, String key, int fallback) {
        Float value = view.getFloat(key);
        return value == null ? fallback : Math.round(value);
    }

    /** A single-option field returns the option id (first parameter of OptionEntry), read with getText like a text field. */
    public static String readOption(DialogResponseView view, String key, String fallback) {
        String value = view.getText(key);
        return value == null || value.isEmpty() ? fallback : value;
    }

    // ---- Internals ----

    private ActionButton toAction(UUID playerId, Button button) {
        ActionButton.Builder builder = ActionButton.builder(button.label()).width(button.width());
        BiConsumer<Player, DialogResponseView> click = button.onClick();
        if (click != null) {
            builder.action(DialogAction.customClick(
                (response, audience) -> onMain(playerId, player -> click.accept(player, response)), OPTIONS));
        }
        return builder.build();
    }

    /**
     * The callback may arrive on a non-main thread. There is still a narrow window between isEnabled() and runTask
     * (the main thread just finished onDisable); the scheduler then rejects the task. That is not an error: just drop the click.
     */
    private void onMain(UUID playerId, Consumer<Player> action) {
        if (!plugin.isEnabled()) {
            return;
        }
        try {
            plugin.getServer().getScheduler().runTask(plugin, () -> {
                Player player = plugin.getServer().getPlayer(playerId);
                if (player != null && player.isOnline()) {
                    action.accept(player);
                }
            });
        } catch (IllegalPluginAccessException | IllegalStateException e) {
            plugin.getLogger().log(Level.FINE, "Plugin is shutting down; dropped a dialog click", e);
        }
    }
}
```

### `ConfirmDialog.java` (confirm page: cancel on the left, confirm on the right)

```java
package com.example.menu.gui;

import io.papermc.paper.registry.data.dialog.body.DialogBody;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.entity.Player;

import java.util.List;
import java.util.function.Consumer;

/**
 * Confirm page. The confirm button is fixed on the right: a two-column multiAction([cancel, confirm]); DialogType.confirmation
 * is not used (it pins yes on the left, with the buttons in the footer). No exit button is set, so Esc just closes and never presses any button.
 */
public final class ConfirmDialog {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final Dialogs dialogs;

    public ConfirmDialog(Dialogs dialogs) {
        this.dialogs = dialogs;
    }

    /**
     * @param message   MiniMessage string, e.g. {@code "Delete home <yellow>base</yellow>?"}
     * @param onConfirm called on the main thread while the player is still online; pressing Cancel or Esc calls nothing
     */
    public void open(Player player, String title, String message, Consumer<Player> onConfirm) {
        Dialogs.Button cancel = dialogs.close(Component.text("Cancel"));
        Dialogs.Button confirm = dialogs.button(MINI.deserialize("<green>Confirm"), onConfirm);
        Dialogs.Page page = Dialogs.Page.of(MINI.deserialize(title), List.of(cancel, confirm))
            .withBody(List.of(DialogBody.plainMessage(MINI.deserialize(message))))
            .withColumns(2);
        dialogs.show(player, page);
    }

    /** Plain notice: a single "OK" button. */
    public void notice(Player player, String title, String message) {
        dialogs.showNotice(player, MINI.deserialize(title),
            List.of(DialogBody.plainMessage(MINI.deserialize(message))),
            dialogs.close(Component.text("OK")));
    }
}
```

### `PreferencesDialog.java` (input form: text, toggle, number, single option)

```java
package com.example.menu.gui;

import io.papermc.paper.dialog.DialogResponseView;
import io.papermc.paper.registry.data.dialog.DialogBase.DialogAfterAction;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import io.papermc.paper.registry.data.dialog.input.DialogInput;
import io.papermc.paper.registry.data.dialog.input.SingleOptionDialogInput.OptionEntry;
import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;

import java.util.List;
import java.util.function.BiConsumer;

/**
 * Form with four kinds of input fields.
 *
 * <p>afterAction is NONE: on validation failure the form is reopened "in place" with the same values, so the screen does not close and reopen (flicker).
 * Because NONE never closes automatically, both "Cancel" and a successful submit must call {@code closeDialog()} explicitly.
 */
public final class PreferencesDialog {

    /** Immutable form result. */
    public record Preferences(String nickname, boolean notifications, int radius, String mode) {
    }

    private static final String KEY_NICKNAME = "nickname";
    private static final String KEY_NOTIFY = "notify";
    private static final String KEY_RADIUS = "radius";
    private static final String KEY_MODE = "mode";
    private static final int MAX_NICKNAME = 16;

    private final Dialogs dialogs;

    public PreferencesDialog(Dialogs dialogs) {
        this.dialogs = dialogs;
    }

    public void open(Player player, Preferences current, BiConsumer<Player, Preferences> onSave) {
        List<DialogInput> inputs = List.of(
            DialogInput.text(KEY_NICKNAME, Component.text("Nickname"))
                .width(250).maxLength(MAX_NICKNAME).initial(current.nickname()).build(),
            DialogInput.bool(KEY_NOTIFY, Component.text("Notifications"))
                .initial(current.notifications()).build(),
            DialogInput.numberRange(KEY_RADIUS, Component.text("Radius"), 1f, 10f)
                .step(1f).initial((float) current.radius()).build(),
            DialogInput.singleOption(KEY_MODE, Component.text("Mode"), List.of(
                OptionEntry.create("fast", Component.text("Fast"), "fast".equals(current.mode())),
                OptionEntry.create("safe", Component.text("Safe"), "safe".equals(current.mode()))))
                .build());

        Dialogs.Button cancel = dialogs.button(Component.text("Cancel"), Player::closeDialog);
        Dialogs.Button save = dialogs.submit(Component.text("Save"), (p, view) -> {
            Preferences parsed = parse(view, current);
            if (parsed.nickname().isEmpty()) {
                p.sendMessage(Component.text("Nickname cannot be empty."));
                open(p, parsed, onSave);   // Redraw in place, keeping the values the player already entered
                return;
            }
            onSave.accept(p, parsed);
            p.closeDialog();
        });

        Dialogs.Page page = Dialogs.Page.of(Component.text("Preferences"), List.of(cancel, save))
            .withBody(List.of(DialogBody.plainMessage(Component.text("Adjust your settings."))))
            .withInputs(inputs)
            .withColumns(2)
            .withAfterAction(DialogAfterAction.NONE);
        dialogs.show(player, page);
    }

    private static Preferences parse(DialogResponseView view, Preferences fallback) {
        return new Preferences(
            Dialogs.readText(view, KEY_NICKNAME),
            Dialogs.readBoolean(view, KEY_NOTIFY),
            Dialogs.readInt(view, KEY_RADIUS, fallback.radius()),
            Dialogs.readOption(view, KEY_MODE, fallback.mode()));
    }
}
```

### `PauseMenuBootstrap.java` (pause menu: registered during bootstrap)

```java
package com.example.menu;

import io.papermc.paper.dialog.Dialog;
import io.papermc.paper.plugin.bootstrap.BootstrapContext;
import io.papermc.paper.plugin.bootstrap.PluginBootstrap;
import io.papermc.paper.plugin.bootstrap.PluginProviderContext;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import io.papermc.paper.registry.RegistryKey;
import io.papermc.paper.registry.TypedKey;
import io.papermc.paper.registry.data.dialog.ActionButton;
import io.papermc.paper.registry.data.dialog.DialogBase;
import io.papermc.paper.registry.data.dialog.DialogBase.DialogAfterAction;
import io.papermc.paper.registry.data.dialog.action.DialogAction;
import io.papermc.paper.registry.data.dialog.body.DialogBody;
import io.papermc.paper.registry.data.dialog.type.DialogType;
import io.papermc.paper.registry.event.RegistryEvents;
import io.papermc.paper.registry.keys.DialogKeys;
import io.papermc.paper.registry.keys.tags.DialogTagKeys;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.logger.slf4j.ComponentLogger;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Registers a static Dialog into the dialog registry during bootstrap and adds it to the pause_screen_additions tag,
 * so the pause menu opened with ESC gets an entry for this page.
 *
 * <p>Rules:
 * <ul>
 *   <li><b>Never throw</b>: an exception in bootstrap stops Paper from loading the plugin at all; collect errors into {@code problems} and print them after the plugin starts</li>
 *   <li>The bootstrap() body itself does not touch the Dialog API; everything lives in event handlers</li>
 *   <li>There is no Plugin instance at this stage, so buttons on a static Dialog can only use {@code staticAction} (run a command) or
 *       {@code customClick(Key, payload)} (handled by PlayerCustomClickEvent after the plugin starts), not a customClick with a lambda</li>
 * </ul>
 */
public final class PauseMenuBootstrap implements PluginBootstrap {

    static final Key MENU_KEY = Key.key("example", "pause_menu");

    private final List<String> problems = new CopyOnWriteArrayList<>();

    @Override
    public void bootstrap(BootstrapContext context) {
        ComponentLogger log = context.getLogger();
        try {
            context.getLifecycleManager().registerEventHandler(RegistryEvents.DIALOG.compose().newHandler(event -> {
                try {
                    event.registry().register(DialogKeys.create(MENU_KEY), builder -> builder
                        .base(buildBase())
                        .type(buildType()));
                } catch (RuntimeException e) {
                    log.error("Failed to register the pause menu dialog", e);
                    problems.add("dialog registration failed: " + e.getMessage());
                }
            }));
            context.getLifecycleManager().registerEventHandler(
                LifecycleEvents.TAGS.postFlatten(RegistryKey.DIALOG), event -> {
                    try {
                        TypedKey<Dialog> menu = DialogKeys.create(MENU_KEY);
                        event.registrar().addToTag(DialogTagKeys.PAUSE_SCREEN_ADDITIONS, Set.of(menu));
                    } catch (RuntimeException e) {
                        log.error("Failed to add the pause menu to pause_screen_additions", e);
                        problems.add("tag registration failed: " + e.getMessage());
                    }
                });
        } catch (RuntimeException e) {
            log.error("Failed to register bootstrap handlers", e);
            problems.add("bootstrap failed: " + e.getMessage());
        }
    }

    @Override
    public JavaPlugin createPlugin(PluginProviderContext context) {
        return new PauseMenuPlugin(List.copyOf(problems));
    }

    private static DialogBase buildBase() {
        return DialogBase.builder(Component.text("Server Menu"))
            .canCloseWithEscape(true)
            .pause(false)
            .afterAction(DialogAfterAction.CLOSE)
            .body(List.of(DialogBody.plainMessage(Component.text("Quick actions"))))
            .build();
    }

    private static DialogType buildType() {
        ActionButton spawn = ActionButton.builder(Component.text("Spawn"))
            .width(150)
            .action(DialogAction.staticAction(ClickEvent.runCommand("/spawn")))
            .build();
        ActionButton rules = ActionButton.builder(Component.text("Rules"))
            .width(150)
            .action(DialogAction.staticAction(ClickEvent.runCommand("/rules")))
            .build();
        return DialogType.multiAction(List.of(spawn, rules)).columns(2).build();
    }
}
```

### `PauseMenuPlugin.java` (main class returned by `createPlugin`)

```java
package com.example.menu;

import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;

public final class PauseMenuPlugin extends JavaPlugin {

    private final List<String> bootstrapProblems;

    /** Receives the errors collected during bootstrap from PauseMenuBootstrap#createPlugin. */
    PauseMenuPlugin(List<String> bootstrapProblems) {
        this.bootstrapProblems = List.copyOf(bootstrapProblems);
    }

    @Override
    public void onEnable() {
        // Bootstrap must not throw, so errors are printed here (the logger is available now)
        for (String problem : bootstrapProblems) {
            getLogger().warning("Pause menu not fully registered: " + problem);
        }
    }
}
```

## Recommended Directory Structure

```
src/main/java/com/example/menu/
├── PauseMenuBootstrap.java        <- only needed for pause_screen_additions
├── PauseMenuPlugin.java
└── gui/
    ├── Dialogs.java               <- thin helper shared by all Dialogs
    ├── ConfirmDialog.java
    └── PreferencesDialog.java
src/main/resources/
└── paper-plugin.yml               <- bootstrapper field
```

## Thread Safety

- `DialogAction.customClick` callbacks are **not guaranteed to run on the main thread**: check `plugin.isEnabled()` first, hop back with `runTask`, then call `getPlayer(uuid)` again inside and confirm `isOnline()`
- A narrow window remains between `isEnabled()` and `runTask`, so catch `IllegalPluginAccessException` / `IllegalStateException` around `runTask`, log at `FINE`, and drop the click
- Callback lambdas carry only a `UUID`, strings, numbers, and immutable values, never a `Player`
- When a database or HTTP is needed: click -> hop to the main thread and read the input values -> async work -> hop back to the main thread, re-validate, then `showDialog`; use `afterAction = WAIT_FOR_RESPONSE` while waiting
- The Bukkit server is not available during bootstrap; only do registry/tag registration
- See [`references/paper-threading.md`](references/paper-threading.md)

### Key Techniques

| Topic | Approach |
|------|------|
| Confirm button position | `multiAction([cancel, confirm]).columns(2)` puts confirm on the right; do not use `DialogType.confirmation` (yes is pinned on the left) |
| Esc behavior | No `exitAction`: Esc just closes and triggers no button; with `exitAction`: Esc acts like pressing that button |
| `afterAction = CLOSE` | Closes after a button press; use for one-shot actions (confirm, notice) |
| `afterAction = NONE` | Stays on the same screen after a button press; in-place redraws (toggling a switch, reopening after failed validation) do not flicker. **Every button must decide for itself whether to `closeDialog()`** |
| `afterAction = WAIT_FOR_RESPONSE` | Shows a waiting screen until the server sends a new screen or closes it; use for async work |
| `uses` / `lifetime` | Clicks do nothing once the callback runs out of uses or expires; build a new Dialog on every redraw and never cache |
| Input values | text / single option via `getText` (single option returns the option id), toggle via `getBoolean`, number via `getFloat`; missing values return null, so handle them all |
| Player-visible text | Adventure / MiniMessage; no `ChatColor` or `§` |

## Fallback

| Error | Cause | Fix |
|------|------|------|
| `IllegalStateException` in a callback (Bukkit API called off the main thread) | World/player operated on directly inside the customClick callback | Hop back with `runTask` first |
| `IllegalPluginAccessException` while the plugin is disabling | Player clicked at the moment of shutdown and the scheduler rejects tasks | Guard with `isEnabled()` first, then catch the exception around `runTask` |
| Button does nothing (second click) | The `uses(1)` callback is spent, or `lifetime` has passed | Build a new Dialog on every open; regenerate the buttons on redraw |
| Confirm button ends up on the left | `DialogType.confirmation` was used | Switch to a two-column `multiAction([cancel, confirm])` |
| Page with `afterAction = NONE` does not close | NONE never closes automatically and the button has no `closeDialog()` | Call `player.closeDialog()` explicitly on the cancel and success paths |
| Screen flickers after a button press | `showDialog` right after `CLOSE` | Use `NONE` (redraw in place) or `WAIT_FOR_RESPONSE` (async) for that page |
| `getText` / `getFloat` returns null | Misspelled key, or the field is not on this page | Use constants for keys shared by creation and reading; handle null when reading |
| Plugin does not load at all (bootstrap stage) | Bootstrap threw, or the bootstrap() body touched Dialog classes | Wrap everything inside handlers with `catch (RuntimeException)`, collect errors, and print them in `onEnable` |
| No new entry in the pause menu | Not added to the tag, or `api-version` is below 1.21.7 | Confirm the `postFlatten(RegistryKey.DIALOG)` handler ran; check `bootstrapper` in `paper-plugin.yml` |
