---
name: paper-combat-tag
description: "PvP 戰鬥標記：純邏輯 CombatTagService（UUID + 時間戳、可 JUnit）、傷害歸因矩陣（近戰/射擊物/藥水/TNT/水晶/重生錨/狼）、指令白名單、傳送封鎖、戰鬥登出判死，並以 ServicesManager 公開 CombatTagApi / PvP combat tagging with a Bukkit-free core service, damage attribution matrix, command whitelist, teleport block, combat-logout punishment and a ServicesManager API"
---

# Paper Combat Tag / PvP 戰鬥標記

## 技能名稱 / Skill Name

`paper-combat-tag`

## 目的 / Purpose

玩家互毆後進入「戰鬥狀態」一段時間：狀態中禁止逃跑手段（指令、插件傳送、登出），登出視同死亡。重點在於**誰打了誰**要判斷正確 —— 傷害常常不是玩家直接造成的。

架構分兩層：

- **核心（`core` package）**：`CombatTagService`、`CommandPolicy`、`KickRule`、`TeleportRule`、`ActionLedger`。只用 `UUID`、`long` 毫秒時間戳與字串，不 import `org.bukkit`，可直接用 JUnit 測，不需要 MockBukkit。
- **轉接層（`adapter` package）**：Listener 把 Bukkit 事件翻成核心的輸入，把核心的判定翻成取消事件／訊息／處決。

其他插件透過 `ServicesManager` 取得 `CombatTagApi`（做法見 [`paper-service-api`](../paper-service-api/SKILL.md)）。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（兩版相同；使用 `DamageSource`、`PlayerKickEvent.Cause`、`PotionEffectTypeCategory`）
- 純 Paper API，不需要 Paperweight

## 觸發條件 / Triggers

- 「戰鬥標記」「combat tag」「combat log」「戰鬥中登出」「PvP 逃跑」
- 「戰鬥中禁止指令」「戰鬥中禁止傳送」「傷害來源判斷」「damage attribution」
- 「射擊物／藥水／TNT／水晶 傷害算誰的」「CombatTagApi」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.combat` | 根 package；核心在 `.core`，API 在 `.api`（**API 不可 relocate**） |
| `duration_seconds` | `20` | 標記持續秒數，每次受擊／出手重置 |
| `command_whitelist` | `msg`, `r`, `tell` | 戰鬥中仍可用的指令（填**正式指令名**，別名自動歸一） |
| `logout_mode` | `KILL` / `DROP_ITEMS` | 戰鬥登出的處罰 |
| `blocked_teleport_causes` | `COMMAND`, `PLUGIN` | 戰鬥中要取消的 `TeleportCause`（珍珠、歌萊果、傳送門預設放行） |
| `bypass_permission` | `combattag.bypass` | 持有者不被標記 |

## 輸出產物 / Outputs

- 核心：`CombatTagService`、`ActionLedger`、`CommandPolicy`、`KickRule`、`TeleportRule`
- 設定：`CombatConfig`（不可變 record）、`config.yml`
- 轉接層：`AttackerResolver`、`CombatTagger`、`DamageListener`、`PotionListener`、`BombListener`、`CommandListener`、`TeleportListener`、`KickListener`、`QuitListener`、`DeathListener`、`CombatTicker`
- 公開 API：`CombatTagApi`（`api` package）、`CombatTagApiImpl`
- `CombatTagPlugin`（組裝與註冊）、`plugin.yml`

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。測試使用 JUnit（核心不含 Bukkit，不需要 MockBukkit）：

```groovy
dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11：'1.21.11-R0.1-SNAPSHOT'
    testImplementation 'org.junit.jupiter:junit-jupiter:5.11.4'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

test {
    useJUnitPlatform()
}
```

## 傷害歸因矩陣 / Damage Attribution Matrix

| 傷害來源 | 判斷方式 | 備註 |
|----------|----------|------|
| 近戰 | `DamageSource#getCausingEntity()` 是 `Player` | 最常見 |
| 弓箭、三叉戟、雪球、釣竿 | `Projectile#getShooter()` 是 `Player` | `getCausingEntity` 通常已是射手；`getDirectEntity` 作備援 |
| 噴濺／滯留藥水 | `PotionSplashEvent`：`ThrownPotion#getShooter()` + 有害效果 + `getIntensity > 0` | 毒、凋零等無傷害數字的效果不會觸發 `EntityDamageEvent` |
| 藥水雲 | `AreaEffectCloudApplyEvent`：`AreaEffectCloud#getSource()` | 滯留藥水落地後的雲 |
| TNT | `TNTPrimed#getSource()`（點燃者） | 連鎖引爆也會保留點燃者 |
| 終界水晶 | 打水晶時記帳，爆炸時在短視窗內回查 | 水晶本身沒有「誰打的」欄位 |
| 重生錨／床 | 右鍵時記帳（`ActionLedger`），`BLOCK_EXPLOSION` 時以 `getDamageLocation()` 回查 | 爆炸與點擊在同一 tick，視窗 1–2 tick |
| 馴服的狼等 | `Tameable#getOwnerUniqueId()`（主人在線才算） | |
| 火、摔落、虛空（受擊之後） | **不重置標記**，也不建立新標記 | 避免燒傷無限延長；死亡歸因用 `lastAttacker` |
| 自傷、被取消的事件 | 忽略 | `EventPriority.MONITOR` + `ignoreCancelled = true` |

