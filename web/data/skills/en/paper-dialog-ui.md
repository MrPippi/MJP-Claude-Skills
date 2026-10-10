
# Paper Dialog UI

## Purpose

Use the Paper Dialog API (1.21.7+) for notices, confirmations, multi-button and input forms, and let the bootstrapper attach pages to the ESC pause menu. A thin `Dialogs` wrapper handles switching callbacks back to the main thread, player-online checks and plugin-enabled checks in one place.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (compile-verified on both, templates identical on both)
- Pure Paper API, no Paperweight needed
- `api-version` at least `1.21.7`

---

## Generated Code

### Dialogs.java (switch callbacks to the main thread)

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
        // Click at the moment of server shutdown, discard
    }
}
```

### ConfirmDialog.java (confirm button on the right)

```java
Dialogs.Button cancel = dialogs.close(Component.text("Cancel"));
Dialogs.Button confirm = dialogs.button(MINI.deserialize("<green>Confirm"), onConfirm);
Dialogs.Page page = Dialogs.Page.of(title, List.of(cancel, confirm)).withColumns(2);
```

### PreferencesDialog.java (input fields)

```java
DialogInput.text("nickname", Component.text("Nickname")).maxLength(16).build();
DialogInput.bool("notify", Component.text("Notifications")).initial(true).build();
DialogInput.numberRange("radius", Component.text("Radius"), 1f, 10f).step(1f).build();
// Read: getText / getBoolean / getFloat (for single choice, use getText to get the option id)
```

### PauseMenuBootstrap.java (pause menu)

```java
RegistryEvents.DIALOG.compose().newHandler(event ->
    event.registry().register(DialogKeys.create(MENU_KEY), b -> b.base(base).type(type)));
LifecycleEvents.TAGS.postFlatten(RegistryKey.DIALOG), event ->
    event.registrar().addToTag(DialogTagKeys.PAUSE_SCREEN_ADDITIONS, Set.of(DialogKeys.create(MENU_KEY)));
```

---

## Rules

- Callbacks carry only the UUID; after switching to the main thread, call `getPlayer` again and confirm the player is online and `plugin.isEnabled()`; wrap `runTask` to catch `IllegalPluginAccessException` / `IllegalStateException`
- Confirm button on the right: `multiAction([cancel, confirm])`, do not use `DialogType.confirmation`; do not set `exitAction` so Esc simply closes
- `afterAction`: `CLOSE` for one-shot actions, `NONE` to redraw in place (the button must call `closeDialog()` itself), `WAIT_FOR_RESPONSE` for async waiting
- `uses` / `lifetime` of `customClick` expire, so rebuild the Dialog every time the page is opened
- bootstrap must not throw and must not touch the Dialog API in the `bootstrap()` body itself; collect errors and print them in `onEnable`

---

## Thread Safety

- Dialog callbacks are not guaranteed to run on the main thread; switch back to the main thread before touching the Bukkit API
- Database / HTTP work goes async; when done, return to the main thread, revalidate, and then show the result
