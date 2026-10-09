---
id: paper-dialog-ui
title: Paper Dialog UI
titleZh: Paper 對話框介面
description: Paper Dialog API UI patterns - a thin Dialogs helper, notice/confirm/multi-action/input dialogs, main-thread hop in customClick callbacks, confirm button on the right, and pause-screen registration from a bootstrapper.
descriptionZh: Paper Dialog API 介面模式：薄 Dialogs 包裝、通知／確認／多按鈕／輸入表單、customClick 回呼切回主執行緒、確認鍵在右，以及由 bootstrapper 註冊暫停選單頁面。
version: "1.0.0"
status: active
category: paper-ui
categoryLabel: Paper 介面
categoryLabelEn: Paper UI
tags: [paper-api, dialog, ui, bootstrap, pause-screen]
triggerKeywords:
  - "Dialog"
  - "對話框"
  - "Paper Dialog API"
  - "showDialog"
  - "確認視窗"
  - "輸入表單"
  - "暫停選單"
  - "pause_screen_additions"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-dialog-ui/SKILL.md
featured: false
---

# Paper Dialog UI

## 目的

用 Paper Dialog API（1.21.7+）做通知、確認、多按鈕與輸入表單，並可由 bootstrapper 把頁面掛到 ESC 暫停選單。薄 `Dialogs` 包裝統一處理回呼切回主執行緒、玩家在線與插件啟用檢查。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證，範本兩版相同）
- 純 Paper API，不需要 Paperweight
- `api-version` 至少 `1.21.7`

---

## 產生的代碼

### Dialogs.java（回呼切主執行緒）

```java
builder.action(DialogAction.customClick(
    (response, audience) -> onMain(playerId, player -> click.accept(player, response)), OPTIONS));

private void onMain(UUID playerId, Consumer<Player> action) {
    if (!plugin.isEnabled()) return;
    try {
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            Player player = plugin.getServer().getPlayer(playerId);
            if (player != null && player.isOnline()) action.accept(player);
        });
    } catch (IllegalPluginAccessException | IllegalStateException e) {
        // 關服瞬間的點擊，捨棄
    }
}
```

### ConfirmDialog.java（確認鍵在右）

```java
Dialogs.Button cancel = dialogs.close(Component.text("Cancel"));
Dialogs.Button confirm = dialogs.button(MINI.deserialize("<green>Confirm"), onConfirm);
Dialogs.Page page = Dialogs.Page.of(title, List.of(cancel, confirm)).withColumns(2);
```

### PreferencesDialog.java（輸入欄位）

```java
DialogInput.text("nickname", Component.text("Nickname")).maxLength(16).build();
DialogInput.bool("notify", Component.text("Notifications")).initial(true).build();
DialogInput.numberRange("radius", Component.text("Radius"), 1f, 10f).step(1f).build();
// 讀取：getText / getBoolean / getFloat（單選用 getText 取得選項 id）
```

### PauseMenuBootstrap.java（暫停選單）

```java
RegistryEvents.DIALOG.compose().newHandler(event ->
    event.registry().register(DialogKeys.create(MENU_KEY), b -> b.base(base).type(type)));
LifecycleEvents.TAGS.postFlatten(RegistryKey.DIALOG), event ->
    event.registrar().addToTag(DialogTagKeys.PAUSE_SCREEN_ADDITIONS, Set.of(DialogKeys.create(MENU_KEY)));
```

---

## 規則

- 回呼只攜帶 UUID；切主執行緒後重新 `getPlayer` 並確認在線、`plugin.isEnabled()`，`runTask` 接 `IllegalPluginAccessException` / `IllegalStateException`
- 確認鍵在右：`multiAction([取消, 確認])`，不用 `DialogType.confirmation`；不設 `exitAction` 讓 Esc 純關閉
- `afterAction`：`CLOSE` 一次性動作、`NONE` 原地重繪（按鍵須自行 `closeDialog()`）、`WAIT_FOR_RESPONSE` 非同步等待
- `customClick` 的 `uses` / `lifetime` 會失效，每次開頁重建 Dialog
- bootstrap 不拋例外、不在 `bootstrap()` 本體碰 Dialog API，錯誤收集後在 `onEnable` 印出

---

## 執行緒安全

- Dialog 回呼不保證在主執行緒，必須先切回主執行緒再碰 Bukkit API
- 資料庫／HTTP 走非同步，完成後回主執行緒重新驗證再顯示結果