## 代碼範本 / Code Template

### `CombatTagService.java`（核心，無 Bukkit）

```java
package com.example.combat.core;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * 戰鬥標記狀態。只用 UUID 與毫秒時間戳；時間由呼叫端傳入，所以測試不必等真實時間。
 * 非執行緒安全：只在主執行緒使用。
 */
public final class CombatTagService {

    /** 登出時的處罰判定。 */
    public enum LogoutVerdict { NONE, PUNISH }

    private record Tag(long expiresAtMillis, UUID lastAttacker) {
    }

    private final long durationMillis;
    private final Map<UUID, Tag> tags = new HashMap<>();
    private final Set<UUID> exemptLogouts = new HashSet<>();

    public CombatTagService(long durationMillis) {
        if (durationMillis <= 0) {
            throw new IllegalArgumentException("durationMillis must be positive: " + durationMillis);
        }
        this.durationMillis = durationMillis;
    }

    /**
     * 一次 PvP 互動。自傷不算；bypass 者不被標記，但仍讓對方被標記。
     *
     * @return 這次「剛進入戰鬥」的玩家（原本沒標記）；用來只送一次進入訊息
     */
    public Set<UUID> hit(UUID victim, UUID attacker, long now, boolean victimBypass, boolean attackerBypass) {
        Objects.requireNonNull(victim, "victim");
        Objects.requireNonNull(attacker, "attacker");
        if (victim.equals(attacker)) {
            return Set.of();
        }
        long expiresAt = now + durationMillis;
        Set<UUID> entered = new HashSet<>();
        if (!victimBypass) {
            if (!isTagged(victim, now)) {
                entered.add(victim);
            }
            tags.put(victim, new Tag(expiresAt, attacker));
        }
        if (!attackerBypass) {
            if (!isTagged(attacker, now)) {
                entered.add(attacker);
            }
            tags.put(attacker, new Tag(expiresAt, victim));
        }
        return Set.copyOf(entered);
    }

    public boolean isTagged(UUID player, long now) {
        Tag tag = tags.get(player);
        return tag != null && tag.expiresAtMillis() > now;
    }

    /** 剩餘秒數，向上取整；未標記或已到期回 0。 */
    public long remainingSeconds(UUID player, long now) {
        Tag tag = tags.get(player);
        if (tag == null || tag.expiresAtMillis() <= now) {
            return 0;
        }
        return (tag.expiresAtMillis() - now + 999) / 1000;
    }

    /** 最後的對手；標記已到期則回 empty。 */
    public Optional<UUID> lastAttacker(UUID player, long now) {
        Tag tag = tags.get(player);
        if (tag == null || tag.expiresAtMillis() <= now) {
            return Optional.empty();
        }
        return Optional.of(tag.lastAttacker());
    }

    /** 解除標記（死亡、API）。沒標記就回 false。 */
    public boolean untag(UUID player) {
        return tags.remove(player) != null;
    }

    /** 移除並回傳已到期的玩家；ticker 每秒呼叫一次，用來送「脫離戰鬥」。 */
    public Set<UUID> expire(long now) {
        Set<UUID> expired = new HashSet<>();
        tags.entrySet().removeIf(entry -> {
            boolean done = entry.getValue().expiresAtMillis() <= now;
            if (done) {
                expired.add(entry.getKey());
            }
            return done;
        });
        return Set.copyOf(expired);
    }

    /** 目前所有有紀錄的玩家（快照）。 */
    public Set<UUID> tagged() {
        return Set.copyOf(tags.keySet());
    }

    /** 記錄此次被踢是否屬於管理員動作（見 {@link KickRule}）；{@code PlayerKickEvent} 在 quit 之前觸發。 */
    public void markKicked(UUID player, boolean exemptFromPunishment) {
        if (exemptFromPunishment) {
            exemptLogouts.add(player);
        } else {
            exemptLogouts.remove(player);
        }
    }

    /** 登出時呼叫：回傳處罰判定，並清掉該玩家的所有狀態。 */
    public LogoutVerdict onQuit(UUID player, long now) {
        boolean exempt = exemptLogouts.remove(player);
        boolean wasTagged = isTagged(player, now);
        tags.remove(player);
        return wasTagged && !exempt ? LogoutVerdict.PUNISH : LogoutVerdict.NONE;
    }

    /** 停用或重載時清空。 */
    public void clear() {
        tags.clear();
        exemptLogouts.clear();
    }
}
```

### `ActionLedger.java`（核心：短視窗歸因表）

