---
name: paper-dialog-ui
description: "Paper Dialog API 介面模式：薄 Dialogs 包裝、通知／確認／多按鈕／輸入表單、customClick 回呼切回主執行緒、確認鍵在右、暫停選單（pause_screen_additions）註冊 / Paper Dialog API UI patterns: thin helper, notice/confirm/multi-action/input dialogs, main-thread hop in callbacks, confirm-on-right, pause-screen registration from a bootstrapper"
---

# Paper Dialog UI / Paper 對話框介面

## 技能名稱 / Skill Name

`paper-dialog-ui`

## 目的 / Purpose

用 Paper 的 Dialog API（Paper 1.21.7+）做玩家介面：通知、確認、多按鈕選單、含輸入欄位的表單，以及把自訂頁面掛到 ESC 暫停選單。
這個 API 很容易踩的地方集中在四件事，本技能把它們收進一個薄的 `Dialogs` 包裝：

1. **按鍵回呼不保證在主執行緒**：`DialogAction.customClick` 的回呼要先切回主執行緒，並重新確認玩家在線、插件仍啟用。
2. **確認鍵一律在右側**：不依賴 `DialogType.confirmation` 的排序，改用兩欄 `multiAction([取消, 確認])`。
3. **`afterAction` 決定畫面是否閃動**：關閉、原地重繪、等待伺服器回應是三種不同選擇。
4. **`ClickCallback.Options` 的 `uses` / `lifetime`**：回呼是有次數與時效的，所以每次開頁都要建立新的 `Dialog`。

第二個範本示範在 `PluginBootstrap`（`paper-plugin.yml`）裡用 registry／lifecycle 事件註冊靜態 Dialog，並加入 `pause_screen_additions` tag，且絕不從 bootstrap 拋例外。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（Dialog API 自 Paper 1.21.7 起提供；兩版皆經編譯驗證，範本程式碼兩版相同）
- 純 Paper API，不需要 Paperweight
- 使用 Dialog 的插件 `api-version` 至少要 `1.21.7`

## 觸發條件 / Triggers

