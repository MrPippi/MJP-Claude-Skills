# examples — paper-combat-tag

## 範例 1：用 JUnit 測純邏輯核心（不需要 Bukkit）

**Input:**
```
base_package: com.example.combat
duration_seconds: 20
需求: 驗證 hit / 重置 / 到期 / bypass / 登出判死 / 被踢免死
```

**Output — `CombatTagServiceTest.java`（時間由測試傳入，不用 sleep）:**
```java
package com.example.combat.core;

import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CombatTagServiceTest {

    private static final long DURATION = 20_000L;
    private final UUID alice = UUID.randomUUID();
    private final UUID bob = UUID.randomUUID();
    private final CombatTagService service = new CombatTagService(DURATION);

    @Test
    void hitTagsBothAndReportsNewlyEntered() {
        Set<UUID> entered = service.hit(alice, bob, 1_000L, false, false);

        assertEquals(Set.of(alice, bob), entered);
        assertTrue(service.isTagged(alice, 1_000L));
        assertTrue(service.isTagged(bob, 1_000L));
        assertEquals(Optional.of(bob), service.lastAttacker(alice, 1_000L));
        assertEquals(Optional.of(alice), service.lastAttacker(bob, 1_000L));
    }

    @Test
    void selfDamageIsIgnored() {
        assertTrue(service.hit(alice, alice, 0L, false, false).isEmpty());
        assertFalse(service.isTagged(alice, 0L));
    }

    @Test
    void secondHitRefreshesWithoutReportingEnteredAgain() {
        service.hit(alice, bob, 0L, false, false);

        Set<UUID> entered = service.hit(alice, bob, 15_000L, false, false);

        assertTrue(entered.isEmpty());
        assertTrue(service.isTagged(alice, 34_999L));
        assertFalse(service.isTagged(alice, 35_000L));
    }

    @Test
    void remainingSecondsRoundsUp() {
        service.hit(alice, bob, 0L, false, false);

        assertEquals(20L, service.remainingSeconds(alice, 0L));
        assertEquals(1L, service.remainingSeconds(alice, 19_001L));
        assertEquals(0L, service.remainingSeconds(alice, 20_000L));
    }

    @Test
    void bypassPlayerIsNotTaggedButOpponentIs() {
        Set<UUID> entered = service.hit(alice, bob, 0L, true, false);

        assertEquals(Set.of(bob), entered);
        assertFalse(service.isTagged(alice, 0L));
        assertTrue(service.isTagged(bob, 0L));
    }

    @Test
    void expireRemovesOnlyFinishedTags() {
        service.hit(alice, bob, 0L, false, false);
        UUID carol = UUID.randomUUID();
        service.hit(carol, bob, 10_000L, false, false);

        Set<UUID> expired = service.expire(20_000L);

        assertEquals(Set.of(alice), expired);
        assertTrue(service.isTagged(carol, 20_000L));
    }

    @Test
    void quitWhileTaggedPunishesAndClearsState() {
        service.hit(alice, bob, 0L, false, false);

        assertEquals(CombatTagService.LogoutVerdict.PUNISH, service.onQuit(alice, 5_000L));
        assertFalse(service.isTagged(alice, 5_000L));
    }

    @Test
    void quitAfterExpiryIsFree() {
        service.hit(alice, bob, 0L, false, false);

        assertEquals(CombatTagService.LogoutVerdict.NONE, service.onQuit(alice, 20_000L));
    }

    @Test
    void adminKickIsExemptButOtherKicksArePunished() {
        service.hit(alice, bob, 0L, false, false);
        service.markKicked(alice, KickRule.exemptsPunishment("BANNED"));
        assertEquals(CombatTagService.LogoutVerdict.NONE, service.onQuit(alice, 1_000L));

        service.hit(bob, alice, 0L, false, false);
        service.markKicked(bob, KickRule.exemptsPunishment("DUPLICATE_LOGIN"));
        assertEquals(CombatTagService.LogoutVerdict.PUNISH, service.onQuit(bob, 1_000L));
    }

    @Test
    void untagAndClear() {
        service.hit(alice, bob, 0L, false, false);

        assertTrue(service.untag(alice));
        assertFalse(service.untag(alice));
        service.clear();
        assertTrue(service.tagged().isEmpty());
    }

    @Test
    void rejectsNonPositiveDuration() {
        assertThrows(IllegalArgumentException.class, () -> new CombatTagService(0L));
    }
}
```

---

## 範例 2：指令白名單、傳送原因與歸因視窗的規則測試

**Input:**
```
需求: 別名／命名空間／大小寫／參數 不能繞過白名單；珍珠不被擋；水晶歸因只在視窗內有效
```