```java
package com.example.combat.core;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 「誰在哪個 tick 對哪個東西做了動作」。重生錨／床的點擊、終界水晶被打，與隨後的爆炸傷害在同一 tick（或相鄰 tick），
 * 爆炸傷害本身沒有可靠的 causing entity，所以靠這張表在短視窗內回查。
 * 不可變：每次 record 回傳新副本，並順手丟掉過期項目，表永遠只有幾筆。
 */
public record ActionLedger(Map<String, Entry> entries) {

    public record Entry(UUID player, int tick) {
    }

    public ActionLedger {
        entries = Map.copyOf(entries);
    }

    public static ActionLedger empty() {
        return new ActionLedger(Map.of());
    }

    public ActionLedger record(String key, UUID player, int tick, int windowTicks) {
        Map<String, Entry> next = new HashMap<>();
        for (Map.Entry<String, Entry> e : entries.entrySet()) {
            if (tick - e.getValue().tick() <= windowTicks) {
                next.put(e.getKey(), e.getValue());
            }
        }
        next.put(key, new Entry(player, tick));
        return new ActionLedger(next);
    }

    public Optional<UUID> lookup(String key, int tick, int windowTicks) {
        Entry entry = entries.get(key);
        if (entry == null || tick - entry.tick() > windowTicks) {
            return Optional.empty();
        }
        return Optional.of(entry.player());
    }

    public static String blockKey(String world, int x, int y, int z) {
        return "block:" + world + ":" + x + ":" + y + ":" + z;
    }

    public static String entityKey(UUID entity) {
        return "entity:" + entity;
    }
}
```

### `CommandPolicy.java`（核心：指令白名單）

```java
package com.example.combat.core;

import java.util.Locale;
import java.util.Set;

/**
 * 戰鬥中的指令白名單。
 *
 * <p>流程：Listener 先用 {@link #rawToken} 取出玩家輸入的指令字，交給 {@code CommandMap} 解析成正式指令名
 * （別名 {@code /t} 與命名空間 {@code /minecraft:tell} 都會落到 {@code tell}），再用 {@link #allowed} 比對。
 * 解析不到（未知指令）時退回 {@link #stripNamespace}。白名單在載入設定時用 {@link #normalize} 正規化。
 */
public final class CommandPolicy {

    private CommandPolicy() {
    }

    /** 去前導空白與 {@code /}，取第一個空白前，轉小寫；保留命名空間。 */
    public static String rawToken(String commandLine) {
        String s = commandLine.strip();
        if (s.startsWith("/")) {
            s = s.substring(1);
        }
        int end = 0;
        while (end < s.length() && !Character.isWhitespace(s.charAt(end))) {
            end++;
        }
        return s.substring(0, end).toLowerCase(Locale.ROOT);
    }

    /** {@code minecraft:tp} → {@code tp}。 */
    public static String stripNamespace(String token) {
        int colon = token.lastIndexOf(':');
        return colon < 0 ? token : token.substring(colon + 1);
    }

    /** 設定檔寫法（{@code /Msg}、{@code  msg }）→ {@code msg}。 */
    public static String normalize(String configured) {
        return stripNamespace(rawToken(configured));
    }

    public static boolean allowed(String commandName, Set<String> whitelist) {
        return !commandName.isEmpty() && whitelist.contains(commandName);
    }
}
```

### `KickRule.java`（核心：被踢免死原因）

```java
package com.example.combat.core;

import java.util.Set;

/**
 * 哪些踢出原因算「管理員／伺服器動作」：標記中被這些原因踢出不判死。
 * 其餘（第二客戶端登入、封包違規、逾時、閒置、其他插件踢出）都是玩家自己能觸發的逃跑手段，照判死。
 *
 * <p>參數是 {@code PlayerKickEvent.Cause#name()}，核心不 import Bukkit。
 * 不要看 {@code PlayerQuitEvent#getReason()}：它對上述逃跑手段也回 {@code KICKED}。
 */
public final class KickRule {

    public static final Set<String> EXEMPT_CAUSES = Set.of(
        "KICK_COMMAND", "BANNED", "IP_BANNED", "WHITELIST", "RESTART_COMMAND");

    private KickRule() {
    }

    public static boolean exemptsPunishment(String causeName) {
        return EXEMPT_CAUSES.contains(causeName);
    }
}
```

### `TeleportRule.java`（核心：傳送原因）

```java
package com.example.combat.core;

import java.util.Set;

/**
 * 戰鬥中哪些傳送要取消。預設只擋 {@code COMMAND} 與 {@code PLUGIN}（那是逃跑）；
 * 終界珍珠、歌萊果、傳送門是原版戰鬥手段，放行。吃 {@code cause.name()} 字串，測試不必 import Bukkit。
 */
public final class TeleportRule {

    public static final Set<String> DEFAULT_BLOCKED = Set.of("COMMAND", "PLUGIN");

    private TeleportRule() {
    }

    public static boolean blocks(String causeName, Set<String> blocked) {
        return causeName != null && blocked.contains(causeName);
    }
}
```

### `CombatConfig.java`（不可變設定）

