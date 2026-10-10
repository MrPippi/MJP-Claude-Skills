# examples - paper-combat-tag

## Example 1: Test the pure-logic core with JUnit (no Bukkit needed)

**Input:**
```
base_package: com.example.combat
duration_seconds: 20
requirements: verify hit / refresh / expiry / bypass / logout punishment / kick exemption
```

**Output - `CombatTagServiceTest.java` (time is passed in by the test, no sleep):**
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

## Example 2: Rule tests for the command whitelist, teleport causes and attribution window

**Input:**
```
requirements: aliases / namespaces / case / arguments must not bypass the whitelist; pearls are not blocked; crystal attribution is valid only inside the window
```

**Output - `RulesTest.java` (`CommandPolicy` + `TeleportRule` + `ActionLedger`, all Bukkit-free):**
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

## Example 3: A duel plugin untags players at match start through `CombatTagApi`

**Input:**
```
provider_plugin: CombatTag
api_package: com.example.combat.api
consumer_package: com.example.duel.integration
requirements: untag both sides when a duel starts, so the combat tag does not block the arena-entry teleport
```

**Output - consumer hook (the API type appears only inside the `try` of a method body, so the class loads normally when CombatTag is not installed; see `paper-service-api` for the approach):**
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

    /** Call on the main thread only. Does nothing when CombatTag is unavailable or the version mismatches. */
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

**Consumer plugin.yml:**
```yaml
name: Duel
main: com.example.duel.DuelPlugin
api-version: '26.2'
softdepend: [CombatTag]
```

---

## Example 4: Custom command aliases and the combat-logout punishment mode

**Input:**
```
requirements: only /msg and /r in combat; logging out drops items instead of executing the player
```

**Output - `config.yml` (the aliases `/w`, `/tell` and `/minecraft:msg` are all resolved by CommandMap to the canonical name before comparing):**
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

Note: the whitelist takes the **canonical command name**. If `/w` is an alias of `msg`, a player typing `/w Bob hi` is resolved by `CommandMap` to `msg` and allowed;
the namespaced form `/minecraft:msg` works the same way.
