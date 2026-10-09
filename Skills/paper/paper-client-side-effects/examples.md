# examples — paper-client-side-effects

## 範例 1：玩家在設定頁切換偏好，立即套用

**Input:**
```
base_package: com.example.effects
effects: border, time, weather, night-vision
preference_source: SettingsApi
```

**Output — 設定頁寫入偏好後只呼叫 `refresh`，由 `reconcile()` 決定要套用或還原:**
```java
import com.example.effects.EffectState;
import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;

/** 設定頁在主執行緒寫完偏好後呼叫。偏好從 SettingsHook 重新讀取，不在這裡手動套用任何效果。 */
public final class SettingsPageActions {

    private final EffectState state;

    public SettingsPageActions(EffectState state) {
        this.state = state;
    }

    public void onToggled(Player player) {
        state.refresh(player);
        player.sendMessage(Component.text("Your visual settings were updated."));
    }
}
```

**為什麼不在切換當下直接 `addPotionEffect`:** 關閉夜視時 `reconcile()` 只移除「無限」夜視，不會誤刪玩家自己喝的有限藥水；開啟時若身上是有限夜視，會被覆蓋成永久。

---

## 範例 2：只在大廳隱藏非好友，離開大廳自動恢復

**Input:**
```
effects: visibility
visibility_rule: 大廳內，只看得到好友；其他世界看得到所有人
```

**Output — 規則只回答「該不該藏」，服務負責只動有變的人:**
```java
import com.example.effects.PlayerVisibilityService;
import org.bukkit.World;
import org.bukkit.entity.Player;

import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Predicate;

public final class LobbyFriendsPolicy implements PlayerVisibilityService.Policy {

    private final Predicate<World> isLobby;
    private final Function<UUID, Set<UUID>> friendsOf;

    public LobbyFriendsPolicy(Predicate<World> isLobby, Function<UUID, Set<UUID>> friendsOf) {
        this.isLobby = isLobby;
        this.friendsOf = friendsOf;
    }

    @Override
    public boolean shouldHide(Player viewer, Player target) {
        if (!isLobby.test(viewer.getWorld())) return false;
        return !friendsOf.apply(viewer.getUniqueId()).contains(target.getUniqueId());
    }
}
```

**接線:** `new PlayerVisibilityService(plugin, new LobbyFriendsPolicy(world -> world.getName().equals("lobby"), friendsLookup))`。
好友名單或「大廳」定義變動沒有事件時，用 20 tick 左右的定時器呼叫 `refreshAll()`；它只對差異呼叫 `hidePlayer`／`showPlayer`，成本是線上人數的平方次快取查詢，沒有封包。

**注意:** `hidePlayer` 同時把被藏的人從 TAB 名單移除。

---

## 範例 3：真邊界縮小時，低血量玩家的紅框跟著更新

**Input:**
```
effects: border
```

**Output — 管理員用指令縮邊界；紅框由 `WorldBorderBoundsChangeEvent` 與定時掃描共同修正，不需要在指令裡碰玩家:**
```java
import org.bukkit.World;

import java.time.Duration;

public final class BorderCommands {

    private BorderCommands() {}

    /** 縮邊界。EffectListener 會在下一 tick 重抄每位玩家的虛擬邊界，之後由 tick() 追著漸變。 */
    public static void shrink(World world, double newSize, Duration over) {
        world.getWorldBorder().setSize(newSize, over.toSeconds());
    }
}
```

**驗證流程（手動）:** 對自己 `/effect give @s instant_damage` 直到血量低於門檻 → 出現紅框 → `/worldborder set 100 30` → 紅框的警告距離隨邊界逐步變化，不會停在舊大小 → 補血後紅框消失並回到真邊界。