```java
package com.example.combat.adapter;

import com.example.combat.core.CommandPolicy;
import com.example.combat.core.TeleportRule;
import org.bukkit.configuration.ConfigurationSection;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** 啟動時解析一次的不可變設定；Listener 不直接讀 getConfig()。 */
public record CombatConfig(
    long durationMillis,
    Set<String> commandWhitelist,
    LogoutMode logoutMode,
    Set<String> blockedTeleportCauses,
    int attributionWindowTicks
) {

    public enum LogoutMode { KILL, DROP_ITEMS }

    public static final String BYPASS_PERMISSION = "combattag.bypass";

    public CombatConfig {
        commandWhitelist = Set.copyOf(commandWhitelist);
        blockedTeleportCauses = Set.copyOf(blockedTeleportCauses);
    }

    /** 設定錯誤直接丟 {@link IllegalArgumentException}（啟動時 fail fast，由 onEnable 停用插件）。 */
    public static CombatConfig from(ConfigurationSection section) {
        int seconds = section.getInt("duration-seconds", 20);
        if (seconds < 1) {
            throw new IllegalArgumentException("duration-seconds must be >= 1: " + seconds);
        }
        Set<String> whitelist = new HashSet<>();
        for (String raw : section.getStringList("command-whitelist")) {
            String name = CommandPolicy.normalize(raw);
            if (!name.isEmpty()) {
                whitelist.add(name);
            }
        }
        LogoutMode mode;
        try {
            mode = LogoutMode.valueOf(section.getString("logout-mode", "KILL").toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("logout-mode must be KILL or DROP_ITEMS", e);
        }
        List<String> causes = section.getStringList("blocked-teleport-causes");
        Set<String> blocked = causes.isEmpty() ? TeleportRule.DEFAULT_BLOCKED : new HashSet<>(causes);
        int window = Math.max(1, section.getInt("attribution-window-ticks", 2));
        return new CombatConfig(seconds * 1000L, whitelist, mode, blocked, window);
    }
}
```

### `CombatMessages.java`（MiniMessage 訊息）

```java
package com.example.combat.adapter;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;

/** 玩家可見文字集中在這裡（英文、MiniMessage）；數值一律走 unparsed placeholder，避免注入標籤。 */
final class CombatMessages {

    private static final MiniMessage MM = MiniMessage.miniMessage();

    private CombatMessages() {
    }

    static Component entered(long seconds) {
        return MM.deserialize("<red>You are in combat. Do not log out for <white><seconds></white> seconds.",
            Placeholder.unparsed("seconds", Long.toString(seconds)));
    }

    static Component countdown(long seconds) {
        return MM.deserialize("<red>In combat <white><seconds>s</white>",
            Placeholder.unparsed("seconds", Long.toString(seconds)));
    }

    static Component left() {
        return MM.deserialize("<green>You are no longer in combat.");
    }

    static Component commandBlocked() {
        return MM.deserialize("<red>You cannot use that command while in combat.");
    }

    static Component teleportBlocked() {
        return MM.deserialize("<red>You cannot teleport while in combat.");
    }
}
```

### `AttackerResolver.java`（轉接層：歸因）

```java
package com.example.combat.adapter;

import com.example.combat.core.ActionLedger;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.damage.DamageSource;
import org.bukkit.entity.AreaEffectCloud;
import org.bukkit.entity.EnderCrystal;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.entity.Projectile;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.entity.Tameable;
import org.bukkit.event.entity.EntityDamageEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.projectiles.ProjectileSource;

import java.util.Optional;
import java.util.UUID;

/**
 * 一次傷害是哪位玩家造成的。只在主執行緒使用；{@code ledger} 每次替換整個不可變副本，沒有共享可變狀態。
 */
public final class AttackerResolver {

    private final Plugin plugin;
    private final int windowTicks;
    private ActionLedger ledger = ActionLedger.empty();

    public AttackerResolver(Plugin plugin, int windowTicks) {
        this.plugin = plugin;
        this.windowTicks = windowTicks;
    }

    /** 重生錨／床被右鍵時呼叫。 */
    public void recordBlock(Block block, UUID player) {
        String key = ActionLedger.blockKey(block.getWorld().getName(), block.getX(), block.getY(), block.getZ());
        ledger = ledger.record(key, player, plugin.getServer().getCurrentTick(), windowTicks);
    }

    /** 終界水晶被玩家打到時呼叫。 */
    public void recordCrystal(EnderCrystal crystal, UUID player) {
        ledger = ledger.record(ActionLedger.entityKey(crystal.getUniqueId()), player,
            plugin.getServer().getCurrentTick(), windowTicks);
    }

    public Optional<UUID> resolve(EntityDamageEvent event) {
        DamageSource source = event.getDamageSource();
        Optional<UUID> found = fromEntity(source.getCausingEntity());
        if (found.isPresent()) {
            return found;
        }
        Entity directEntity = source.getDirectEntity();
        found = fromEntity(directEntity);
        if (found.isPresent()) {
            return found;
        }
        int tick = plugin.getServer().getCurrentTick();
        if (directEntity instanceof EnderCrystal crystal) {
            return ledger.lookup(ActionLedger.entityKey(crystal.getUniqueId()), tick, windowTicks);
        }
        if (directEntity == null && event.getCause() == EntityDamageEvent.DamageCause.BLOCK_EXPLOSION) {
            Location at = source.getDamageLocation();
            World world = at == null ? null : at.getWorld();
            if (at == null || world == null) {
                return Optional.empty();
            }
            String key = ActionLedger.blockKey(world.getName(), at.getBlockX(), at.getBlockY(), at.getBlockZ());
            return ledger.lookup(key, tick, windowTicks);
        }
        return Optional.empty();
    }

    /** 玩家本人、射擊物射手、TNT 點燃者、藥水雲來源、馴服動物的在線主人。 */
    public Optional<UUID> fromEntity(Entity entity) {
        if (entity == null) {
            return Optional.empty();
        }
        if (entity instanceof Player player) {
            return Optional.of(player.getUniqueId());
        }
        if (entity instanceof Projectile projectile) {
            return fromShooter(projectile.getShooter());
        }
        if (entity instanceof TNTPrimed tnt) {
            return fromEntity(tnt.getSource());
        }
        if (entity instanceof AreaEffectCloud cloud) {
            return fromShooter(cloud.getSource());
        }
        if (entity instanceof Tameable pet) {
            UUID owner = pet.getOwnerUniqueId();
            if (owner != null && plugin.getServer().getPlayer(owner) != null) {
                return Optional.of(owner);
            }
        }
        return Optional.empty();
    }

    private Optional<UUID> fromShooter(ProjectileSource shooter) {
        return shooter instanceof Entity entity ? fromEntity(entity) : Optional.empty();
    }

    public void clear() {
        ledger = ActionLedger.empty();
    }
}
```

