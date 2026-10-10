# NMS Custom Menu

## Purpose

Extend NMS `AbstractContainerMenu` to implement custom container GUIs, with slot operation interception and data sync, more flexible than the pure Bukkit API.

---

## Alternatives

Use Paper Dialog (`paper-dialog-ui`) for forms and confirmation windows; use `InventoryHolder` (`paper-chest-gui`) for ordinary chest GUIs; use this skill only when you need a custom `MenuType` or server-side container logic.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with a trailing `// @1.21.11:`)
- Paperweight userdev 2.0.0-beta.24+
- Mojang official names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### CustomMenu.java

```java
public class CustomMenu extends AbstractContainerMenu {
    // Register GUI slots (container area + player inventory)
    // stillValid() — controls whether the menu may stay open
    // quickMoveStack() — intercepts shift-click
    // getBukkitView() — provides a Bukkit InventoryView
}
```

### CustomMenuProvider.java + how to open

```java
// Open the GUI
ServerPlayer nms = ((CraftPlayer) player).getHandle();
nms.openMenu(new CustomMenuProvider("§6Shop"));
```

---

## Thread Safety

- `nms.openMenu()` and all GUI operations **must be called on the main thread**
- Bukkit event callbacks (InventoryClickEvent) are already fired on the main thread