**Output — `RulesTest.java`（`CommandPolicy` + `TeleportRule` + `ActionLedger`，皆無 Bukkit）:**
```java
package com.example.combat.core;

import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RulesTest {

    private final Set<String> whitelist = Set.of(CommandPolicy.normalize("/Msg"), CommandPolicy.normalize(" tell "));

    @Test
    void commandTokenIsCaseAndSlashInsensitive() {
        assertEquals("msg", CommandPolicy.rawToken("  /MSG  Bob hello"));
        assertTrue(CommandPolicy.allowed(CommandPolicy.stripNamespace(CommandPolicy.rawToken("/msg Bob hi")), whitelist));
    }

    @Test
    void namespacedUnresolvedCommandFallsBackToStrippedName() {
        assertEquals("tell", CommandPolicy.stripNamespace(CommandPolicy.rawToken("/minecraft:tell Bob hi")));
        assertFalse(CommandPolicy.allowed(CommandPolicy.stripNamespace("minecraft:home"), whitelist));
    }

    @Test
    void emptyCommandIsNeverAllowed() {
        assertFalse(CommandPolicy.allowed(CommandPolicy.rawToken("/"), whitelist));
    }

    @Test
    void teleportRuleBlocksOnlyConfiguredCauses() {
        assertTrue(TeleportRule.blocks("COMMAND", TeleportRule.DEFAULT_BLOCKED));
        assertTrue(TeleportRule.blocks("PLUGIN", TeleportRule.DEFAULT_BLOCKED));
        assertFalse(TeleportRule.blocks("ENDER_PEARL", TeleportRule.DEFAULT_BLOCKED));
        assertFalse(TeleportRule.blocks("CHORUS_FRUIT", TeleportRule.DEFAULT_BLOCKED));
        assertFalse(TeleportRule.blocks("NETHER_PORTAL", TeleportRule.DEFAULT_BLOCKED));
    }

    @Test
    void ledgerLookupOnlyInsideWindow() {
        UUID player = UUID.randomUUID();
        String key = ActionLedger.blockKey("world_nether", 10, 64, -3);
        ActionLedger ledger = ActionLedger.empty().record(key, player, 100, 2);

        assertEquals(Optional.of(player), ledger.lookup(key, 100, 2));
        assertEquals(Optional.of(player), ledger.lookup(key, 102, 2));
        assertTrue(ledger.lookup(key, 103, 2).isEmpty());
        assertTrue(ledger.lookup(ActionLedger.blockKey("world_nether", 11, 64, -3), 100, 2).isEmpty());
    }

    @Test
    void ledgerDropsStaleEntriesOnRecord() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        ActionLedger ledger = ActionLedger.empty()
            .record(ActionLedger.entityKey(a), a, 10, 2)
            .record(ActionLedger.entityKey(b), b, 50, 2);

        assertEquals(1, ledger.entries().size());
    }
}
```

---

## 範例 3：決鬥插件透過 `CombatTagApi` 在開局時解標

**Input:**
```
provider_plugin: CombatTag
api_package: com.example.combat.api
consumer_package: com.example.duel.integration
需求: 決鬥開始時解除雙方標記，避免戰鬥標記擋住進場傳送
```

**Output — 使用端 Hook（API 型別只出現在方法本體的 `try` 內，CombatTag 未安裝時照常載入；做法見 `paper-service-api`）:**
```java
package com.example.duel.integration;

import com.example.combat.api.CombatTagApi;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Collection;
import java.util.UUID;
import java.util.logging.Level;

public final class CombatTagHook {

    public static final String PLUGIN_NAME = "CombatTag";

    private final JavaPlugin plugin;
    private boolean warned;

    public CombatTagHook(JavaPlugin plugin) {
        this.plugin = plugin;
    }

    /** 只在主執行緒呼叫。CombatTag 不可用或版本不合時什麼都不做。 */
    public void untagAll(Collection<UUID> players) {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
            return;
        }
        try {
            CombatTagApi api = plugin.getServer().getServicesManager().load(CombatTagApi.class);
            if (api == null) {
                return;
            }
            for (UUID player : players) {
                api.untag(player);
            }
        } catch (LinkageError e) {
            if (!warned) {
                warned = true;
                plugin.getLogger().log(Level.WARNING,
                    PLUGIN_NAME + " API version mismatch; update both jars together. Feature disabled.", e);
            }
        }
    }
}
```

**使用端 plugin.yml:**
```yaml
name: Duel
main: com.example.duel.DuelPlugin
api-version: '26.2'
softdepend: [CombatTag]
```

---

## 範例 4：自訂指令別名與戰鬥登出處罰模式

**Input:**
```
需求: 戰鬥中只能用 /msg、/r；登出改成掉落物品而非處決
```

**Output — `config.yml`（別名 `/w`、`/tell`、`/minecraft:msg` 都會被 CommandMap 解析成正式名稱後比對）:**
```yaml
duration-seconds: 30
logout-mode: DROP_ITEMS
command-whitelist:
  - msg
  - r
blocked-teleport-causes:
  - COMMAND
  - PLUGIN
```

注意：白名單填的是**正式指令名**。若 `/w` 是 `msg` 的別名，玩家輸入 `/w Bob hi` 會被 `CommandMap` 解析成 `msg` 而放行；
命名空間寫法 `/minecraft:msg` 同理。
