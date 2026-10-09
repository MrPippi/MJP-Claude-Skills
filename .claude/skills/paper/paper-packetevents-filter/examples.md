# examples — paper-packetevents-filter

## 範例 1：改寫（而不是隱藏）特定玩家看到的系統聊天

**Input:**
```
backend: packetevents
recipes: chat
需求: 「兒童模式」玩家看到的系統訊息裡，把指定詞彙換成 ***；其他玩家不受影響
```

**Output — 沿用 `FilterState` 的 `chatHidden` 集合當作「兒童模式」名單；詞彙表是建構時就固定的不可變 `Pattern`:**
```java
import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterState;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSystemChatMessage;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.TextReplacementConfig;

import java.util.UUID;
import java.util.regex.Pattern;

public final class ChatRewriteFilter extends PacketListenerAbstract {

    private final FilterState state;
    private final FailOpenGuard guard;
    private final TextReplacementConfig censor;

    public ChatRewriteFilter(FilterState state, FailOpenGuard guard, Pattern badWords) {
        super(PacketListenerPriority.NORMAL);
        this.state = state;
        this.guard = guard;
        this.censor = TextReplacementConfig.builder().match(badWords).replacement("***").build();
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        if (!guard.active() || event.getPacketType() != PacketType.Play.Server.SYSTEM_CHAT_MESSAGE) {
            return;
        }
        try {
            User user = event.getUser();
            UUID recipient = user == null ? null : user.getUUID();
            if (recipient == null || !state.current().chatHidden().contains(recipient)) {
                return;
            }
            WrapperPlayServerSystemChatMessage wrapper = new WrapperPlayServerSystemChatMessage(event);
            Component original = wrapper.getMessage();
            Component rewritten = original.replaceText(censor);   // Components are immutable: a new value
            if (!rewritten.equals(original)) {
                wrapper.setMessage(rewritten);
                event.markForReEncode(true);   // without this the client still receives the old bytes
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);   // fail-open: the original packet goes out unchanged
        }
    }
}
```

註冊方式同 `ChatPacketFilter`：在 `PacketEventsBridge.register` 內多加一行
`registered.add(events.registerListener(new ChatRewriteFilter(state, new FailOpenGuard(log, "rewrite"), pattern)));`。
若同時啟用 `ChatPacketFilter`（取消）與改寫，取消的過濾器用較低優先權或先註冊，避免對已取消的封包做白工。

---

## 範例 2：重送單一格子，讓 lore 立即更新

**Input:**
```
backend: packetevents
recipes: lore
需求: 玩家開關「顯示價值」或物品價格改變後，立刻讓用戶端重畫某一格，不用 updateInventory() 整個重送
```

**Output — 背包 index 對照 window 0 的容器格子（`toContainerSlot`），並在主執行緒送 SET_SLOT（`stateId=0` 代表伺服器主動，用戶端不動游標與預測佇列）:**

```java
import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetSlot;
import io.github.retrooper.packetevents.util.SpigotConversionUtil;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * MAIN THREAD ONLY (reads the player's inventory). Touches PacketEvents types, so only call it through
 * the Hook-guarded path (e.g. from the Bridge side), never when packetevents is absent.
 */
public final class SlotResender {

    private final Logger log;

    public SlotResender(Logger log) {
        this.log = log;
    }

    /**
     * Sends the ORIGINAL item through the normal listener chain: the injector adds its lore exactly as
     * for any server-sent packet, so state must be changed first and the resend done second.
     */
    public void resend(Player player, int bukkitSlot) {
        int container = toContainerSlot(bukkitSlot);
        if (container < 0) {
            return;
        }
        ItemStack item = player.getInventory().getItem(bukkitSlot);
        ItemStack source = item == null ? new ItemStack(Material.AIR) : item;
        WrapperPlayServerSetSlot packet =
                new WrapperPlayServerSetSlot(0, 0, container, SpigotConversionUtil.fromBukkitItemStack(source));
        try {
            PacketEvents.getAPI().getPlayerManager().sendPacket(player, packet);
        } catch (RuntimeException e) {
            log.log(Level.WARNING, "Could not resend slot " + bukkitSlot + " to " + player.getUniqueId(), e);
        }
    }

    /**
     * Bukkit PlayerInventory index -> container slot of window 0.
     * Hotbar 0-8 -> 36-44, main 9-35 unchanged, armor 36-39 -> 8-5, offhand 40 -> 45.
     *
     * @return the container slot, or -1 when the index is not a player slot
     */
    static int toContainerSlot(int slot) {
        if (slot < 0) {
            return -1;
        }
        if (slot <= 8) {
            return slot + 36;
        }
        if (slot <= 35) {
            return slot;
        }
        if (slot <= 39) {
            return 44 - slot;
        }
        return slot == 40 ? 45 : -1;
    }
}
```

ProtocolLib 對應寫法：以 `ProtocolLibrary.getProtocolManager().createPacket(PacketType.Play.Server.SET_SLOT)` 建立封包，
用 `getIntegers().write(0, 0)`、`write(1, 0)`、`write(2, container)` 與 `getItemModifier().write(0, item)` 填欄位，
再 `sendServerPacket(player, packet, true)`（第三個參數 `true` = 讓封包走監聽鏈）。

---

## 範例 3：沒裝 packetevents 時的邊界測試

**Input:**
```
需求: 確認 packetevents 不在 classpath 時，「一定會被載入」的類別不會因反射而炸掉
```

**Output — 測試 classpath 刻意不含 packetevents（`compileOnly` 不會進測試 runtime，所以這和伺服器缺插件時看到的一樣）。`Bukkit.registerEvents` 會對 Listener 呼叫 `getDeclaredMethods()`，任何成員簽名引用封包型別都會丟 `NoClassDefFoundError`:**
```java
import java.util.List;

public final class PacketBoundaryCheck {

    private PacketBoundaryCheck() {
    }

    /** Classes that are loaded even when packetevents is absent: none of their members may mention packet types. */
    private static final List<String> ALWAYS_LOADED = List.of(
            "com.example.filter.FilterPlugin",
            "com.example.filter.GameModeTracker",
            "com.example.filter.integration.PacketEventsHook",
            "com.example.filter.integration.ProtocolLibHook",
            "com.example.filter.state.FilterSnapshot",
            "com.example.filter.state.FilterState",
            "com.example.filter.state.FailOpenGuard",
            "com.example.filter.packet.LorePainter");

    /** Call it from a JUnit test; throws AssertionError describing the first offender. */
    public static void verify() throws ClassNotFoundException {
        try {
            Class.forName("com.github.retrooper.packetevents.event.PacketListener");
            throw new AssertionError("packetevents is on the test classpath: this test cannot detect leaks");
        } catch (ClassNotFoundException expected) {
            // good: same view as a server without the plugin
        }
        for (String name : ALWAYS_LOADED) {
            Class<?> type = Class.forName(name);
            try {
                type.getDeclaredConstructors();
                type.getDeclaredFields();
                type.getDeclaredMethods();
            } catch (LinkageError e) {
                throw new AssertionError(name + " exposes a packet-library type in a member signature", e);
            }
        }
    }
}
```

另一個值得寫的測試是 `FailOpenGuard`：呼叫兩次 `trip(...)`，驗證 `active()` 變成 `false` 且只記錄一筆 WARNING。