### `CombatTagger.java`（轉接層：套用標記）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;

/** Listener 共用的入口：處理 bypass 權限、離線對手、進入戰鬥訊息。 */
public final class CombatTagger {

    private final Plugin plugin;
    private final CombatTagService service;
    private final LongSupplier clock;

    public CombatTagger(Plugin plugin, CombatTagService service, LongSupplier clock) {
        this.plugin = plugin;
        this.service = service;
        this.clock = clock;
    }

    /** 主執行緒呼叫。attacker 不在線（例如射出箭後登出）→ 略過。 */
    public void tag(Player victim, UUID attackerId) {
        Player attacker = plugin.getServer().getPlayer(attackerId);
        if (attacker == null) {
            return;
        }
        long now = clock.getAsLong();
        Set<UUID> entered = service.hit(
            victim.getUniqueId(), attackerId, now,
            victim.hasPermission(CombatConfig.BYPASS_PERMISSION),
            attacker.hasPermission(CombatConfig.BYPASS_PERMISSION));
        for (UUID id : entered) {
            Player player = plugin.getServer().getPlayer(id);
            if (player != null) {
                player.sendMessage(CombatMessages.entered(service.remainingSeconds(id, now)));
            }
        }
    }
}
```

### `DamageListener.java`（轉接層：傷害）

```java
package com.example.combat.adapter;

import org.bukkit.entity.EnderCrystal;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.EntityDamageByEntityEvent;
import org.bukkit.event.entity.EntityDamageEvent;

import java.util.UUID;

/**
 * MONITOR + ignoreCancelled：只看「真的造成了」的傷害，不干涉其他插件的取消邏輯。
 * 環境傷害（火、摔落、虛空）沒有玩家歸因 → resolve 回 empty → 不重置標記。
 */
public final class DamageListener implements Listener {

    private final AttackerResolver resolver;
    private final CombatTagger tagger;

    public DamageListener(AttackerResolver resolver, CombatTagger tagger) {
        this.resolver = resolver;
        this.tagger = tagger;
    }

    /** 水晶被打：先記帳，爆炸傷害稍後（同 tick）才到。 */
    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCrystalHit(EntityDamageByEntityEvent event) {
        if (event.getEntity() instanceof EnderCrystal crystal) {
            resolver.fromEntity(event.getDamager()).ifPresent(id -> resolver.recordCrystal(crystal, id));
        }
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDamage(EntityDamageEvent event) {
        if (!(event.getEntity() instanceof Player victim) || event.getFinalDamage() <= 0) {
            return;
        }
        UUID attacker = resolver.resolve(event).orElse(null);
        if (attacker != null) {
            tagger.tag(victim, attacker);
        }
    }
}
```

### `PotionListener.java`（轉接層：藥水與藥水雲）

```java
package com.example.combat.adapter;

import org.bukkit.entity.AreaEffectCloud;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;
import org.bukkit.entity.ThrownPotion;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.AreaEffectCloudApplyEvent;
import org.bukkit.event.entity.PotionSplashEvent;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectTypeCategory;
import org.bukkit.potion.PotionType;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * 噴濺／滯留藥水與藥水雲。毒、凋零、緩速等效果不會觸發 EntityDamageEvent（或要等下一 tick），
 * 所以在「效果套用」當下就標記；只算有害效果，治療藥水潑隊友不算。
 */
public final class PotionListener implements Listener {

    private final AttackerResolver resolver;
    private final CombatTagger tagger;

