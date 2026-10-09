# examples — paper-dialog-ui

## 範例 1：刪除家的確認頁（確認後非同步刪除，再回主執行緒通知）

**Input:**
```
dialog_kind: confirm
after_action: CLOSE
情境: /home delete base → 先確認；刪除要寫資料庫，所以不能在主執行緒做
```

**Output — 確認鍵在右；點確認後離開主執行緒做 IO，完成後回主執行緒重新驗證玩家:**
```java
import com.example.menu.gui.ConfirmDialog;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.UUID;

public final class HomeDeleteFlow {

    /** 範例用的資料層介面；實務上換成 Repository。 */
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

    /** 在主執行緒呼叫（指令或 GUI 點擊）。 */
    public void ask(Player player, String homeName) {
        confirm.open(player, "<red>Delete home",
            "Delete home <yellow>" + homeName + "</yellow>? This cannot be undone.",
            clicker -> delete(clicker.getUniqueId(), homeName));
    }

    /** 確認鍵的回呼已在主執行緒；資料庫工作丟到非同步，結果再回主執行緒。 */
    private void delete(UUID playerId, String homeName) {
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            boolean deleted = homes.delete(playerId, homeName);
            Bukkit.getScheduler().runTask(plugin, () -> {
                Player player = Bukkit.getPlayer(playerId);   // 重新取得：玩家可能已離線
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

重點：
- `ConfirmDialog` 內部已經處理「回呼切主執行緒＋玩家在線」；`delete` 之後的非同步部分仍要自己回主執行緒並重新 `getPlayer`
- 取消鍵沒有回呼，Esc 也是純關閉，不會誤觸確認

---

## 範例 2：原地切換的設定頁（`afterAction = NONE`，不閃動）

**Input:**
```
dialog_kind: multi
after_action: NONE
情境: /settings 一頁多個開關；點一個切換一個，頁面原地更新，footer 只有「Close」
```

**Output — 每次點擊都重建整頁（舊的 callback 已用完 uses），用 `NONE` 讓畫面不關閉:**
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
    /** 玩家設定的記憶體快取；實務上換成 service。 */
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
                open(p);   // 原地重繪：afterAction 是 NONE，畫面不會先關再開
            }));
        }
        // NONE 不會自動關閉，所以 Close 要明確 closeDialog()
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

重點：
- `uses(1)` 的 callback 點一次就失效，所以重繪必須走 `open(p)` 重新建 Dialog，不能重複使用舊按鍵
- 需要非同步載入資料才能畫頁面時，點擊那頁改用 `DialogAfterAction.WAIT_FOR_RESPONSE`：玩家看到等待畫面，直到你 `showDialog` 新頁或 `closeDialog()`

---

## 範例 3：輸入表單開啟與結果處理（含驗證）

**Input:**
```
dialog_kind: input
inputs: text, boolean, number, option
情境: /prefs 開表單，儲存時驗證暱稱，成功才關閉
```

**Output — 開表單與儲存回呼:**
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

    /** onSave 在主執行緒、玩家在線時被呼叫；此時暱稱已確認非空。 */
    private void save(Player player, Preferences value) {
        saved.put(player.getUniqueId(), value);
        player.sendMessage(Component.text("Saved. Radius " + value.radius() + ", mode " + value.mode() + "."));
    }
}
```

---

## 範例 4：把靜態 Dialog 掛進暫停選單的 `paper-plugin.yml`

**Input:**
```
dialog_kind: pause-screen
pause_screen: true
```

**Output — `paper-plugin.yml`（`PauseMenuBootstrap` 見 SKILL.md）:**
```yaml
name: PauseMenu
version: '${version}'
main: com.example.menu.PauseMenuPlugin
bootstrapper: com.example.menu.PauseMenuBootstrap
api-version: '26.2'
```

部署檢查：
- 伺服器啟動日誌沒有 `Failed to register the pause menu dialog`；若有，`PauseMenuPlugin#onEnable` 也會再印一行 WARNING
- 進入遊戲按 ESC，暫停選單應出現新入口；沒有的話確認 `bootstrapper` 路徑與 `api-version`
- bootstrap 階段註冊的 Dialog 是靜態的：按鍵用 `staticAction(ClickEvent.runCommand(...))`；要帶玩家資料的動態頁面，改在插件啟動後用 `Dialogs` 開啟