- 「Dialog」「對話框」「Paper Dialog API」「showDialog」「DialogAction」
- 「確認視窗」「輸入表單」「文字輸入框」「按鈕選單」「confirm dialog」
- 「ESC 選單」「暫停選單」「pause_screen_additions」「PluginBootstrap」
- 「customClick」「ClickCallback」「DialogResponseView」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package` | `com.example.menu.gui` | Dialog 類別所在 package |
| `dialog_kind` | `notice` / `confirm` / `multi` / `input` / `pause-screen` | 要做哪一種頁面 |
| `inputs` | `text`, `boolean`, `number`, `option` | 表單欄位（僅 `input`） |
| `after_action` | `CLOSE` / `NONE` / `WAIT_FOR_RESPONSE` | 按鍵後畫面行為 |
| `pause_screen` | `true` | 是否由 bootstrapper 註冊並掛到暫停選單 |

## 輸出產物 / Outputs

- `Dialogs.java` — 薄包裝：`Button`、`Page`、回呼切主執行緒、輸入值讀取
- `ConfirmDialog.java` — 確認頁（取消在左、確認在右）與通知頁
- `PreferencesDialog.java` — 含文字／開關／數值滑桿／單選的輸入表單
- `PauseMenuBootstrap.java` — 在 bootstrap 階段註冊 Dialog 並掛到 `pause_screen_additions`
- `PauseMenuPlugin.java` — `createPlugin` 回傳的插件主類
- `paper-plugin.yml` — 宣告 `bootstrapper`

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。只需要 `paper-api`（`compileOnly`）。

`plugin.yml` 或 `paper-plugin.yml` 的 `api-version` 至少 `'1.21.7'`；只有用到 bootstrapper 的插件需要 `paper-plugin.yml`：

```yaml
name: PauseMenu
version: '${version}'
main: com.example.menu.PauseMenuPlugin
bootstrapper: com.example.menu.PauseMenuBootstrap
api-version: '26.2'   # 1.21.11 伺服器：'1.21.11'
```

## 代碼範本 / Code Template

### `Dialogs.java`（薄包裝）

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
 * Paper Dialog 的薄包裝。
 *
 * <p>規則：
 * <ul>
 *   <li>按鍵回呼一律先切回主執行緒，再重新取得玩家並確認在線（回呼只攜帶 UUID，不攜帶 Player）</li>
 *   <li>{@code customClick} 的回呼有 {@code uses} 與 {@code lifetime} 限制，所以<b>每次開頁都建立新的 Dialog</b>，不快取</li>
 *   <li>沒有回呼的按鍵只會關閉畫面（{@code afterAction = CLOSE} 時）</li>
 * </ul>
 */
public final class Dialogs {

    public static final int BUTTON_WIDTH = 150;

    /** 每個按鍵只能點一次、十分鐘後失效；重繪頁面時會建立新的 callback。 */
    private static final ClickCallback.Options OPTIONS = ClickCallback.Options.builder()
        .uses(1)
        .lifetime(Duration.ofMinutes(10))
        .build();

    /** 一顆按鍵；{@code onClick} 為 null 代表「只關閉／什麼都不做」。 */
    public record Button(Component label, int width, @Nullable BiConsumer<Player, DialogResponseView> onClick) {
    }

    /** 一個頁面的不可變描述；用 withXxx 衍生新頁面。 */
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

        /** 設定 exit 按鍵後，玩家按 Esc 會觸發它；一般確認頁不要設，讓 Esc 是純關閉。 */
        public Page withExit(@Nullable Button value) {
            return new Page(title, body, inputs, buttons, columns, afterAction, value);
        }
    }

    private final Plugin plugin;

    public Dialogs(Plugin plugin) {
        this.plugin = plugin;
    }

    // ---- 按鍵工廠 ----

    /** 一般按鍵：回呼在主執行緒、玩家仍在線時才執行。 */
    public Button button(Component label, Consumer<Player> onClick) {
        return new Button(label, BUTTON_WIDTH, (player, view) -> onClick.accept(player));
    }

    /** 送出按鍵：回呼可讀取輸入欄位的值。 */
    public Button submit(Component label, BiConsumer<Player, DialogResponseView> onClick) {
        return new Button(label, BUTTON_WIDTH, onClick);
    }

    /** 只關閉的按鍵（無回呼）。 */
    public Button close(Component label) {
        return new Button(label, BUTTON_WIDTH, null);
    }

    // ---- 顯示 ----

    /** 多按鍵頁面（含確認頁、輸入表單）。 */
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

    /** 通知頁：只有一顆「確定」鍵。 */
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

    // ---- 讀取輸入值（欄位 key 與建立 DialogInput 時相同）----

    public static String readText(DialogResponseView view, String key) {
        String value = view.getText(key);
        return value == null ? "" : value.trim();
    }

    public static boolean readBoolean(DialogResponseView view, String key) {
        return Boolean.TRUE.equals(view.getBoolean(key));
    }

    /** 數值滑桿回傳 Float；整數用 round。 */
    public static int readInt(DialogResponseView view, String key, int fallback) {
        Float value = view.getFloat(key);
        return value == null ? fallback : Math.round(value);
    }

    /** 單選欄位回傳選項的 id（OptionEntry 的第一個參數），與文字欄位同樣用 getText 讀取。 */
    public static String readOption(DialogResponseView view, String key, String fallback) {
        String value = view.getText(key);
        return value == null || value.isEmpty() ? fallback : value;
    }

    // ---- 內部 ----

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
     * 回呼可能在非主執行緒進來。isEnabled() 與 runTask 之間仍有窄窗口（主執行緒剛好跑完 onDisable），
     * 此時排程器會拒絕任務；這不是錯誤，捨棄這次點擊即可。
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

### `ConfirmDialog.java`（確認頁：取消在左、確認在右）

```java
package com.example.menu.gui;

import io.papermc.paper.registry.data.dialog.body.DialogBody;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.entity.Player;

import java.util.List;
import java.util.function.Consumer;