    public PotionListener(AttackerResolver resolver, CombatTagger tagger) {
        this.resolver = resolver;
        this.tagger = tagger;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onSplash(PotionSplashEvent event) {
        ThrownPotion potion = event.getEntity();
        if (!hasHarmful(potion.getEffects())) {
            return;
        }
        resolver.fromEntity(potion).ifPresent(attacker -> {
            for (LivingEntity affected : event.getAffectedEntities()) {
                if (affected instanceof Player victim && event.getIntensity(affected) > 0) {
                    tagger.tag(victim, attacker);
                }
            }
        });
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onCloud(AreaEffectCloudApplyEvent event) {
        AreaEffectCloud cloud = event.getEntity();
        List<PotionEffect> effects = new ArrayList<>(cloud.getCustomEffects());
        PotionType base = cloud.getBasePotionType();
        if (base != null) {
            effects.addAll(base.getPotionEffects());
        }
        if (!hasHarmful(effects)) {
            return;
        }
        resolver.fromEntity(cloud).ifPresent(attacker -> {
            for (LivingEntity affected : event.getAffectedEntities()) {
                if (affected instanceof Player victim) {
                    tagger.tag(victim, attacker);
                }
            }
        });
    }

    private static boolean hasHarmful(Collection<PotionEffect> effects) {
        for (PotionEffect effect : effects) {
            if (effect.getType().getCategory() == PotionEffectTypeCategory.HARMFUL) {
                return true;
            }
        }
        return false;
    }
}
```

### `BombListener.java`（轉接層：重生錨／床記帳）

```java
package com.example.combat.adapter;

import org.bukkit.Material;
import org.bukkit.Tag;
import org.bukkit.block.Block;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;

/**
 * 在不能睡覺的維度右鍵床、或重生錨充能錯誤時會爆炸，而爆炸傷害沒有 causing entity。
 * 這裡只負責「記一筆」，是否真的爆炸與傷到人由 {@link AttackerResolver} 在傷害事件時回查。
 * 一般睡覺也會記帳，但視窗只有 1–2 tick，不會誤判。
 */
public final class BombListener implements Listener {

    private final AttackerResolver resolver;

    public BombListener(AttackerResolver resolver) {
        this.resolver = resolver;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onInteract(PlayerInteractEvent event) {
        if (event.getAction() != Action.RIGHT_CLICK_BLOCK) {
            return;
        }
        Block block = event.getClickedBlock();
        if (block == null) {
            return;
        }
        Material type = block.getType();
        if (type == Material.RESPAWN_ANCHOR || Tag.BEDS.isTagged(type)) {
            resolver.recordBlock(block, event.getPlayer().getUniqueId());
        }
    }
}
```

### `CommandListener.java`（轉接層：指令白名單）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import com.example.combat.core.CommandPolicy;
import org.bukkit.command.Command;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.plugin.Plugin;

import java.util.Locale;
import java.util.function.LongSupplier;

/**
 * 戰鬥中只放行白名單指令。比對前先用 CommandMap 把別名與命名空間（{@code /minecraft:tell}、{@code /t}）
 * 解析成正式指令名；解析不到（未知指令）時退回去掉命名空間的字串。
 * LOWEST：在其他插件處理前先擋，避免它們先執行了副作用。
 */
public final class CommandListener implements Listener {

    private final Plugin plugin;
    private final CombatTagService service;
    private final CombatConfig config;
    private final LongSupplier clock;

    public CommandListener(Plugin plugin, CombatTagService service, CombatConfig config, LongSupplier clock) {
        this.plugin = plugin;
        this.service = service;
        this.config = config;
        this.clock = clock;
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onCommand(PlayerCommandPreprocessEvent event) {
        Player player = event.getPlayer();
        if (!service.isTagged(player.getUniqueId(), clock.getAsLong())) {
            return;
        }
        String raw = CommandPolicy.rawToken(event.getMessage());
        Command command = plugin.getServer().getCommandMap().getCommand(raw);
        String name = command != null
            ? command.getName().toLowerCase(Locale.ROOT)
            : CommandPolicy.stripNamespace(raw);
        if (!CommandPolicy.allowed(name, config.commandWhitelist())) {
            event.setCancelled(true);
            player.sendMessage(CombatMessages.commandBlocked());
        }
    }
}
```

### `TeleportListener.java`（轉接層：傳送封鎖）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import com.example.combat.core.TeleportRule;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerTeleportEvent;

import java.util.function.LongSupplier;

/** 只擋 {@link CombatConfig#blockedTeleportCauses()}（預設指令與插件傳送）；珍珠、歌萊果、傳送門放行。 */
public final class TeleportListener implements Listener {

    private final CombatTagService service;
    private final CombatConfig config;
    private final LongSupplier clock;

    public TeleportListener(CombatTagService service, CombatConfig config, LongSupplier clock) {
        this.service = service;
        this.config = config;
        this.clock = clock;
    }

    @EventHandler(priority = EventPriority.LOWEST, ignoreCancelled = true)
    public void onTeleport(PlayerTeleportEvent event) {
        if (!TeleportRule.blocks(event.getCause().name(), config.blockedTeleportCauses())) {
            return;
        }
        Player player = event.getPlayer();
        if (service.isTagged(player.getUniqueId(), clock.getAsLong())) {
            event.setCancelled(true);
            player.sendMessage(CombatMessages.teleportBlocked());
        }
    }
}
```

### `KickListener.java`（轉接層：被踢原因）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import com.example.combat.core.KickRule;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerKickEvent;

/** 被踢是否免死看 {@code PlayerKickEvent.Cause} 白名單（見 {@link KickRule}）；此事件在 PlayerQuitEvent 之前觸發。 */
public final class KickListener implements Listener {

    private final CombatTagService service;

    public KickListener(CombatTagService service) {
        this.service = service;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onKick(PlayerKickEvent event) {
        service.markKicked(event.getPlayer().getUniqueId(), KickRule.exemptsPunishment(event.getCause().name()));
    }
}
```

### `QuitListener.java`（轉接層：戰鬥登出處罰）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.inventory.ItemStack;

import java.util.function.LongSupplier;

/**
 * 戰鬥中登出 → 處罰。NORMAL 優先權：要在其他插件的 MONITOR 清理之前處決，讓它們的死亡事件處理照常執行。
 * 處決後的 {@code PlayerDeathEvent} 由 {@link DeathListener} 再清一次標記（已被 onQuit 清過，無害）。
 */
public final class QuitListener implements Listener {

    private final CombatTagService service;
    private final CombatConfig config;
    private final LongSupplier clock;

    public QuitListener(CombatTagService service, CombatConfig config, LongSupplier clock) {
        this.service = service;
        this.config = config;
        this.clock = clock;
    }

    @EventHandler(priority = EventPriority.NORMAL)
    public void onQuit(PlayerQuitEvent event) {
        Player player = event.getPlayer();
        if (service.onQuit(player.getUniqueId(), clock.getAsLong()) != CombatTagService.LogoutVerdict.PUNISH) {
            return;
        }
        if (player.isDead()) {
            return;
        }
        switch (config.logoutMode()) {
            case KILL -> player.setHealth(0.0);
            case DROP_ITEMS -> dropInventory(player);
        }
    }

    private static void dropInventory(Player player) {
        Location at = player.getLocation();
        World world = at.getWorld();
        for (ItemStack item : player.getInventory().getContents()) {
            if (item != null && !item.getType().isAir()) {
                world.dropItemNaturally(at, item);
            }
        }
        player.getInventory().clear();
    }
}
```

### `DeathListener.java`（轉接層：死亡解標）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.entity.PlayerDeathEvent;

/** 死亡就解標。{@code ignoreCancelled}：被其他插件取消的死亡不算。 */
public final class DeathListener implements Listener {

    private final CombatTagService service;

    public DeathListener(CombatTagService service) {
        this.service = service;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onDeath(PlayerDeathEvent event) {
        service.untag(event.getPlayer().getUniqueId());
    }
}
```

### `CombatTicker.java`（轉接層：每秒一個 timer）

```java
package com.example.combat.adapter;

import com.example.combat.core.CombatTagService;
import org.bukkit.entity.Player;
import org.bukkit.plugin.Plugin;

import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.logging.Level;

/**
 * 全伺服器只有這一個每秒 timer：對所有標記中的玩家更新 action bar，到期者送一次「脫離戰鬥」。
 * run() 外層有邊界 catch：任何例外都不能讓 timer 每秒噴一次 stack trace，所以只記錄第一次。
 */
public final class CombatTicker implements Runnable {

    private final Plugin plugin;
    private final CombatTagService service;
    private final LongSupplier clock;
    private boolean failureLogged;

    public CombatTicker(Plugin plugin, CombatTagService service, LongSupplier clock) {
        this.plugin = plugin;
        this.service = service;
        this.clock = clock;
    }

    @Override
    public void run() {
        try {
            tick();
        } catch (RuntimeException e) {
            if (!failureLogged) {
                failureLogged = true;
                plugin.getLogger().log(Level.SEVERE, "Combat ticker failed; further failures are not logged", e);
            }
        }
    }

    private void tick() {
        long now = clock.getAsLong();
        for (UUID id : service.expire(now)) {
            Player player = plugin.getServer().getPlayer(id);
            if (player != null) {
                player.sendActionBar(CombatMessages.left());
            }
        }
        for (UUID id : service.tagged()) {
            Player player = plugin.getServer().getPlayer(id);
            if (player != null) {
                player.sendActionBar(CombatMessages.countdown(service.remainingSeconds(id, now)));
            }
        }
    }
}
```

### `CombatTagApi.java`（公開 API，`api` package）

```java
package com.example.combat.api;

import java.util.Optional;
import java.util.UUID;

/**
 * CombatTag 給其他插件使用的介面（例如決鬥插件在開局時解標）。
 *
 * <p>取得方式：{@code getServer().getServicesManager().load(CombatTagApi.class)}，每次呼叫前取一次、不要快取。
 * 規則同 paper-service-api：只用 JDK 型別、只加不改、只在主執行緒呼叫。
 */
public interface CombatTagApi {

    boolean isTagged(UUID player);

    /** 剩餘秒數；未標記回 0。 */
    long remainingSeconds(UUID player);

    /** 最後的對手；未標記回 empty。 */
    Optional<UUID> lastAttacker(UUID player);

    /** 解除標記；沒標記就 no-op。 */
    void untag(UUID player);
}
```

### `CombatTagApiImpl.java`（API 實作）

```java
package com.example.combat.adapter;

import com.example.combat.api.CombatTagApi;
import com.example.combat.core.CombatTagService;

import java.util.Optional;
import java.util.UUID;
import java.util.function.LongSupplier;

final class CombatTagApiImpl implements CombatTagApi {

    private final CombatTagService service;
    private final LongSupplier clock;

    CombatTagApiImpl(CombatTagService service, LongSupplier clock) {
        this.service = service;
        this.clock = clock;
    }

    @Override
    public boolean isTagged(UUID player) {
        return service.isTagged(player, clock.getAsLong());
    }

    @Override
    public long remainingSeconds(UUID player) {
        return service.remainingSeconds(player, clock.getAsLong());
    }

    @Override
    public Optional<UUID> lastAttacker(UUID player) {
        return service.lastAttacker(player, clock.getAsLong());
    }

    @Override
    public void untag(UUID player) {
        service.untag(player);
    }
}
```

### `CombatTagPlugin.java`（組裝）

```java
package com.example.combat.adapter;

import com.example.combat.api.CombatTagApi;
import com.example.combat.core.CombatTagService;
import org.bukkit.plugin.PluginManager;
import org.bukkit.plugin.ServicePriority;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.function.LongSupplier;

public final class CombatTagPlugin extends JavaPlugin {

    private CombatTagService service;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        CombatConfig config;
        try {
            config = CombatConfig.from(getConfig());
        } catch (IllegalArgumentException e) {
            getLogger().severe("Invalid config.yml: " + e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        LongSupplier clock = System::currentTimeMillis;
        service = new CombatTagService(config.durationMillis());
        AttackerResolver resolver = new AttackerResolver(this, config.attributionWindowTicks());
        CombatTagger tagger = new CombatTagger(this, service, clock);

        PluginManager pm = getServer().getPluginManager();
        pm.registerEvents(new DamageListener(resolver, tagger), this);
        pm.registerEvents(new PotionListener(resolver, tagger), this);
        pm.registerEvents(new BombListener(resolver), this);
        pm.registerEvents(new CommandListener(this, service, config, clock), this);
        pm.registerEvents(new TeleportListener(service, config, clock), this);
        pm.registerEvents(new KickListener(service), this);
        pm.registerEvents(new QuitListener(service, config, clock), this);
        pm.registerEvents(new DeathListener(service), this);

        getServer().getScheduler().runTaskTimer(this, new CombatTicker(this, service, clock), 20L, 20L);

        // 其餘初始化完成後才註冊，確保使用端拿到的是可用的實作
        getServer().getServicesManager().register(
            CombatTagApi.class, new CombatTagApiImpl(service, clock), this, ServicePriority.Normal);
    }

    @Override
    public void onDisable() {
        getServer().getServicesManager().unregisterAll(this);
        getServer().getScheduler().cancelTasks(this);
        if (service != null) {
            service.clear();
        }
    }
}
```

### `config.yml` 與 `plugin.yml`

```yaml
# config.yml
duration-seconds: 20
logout-mode: KILL            # KILL | DROP_ITEMS
attribution-window-ticks: 2  # 水晶／重生錨／床 的回查視窗
command-whitelist:           # 填正式指令名；別名與 minecraft: 命名空間會自動歸一
  - msg
  - tell
  - r
blocked-teleport-causes:     # 留空 = COMMAND、PLUGIN
  - COMMAND
  - PLUGIN
```

```yaml
# plugin.yml
name: CombatTag
version: 1.0.0
main: com.example.combat.adapter.CombatTagPlugin
api-version: '26.2'
permissions:
  combattag.bypass:
    description: Never gets combat tagged
    default: op
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/combat/
├── core/                     ← 無 Bukkit，JUnit 直接測
│   ├── CombatTagService.java
│   ├── ActionLedger.java
│   ├── CommandPolicy.java
│   ├── KickRule.java
│   └── TeleportRule.java
├── api/                      ← 不可 relocate、只加不改
│   └── CombatTagApi.java
└── adapter/
    ├── CombatTagPlugin.java
    ├── CombatConfig.java / CombatMessages.java
    ├── AttackerResolver.java / CombatTagger.java / CombatTicker.java
    ├── CombatTagApiImpl.java
    └── *Listener.java
src/test/java/com/example/combat/core/
src/main/resources/{config.yml,plugin.yml}
```

## 執行緒安全注意事項 / Thread Safety

- 核心與所有 Listener 都只在**主執行緒**執行；`CombatTagService` 沒有鎖，不要在非同步任務中碰它
- 非同步階段需要資料時，先在主執行緒取快照（例如 `remainingSeconds`），把值傳進去
- `CombatTicker` 用 `runTaskTimer`（主執行緒），全伺服器只有一個 timer，不要每位玩家一個
- `onDisable` 取消任務並 `clear()`；API 實作若要支援他執行緒，須改讀不可變快照
- 詳見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 被爆炸／藥水打到沒標記 | 傷害沒有 causing entity | 查歸因矩陣；水晶、錨、床靠 `ActionLedger`，藥水靠 `PotionSplashEvent` |
| 被踢出去卻沒判死／反而被放過 | 用 `PlayerQuitEvent#getReason()` 判斷 | 改看 `PlayerKickEvent.Cause` 白名單，第二客戶端登入才不會變成逃跑手段 |
| 別名／命名空間指令繞過白名單 | 只比對玩家輸入字串 | 用 `CommandMap#getCommand` 解析成正式名稱再比對 |
| 戰鬥中珍珠也被擋 | 把所有 `TeleportCause` 都封鎖 | 只擋 `COMMAND`、`PLUGIN`（可在設定調整） |
| 燒傷讓標記永遠不結束 | 環境傷害也重置標記 | 無玩家歸因的傷害一律不重置 |
| 每秒刷 stack trace | timer 內例外 | `run()` 外層 catch，只記錄第一次 |
| 死亡事件被取消卻解了標 | Listener 沒設 `ignoreCancelled` | `MONITOR` + `ignoreCancelled = true` |
| 其他插件拿不到 `CombatTagApi` | API package 被 relocate、或 `load` 太早 | 見 [`paper-service-api`](../paper-service-api/SKILL.md)：`softdepend`、不快取、不 relocate |
