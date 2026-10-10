# NMS Scoreboard

## Purpose

Manipulate the sidebar scoreboard, tablist display names, and player prefix/suffix directly through NMS `Scoreboard`, `Objective`, and `Team`, bypassing the packet delay of the Bukkit Scoreboard API.

---

## Platform Requirements

- Paper 1.21.11 / 26.2 (both versions compile-verified; version differences are marked with trailing `// @1.21.11:` comments)
- Paperweight userdev 2.0.0-beta.24+
- Official Mojang names (no longer obfuscated since Minecraft 26.1)
- Java 21 (1.21.11) / 25 (26.2)

---

## Generated Code

### SidebarDisplay.java

```java
new SidebarDisplay("§6§lMyServer")
    .addLine("§fPlayer: §e" + player.getName(), 14)
    .addLine("§fLevel: §a1", 13)
    .show(player);
```

### TeamManager.java (prefix/suffix)

```java
teamManager.setTeam("vip", "§6[VIP] ", "");
teamManager.addPlayer(player, "vip");
```

---

## Thread Safety

- All Scoreboard/Team operations **must be called on the main thread**