/**
 * 確認頁。確認鍵固定在右側：兩欄 multiAction([取消, 確認])，不使用 DialogType.confirmation
 * （它把 yes 固定在左，且按鍵在 footer）。不設 exit 按鍵，Esc 是純關閉、不會按到任何一顆鍵。
 */
public final class ConfirmDialog {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final Dialogs dialogs;

    public ConfirmDialog(Dialogs dialogs) {
        this.dialogs = dialogs;
    }

    /**
     * @param message   MiniMessage 字串，例如 {@code "Delete home <yellow>base</yellow>?"}
     * @param onConfirm 在主執行緒、玩家仍在線時呼叫；按「取消」或 Esc 不會呼叫任何東西
     */
    public void open(Player player, String title, String message, Consumer<Player> onConfirm) {
        Dialogs.Button cancel = dialogs.close(Component.text("Cancel"));
        Dialogs.Button confirm = dialogs.button(MINI.deserialize("<green>Confirm"), onConfirm);
        Dialogs.Page page = Dialogs.Page.of(MINI.deserialize(title), List.of(cancel, confirm))
            .withBody(List.of(DialogBody.plainMessage(MINI.deserialize(message))))
            .withColumns(2);
        dialogs.show(player, page);
    }

    /** 單純通知：一顆「OK」鍵。 */
    public void notice(Player player, String title, String message) {
        dialogs.showNotice(player, MINI.deserialize(title),
            List.of(DialogBody.plainMessage(MINI.deserialize(message))),
            dialogs.close(Component.text("OK")));
    }
}
```

### `PreferencesDialog.java`（輸入表單：文字、開關、數值、單選）

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
 * 含四種輸入欄位的表單。
 *
 * <p>afterAction 用 NONE：驗證失敗時用同樣的值「原地」重開表單，畫面不會先關再開而閃動。
 * 因為 NONE 不會自動關閉，所以「取消」與成功送出都要明確呼叫 {@code closeDialog()}。
 */
public final class PreferencesDialog {

    /** 不可變的表單結果。 */
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
                open(p, parsed, onSave);   // 原地重繪，保留玩家已填的值
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

### `PauseMenuBootstrap.java`（暫停選單：bootstrap 階段註冊）

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
 * 在 bootstrap 階段把一個靜態 Dialog 註冊進 dialog registry，並加入 pause_screen_additions tag，
 * 玩家按 ESC 的暫停選單就會多出這個頁面的入口。
 *
 * <p>規則：
 * <ul>
 *   <li><b>絕不拋例外</b>：bootstrap 拋例外會讓 Paper 整個不載入插件；錯誤收進 {@code problems}，等插件啟動後再印</li>
 *   <li>bootstrap() 本體不碰 Dialog API，全部放在事件 handler 裡</li>
 *   <li>此階段沒有 Plugin 實例，所以靜態 Dialog 的按鍵只能用 {@code staticAction}（執行指令）或
 *       {@code customClick(Key, payload)}（由插件啟動後的 PlayerCustomClickEvent 處理），不能用帶 lambda 的 customClick</li>
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

### `PauseMenuPlugin.java`（`createPlugin` 回傳的主類）

```java
package com.example.menu;

import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;

public final class PauseMenuPlugin extends JavaPlugin {

    private final List<String> bootstrapProblems;

    /** 由 PauseMenuBootstrap#createPlugin 傳入 bootstrap 階段收集到的錯誤。 */
    PauseMenuPlugin(List<String> bootstrapProblems) {
        this.bootstrapProblems = List.copyOf(bootstrapProblems);
    }

