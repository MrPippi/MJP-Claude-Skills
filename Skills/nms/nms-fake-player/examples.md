# examples — nms-fake-player

## 範例 1：會追擊並近戰的 PvP 機器人

**Input:**
```
package_name: com.example.bot.nms
name_rule: <player>_Bot
skin_source: 挑戰者本人
```

**Output — AI 決策只用 Bukkit 型別（放在 `brain/`，可單元測試），每 tick 由 BotService 呼叫:**
```java
package com.example.bot.brain;

import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.util.Vector;

/** 簡單追擊：面向目標、前進，距離 3 格內且攻擊冷卻好了就出手。 */
public final class ChaseBrain {

    private static final double REACH = 3.0;
    private int cooldownTicks;

    /** 回傳本 tick 要不要攻擊；移動與轉頭寫進 out。 */
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
            cooldownTicks = 12; // 約等於劍的攻擊冷卻
            return true;
        }
        return false;
    }

    /** 本 tick 的輸出（避免在 brain 內碰 NMS）。 */
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

**BotService 的 tick 中套用（`FakePlayer` 只在 `try` 內出現，接 `LinkageError`）:**
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

## 範例 2：舉盾的訓練假人

**Input:**
```
package_name: com.example.dummy.nms
skin_source: 伺服器管理員
```

**Output — 在 FakePlayer 加入「使用物品」，讓假人舉盾（原版會計算格擋與破盾）:**
```java
    /** 開始使用手上的物品（盾牌、食物）。 */
    public void useItem(boolean offHand) {
        handle.startUsingItem(offHand ? InteractionHand.OFF_HAND : InteractionHand.MAIN_HAND);
    }

    public void stopUsingItem() {
        handle.stopUsingItem();
    }
```

**呼叫端：生成後給副手盾牌並持續舉盾:**
```java
Player dummy = botService.spawn(arena, "Dummy", admin).orElseThrow();
dummy.getInventory().setItemInOffHand(new ItemStack(Material.SHIELD));
// 每 tick：bot.useItem(true); bot.tick();
```

---

## 範例 3：守住「NMS 只在 nms 套件」的測試

**Output — 純 JUnit 原始碼掃描（不需要伺服器）:**
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
