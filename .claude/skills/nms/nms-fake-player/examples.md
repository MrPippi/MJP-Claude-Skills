# examples — nms-fake-player

## Example 1: A PvP bot that chases and fights in melee

**Input:**
```
package_name: com.example.bot.nms
name_rule: <player>_Bot
skin_source: the challenger
```

**Output — AI decisions use only Bukkit types (placed in `brain/`, unit-testable), called every tick by BotService:**
```java
package com.example.bot.brain;

import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

/** Simple chase: face the target, move forward, attack when within 3 blocks and the attack cooldown is ready. */
public final class ChaseBrain {

    private static final double REACH = 3.0;
    private int cooldownTicks;

    /** Returns whether to attack this tick; movement and look direction are written to out. */
    public boolean think(Location self, Player target, Steering out) {
        Vector toTarget = target.getLocation().toVector().subtract(self.toVector());
        double distance = toTarget.length();
        float yaw = (float) Math.toDegrees(Math.atan2(-toTarget.getX(), toTarget.getZ()));
        float pitch = (float) -Math.toDegrees(Math.asin(toTarget.getY() / Math.max(distance, 0.001)));
        out.set(yaw, pitch, distance > REACH * 0.8 ? 1f : 0f, 0f, distance > 6, distance > 4);
        if (cooldownTicks > 0) {
            cooldownTicks--;
            return false;
        }
        if (distance <= REACH) {
            cooldownTicks = 12; // roughly the sword attack cooldown
            return true;
        }
        return false;
    }

    /** This tick's output (keeps NMS out of the brain). */
    public static final class Steering {
        public float yaw, pitch, forward, strafe;
        public boolean jump, sprint;

        void set(float yaw, float pitch, float forward, float strafe, boolean sprint, boolean jump) {
            this.yaw = yaw; this.pitch = pitch; this.forward = forward; this.strafe = strafe;
            this.sprint = sprint; this.jump = jump;
        }
    }
}
```

**Applied in BotService's tick (`FakePlayer` appears only inside `try`, catching `LinkageError`):**
```java
ChaseBrain.Steering steering = new ChaseBrain.Steering();
boolean attack = brain.think(bot.bukkit().getLocation(), target, steering);
bot.look(steering.yaw, steering.pitch);
bot.input(steering.forward, steering.strafe, steering.jump, steering.sprint);
if (attack) {
    bot.attack(target);
}
bot.tick();
```

---

## Example 2: A training dummy that raises a shield

**Input:**
```
package_name: com.example.dummy.nms
skin_source: the server admin
```

**Output — add "use item" to FakePlayer so the dummy raises its shield (vanilla computes blocking and shield breaking):**
```java
    /** Start using the held item (shield, food). */
    public void useItem(boolean offHand) {
        handle.startUsingItem(offHand ? InteractionHand.OFF_HAND : InteractionHand.MAIN_HAND);
    }

    public void stopUsingItem() {
        handle.stopUsingItem();
    }
```

**Caller: after spawning, give an offhand shield and keep it raised:**
```java
Player dummy = botService.spawn(arena, "Dummy", admin).orElseThrow();
dummy.getInventory().setItemInOffHand(new ItemStack(Material.SHIELD));
// Every tick: bot.useItem(true); bot.tick();
```

---

## Example 3: A test that keeps NMS confined to the nms package

**Output — pure JUnit source scan (no server needed):**
```java
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NmsConfinedTest {

    @Test
    void onlyNmsPackageImportsServerInternals() throws IOException {
        Path root = Path.of("src/main/java");
        try (Stream<Path> files = Files.walk(root)) {
            List<String> offenders = files
                .filter(p -> p.toString().endsWith(".java"))
                .filter(p -> !p.toString().replace('\\', '/').contains("/nms/"))
                .filter(p -> {
                    try {
                        String src = Files.readString(p);
                        return src.contains("import net.minecraft.") || src.contains("import org.bukkit.craftbukkit.");
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                })
                .map(Path::toString)
                .toList();
            assertEquals(List.of(), offenders, "NMS imports outside the nms package");
        }
    }
}
```