    @Override
    public void onEnable() {
        // bootstrap 不能拋例外，所以錯誤延到這裡才印（此時 logger 可用）
        for (String problem : bootstrapProblems) {
            getLogger().warning("Pause menu not fully registered: " + problem);
        }
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/menu/
├── PauseMenuBootstrap.java        ← 只在需要 pause_screen_additions 時才有
├── PauseMenuPlugin.java
└── gui/
    ├── Dialogs.java               ← 薄包裝，所有 Dialog 共用
    ├── ConfirmDialog.java
    └── PreferencesDialog.java
src/main/resources/
└── paper-plugin.yml               ← bootstrapper 欄位
```

## 執行緒安全注意事項 / Thread Safety

- `DialogAction.customClick` 的回呼**不保證在主執行緒**：先檢查 `plugin.isEnabled()`，用 `runTask` 切回主執行緒，在裡面重新 `getPlayer(uuid)` 並確認 `isOnline()`
- `isEnabled()` 與 `runTask` 之間仍有窄窗口，所以 `runTask` 要接 `IllegalPluginAccessException` / `IllegalStateException`，記 `FINE` 後捨棄
- 回呼 lambda 只攜帶 `UUID`、字串、數字與不可變值，不攜帶 `Player`
- 需要資料庫或 HTTP 時：點擊 → 切主執行緒讀輸入值 → 非同步工作 → 再切回主執行緒重新驗證後 `showDialog`；等待期間用 `afterAction = WAIT_FOR_RESPONSE`
- bootstrap 階段沒有 Bukkit 伺服器可用，只做 registry／tag 註冊
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

### 設計重點

| 主題 | 做法 |
|------|------|
| 確認鍵位置 | `multiAction([取消, 確認]).columns(2)`，確認在右；不用 `DialogType.confirmation`（yes 固定在左） |
| Esc 行為 | 不設 `exitAction` → Esc 純關閉、不觸發任何按鍵；設了 `exitAction` → Esc 等同按該鍵 |
| `afterAction = CLOSE` | 按鍵後關閉；一次性動作（確認、通知）用 |
| `afterAction = NONE` | 按鍵後留在原畫面；原地重繪（切換開關、驗證失敗重開）不會閃。**所有按鍵都要自己決定是否 `closeDialog()`** |
| `afterAction = WAIT_FOR_RESPONSE` | 顯示等待畫面，直到伺服器送出新畫面或關閉；非同步工作用 |
| `uses` / `lifetime` | 回呼用完次數或過期後點擊無效；重繪就建新 Dialog、不快取 |
| 輸入值 | 文字／單選 `getText`（單選回傳選項 id）、開關 `getBoolean`、數值 `getFloat`；缺值回 null，全部要處理 |
| 玩家可見文字 | Adventure／MiniMessage，不用 `ChatColor` 與 `§` |

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 回呼裡 `IllegalStateException`（非主執行緒呼叫 Bukkit API） | 直接在 customClick 回呼裡操作世界／玩家 | 先 `runTask` 切回主執行緒 |
| 插件停用時 `IllegalPluginAccessException` | 玩家在關服瞬間點擊，排程器不收任務 | `isEnabled()` 先擋，`runTask` 再接例外 |
| 點了按鍵沒反應（第二次） | `uses(1)` 的回呼已用完，或超過 `lifetime` | 每次開頁都建新 Dialog；重繪時重新產生按鍵 |
| 確認鍵跑到左邊 | 使用了 `DialogType.confirmation` | 改用兩欄 `multiAction([取消, 確認])` |
| `afterAction = NONE` 的頁面按了沒關 | NONE 不自動關閉，且按鍵沒有 `closeDialog()` | 取消與成功路徑明確呼叫 `player.closeDialog()` |
| 按鍵後畫面閃一下 | `CLOSE` 後又立刻 `showDialog` | 該頁改用 `NONE`（原地重繪）或 `WAIT_FOR_RESPONSE`（非同步） |
| `getText` / `getFloat` 回 null | key 拼錯，或該欄位未出現在這頁 | key 用常數，建立與讀取共用；讀取時處理 null |
| 插件整個沒載入（bootstrap 階段） | bootstrap 拋了例外，或 bootstrap() 本體碰了 Dialog 類別 | 全部包在 handler 內並 `catch (RuntimeException)`，錯誤收集後在 `onEnable` 印出 |
| 暫停選單沒出現新入口 | 沒加入 tag，或 `api-version` 低於 1.21.7 | 確認 `postFlatten(RegistryKey.DIALOG)` handler 有執行；檢查 `paper-plugin.yml` 的 `bootstrapper` |
