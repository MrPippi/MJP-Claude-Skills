---
name: paper-packetevents-filter
description: "不碰 NMS 的封包過濾：以 PacketEvents（主）或 ProtocolLib 軟依賴監聽封包，Hook + Bridge 隔離、Netty 執行緒只讀不可變快照、fail-open / Packet filtering without NMS via soft-dependent PacketEvents (primary) or ProtocolLib with Hook + Bridge, snapshot-only Netty-thread reads and fail-open"
---

# Paper PacketEvents Filter / PacketEvents 封包過濾

## 技能名稱 / Skill Name

`paper-packetevents-filter`

## 目的 / Purpose

在**不使用 NMS、不注入 Netty pipeline** 的前提下，過濾或改寫送給特定玩家的封包：隱藏／改寫系統聊天、對每位觀看者注入物品 lore、對單一玩家消音或隱藏粒子。
封包函式庫由伺服器上的 **PacketEvents**（主要路線）或 **ProtocolLib**（次要路線）插件提供，本插件只 `compileOnly`、**絕不 shade**，並以 `softdepend` 宣告，沒裝時其餘功能照常運作。

核心規則（違反任何一條都會在正式服出事）：

1. **Hook + Bridge**：碰到封包函式庫型別的類別一律放進 Bridge／Listener，只有在「函式庫已啟用」之後才會被載入。
2. **Netty 執行緒**：監聽器不在主執行緒。只讀「主執行緒發布的不可變 volatile 快照」，**禁止呼叫任何 Bukkit API**，只改 clone 出來的資料。
3. **Fail-open**：任何例外 → 放行原封包、停用該過濾器、只記錄一次。會擋封包的程式不能因為自己壞掉而吞掉封包。
4. **對稱生命週期**：`onEnable` 註冊、`onDisable` 取消註冊；不呼叫 PacketEvents 的 `load()` / `init()` / `terminate()`（那是 packetevents 插件自己的生命週期）。

> 需要自己改寫 Netty pipeline、或需要 NMS 封包類別時（NMS／Netty 路線），請改用 [`nms-packet-interceptor`](../../nms/nms-packet-interceptor/SKILL.md)。
> 軟依賴的一般做法（`getPlugin` 判斷、PlaceholderAPI 等）見 [`paper-softdepend-hook`](../paper-softdepend-hook/SKILL.md)。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；本技能的程式碼兩版相同，沒有 `// @1.21.11:` 差異行）
- 純 Paper API，不需要 Paperweight
- 伺服器需安裝 **packetevents**（編譯對象 `packetevents-spigot:2.13.0`）或 **ProtocolLib**（編譯對象 `5.3.0`）；實際支援的 MC 版本由伺服器上那個插件的版本決定，升 MC 前先升它

## 觸發條件 / Triggers

- 「PacketEvents」「packetevents」「封包過濾」「packet filter」「packet listener」
- 「ProtocolLib」「PacketAdapter」「不用 NMS 攔封包」
- 「隱藏聊天」「SYSTEM_CHAT_MESSAGE」「per-viewer lore」「SET_SLOT」「WINDOW_ITEMS」
- 「取消粒子」「取消音效」「只對某玩家」「Netty thread」「fail-open」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `base_package` | `com.example.filter` | 產出類別所在 package（下分 `state` / `packet` / `integration`） |
| `backend` | `packetevents` / `protocollib` | 封包函式庫；預設 `packetevents` |
| `recipes` | `chat`, `lore`, `quiet` | 要啟用的過濾配方 |
| `snapshot_fields` | `chatHidden`, `creative`, `quiet` | 主執行緒要發布給 Netty 執行緒的資料 |

## 輸出產物 / Outputs

- `FilterSnapshot.java` / `FilterState.java` — 不可變快照與 volatile 發布點
- `FailOpenGuard.java` — 例外時停用過濾器並只記一次
- `ChatPacketFilter.java` — 隱藏／改寫 `SYSTEM_CHAT_MESSAGE`（`PacketListenerAbstract`）
- `LoreInjector.java` + `LorePainter.java` — 每位觀看者的 lore 注入（`PacketListener`，跳過創造模式）
- `QuietPacketFilter.java` — 對單一玩家隱藏粒子／音效
- `PacketEventsHook.java` + `PacketEventsBridge.java` — 軟依賴接點
- `ProtocolLibLoreAdapter.java` + `ProtocolLibHook.java` + `ProtocolLibBridge.java` — ProtocolLib 版本
- `GameModeTracker.java` + `FilterPlugin.java` — 主執行緒發布快照與生命週期

## 建置設定 / Build Setup

見 [`Skills/paper-api/PLATFORM.md`](../../paper-api/PLATFORM.md)。兩個封包函式庫都只是 `compileOnly`：

```groovy
repositories {
    maven { url = 'https://repo.codemc.io/repository/maven-releases/' }   // PacketEvents
    maven { url = 'https://repo.dmulloy2.net/repository/public/' }        // ProtocolLib
}

dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable' // 1.21.11：'1.21.11-R0.1-SNAPSHOT'
    compileOnly 'com.github.retrooper:packetevents-spigot:2.13.0'
    compileOnly 'com.comphenix.protocol:ProtocolLib:5.3.0'
}
```

`plugin.yml`（兩個都列，執行期哪個有裝就用哪個；PacketEvents 的插件名稱是**小寫** `packetevents`）：

```yaml
name: Example
main: com.example.filter.FilterPlugin
api-version: '26.2'
softdepend: [packetevents, ProtocolLib]
```

shadow 設定不得打包 `com.github.retrooper`、`io.github.retrooper`、`com.comphenix` 套件；用 `unzip -l` 確認 jar 內沒有它們。

## 代碼範本 / Code Template

### `FilterSnapshot.java`（不可變快照，不碰封包型別）

```java
package com.example.filter.state;

import org.bukkit.Material;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Everything the Netty-thread listeners may read, as one immutable value.
 * The main thread builds a new instance and publishes it through {@link FilterState};
 * listeners read {@code FilterState#current()} once per packet and never see a torn state.
 */
public record FilterSnapshot(
        Set<UUID> chatHidden,
        String allowedPrefix,
        Set<UUID> creative,
        Set<UUID> quiet,
        Set<String> mutedSounds,
        Set<String> mutedParticles,
        Set<Material> loreMaterials,
        String loreText) {

    public static final FilterSnapshot EMPTY = new FilterSnapshot(
            Set.of(), "", Set.of(), Set.of(), Set.of(), Set.of(), Set.of(), "");

    public FilterSnapshot {
        chatHidden = Set.copyOf(chatHidden);
        creative = Set.copyOf(creative);
        quiet = Set.copyOf(quiet);
        mutedSounds = Set.copyOf(mutedSounds);
        mutedParticles = Set.copyOf(mutedParticles);
        loreMaterials = Set.copyOf(loreMaterials);
    }

    public FilterSnapshot withChatHidden(UUID id, boolean on) {
        return new FilterSnapshot(toggled(chatHidden, id, on), allowedPrefix, creative, quiet,
                mutedSounds, mutedParticles, loreMaterials, loreText);
    }

    public FilterSnapshot withCreative(UUID id, boolean on) {
        return new FilterSnapshot(chatHidden, allowedPrefix, toggled(creative, id, on), quiet,
                mutedSounds, mutedParticles, loreMaterials, loreText);
    }

    public FilterSnapshot withQuiet(UUID id, boolean on) {
        return new FilterSnapshot(chatHidden, allowedPrefix, creative, toggled(quiet, id, on),
                mutedSounds, mutedParticles, loreMaterials, loreText);
    }

    public FilterSnapshot withChatRule(String newAllowedPrefix) {
        return new FilterSnapshot(chatHidden, newAllowedPrefix, creative, quiet,
                mutedSounds, mutedParticles, loreMaterials, loreText);
    }

    public FilterSnapshot withMuted(Set<String> sounds, Set<String> particles) {
        return new FilterSnapshot(chatHidden, allowedPrefix, creative, quiet,
                sounds, particles, loreMaterials, loreText);
    }

    public FilterSnapshot withLore(Set<Material> materials, String text) {
        return new FilterSnapshot(chatHidden, allowedPrefix, creative, quiet,
                mutedSounds, mutedParticles, materials, text);
    }

    /** Removes a player from every per-player set (quit). */
    public FilterSnapshot withoutPlayer(UUID id) {
        return new FilterSnapshot(toggled(chatHidden, id, false), allowedPrefix,
                toggled(creative, id, false), toggled(quiet, id, false),
                mutedSounds, mutedParticles, loreMaterials, loreText);
    }

    private static Set<UUID> toggled(Set<UUID> source, UUID id, boolean on) {
        if (source.contains(id) == on) {
            return source;
        }
        Set<UUID> copy = new HashSet<>(source);
        if (on) {
            copy.add(id);
        } else {
            copy.remove(id);
        }
        return copy;
    }
}
```

### `FilterState.java`（volatile 發布點）

```java
package com.example.filter.state;

import java.util.concurrent.atomic.AtomicReference;
import java.util.function.UnaryOperator;

/**
 * Single publication point for {@link FilterSnapshot}. Written on the main thread only;
 * read from any thread. One instance per plugin, passed by constructor (no static state).
 */
public final class FilterState {

    private final AtomicReference<FilterSnapshot> ref = new AtomicReference<>(FilterSnapshot.EMPTY);

    /** Safe from any thread (including Netty). Read once per packet and keep the local reference. */
    public FilterSnapshot current() {
        return ref.get();
    }

    /** Main thread only: derive a new snapshot from the current one and publish it atomically. */
    public void update(UnaryOperator<FilterSnapshot> change) {
        ref.updateAndGet(change);
    }
}
```

### `FailOpenGuard.java`（fail-open：停用並只記一次）

```java
package com.example.filter.state;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * One guard per filter. {@link #trip(Throwable)} disables that filter for the rest of the session and
 * logs once; every listener checks {@link #active()} first. Several Netty threads may trip at once.
 */
public final class FailOpenGuard {

    private final Logger log;
    private final String feature;
    private final AtomicBoolean tripped = new AtomicBoolean();

    public FailOpenGuard(Logger log, String feature) {
        this.log = log;
        this.feature = feature;
    }

    public boolean active() {
        return !tripped.get();
    }

    public void trip(Throwable cause) {
        if (tripped.compareAndSet(false, true)) {
            log.log(Level.WARNING, "Packet filter '" + feature
                    + "' failed and is now disabled (packets pass through unchanged). "
                    + "Check that the packet library supports this Minecraft version.", cause);
        }
    }
}
```

### `ChatPacketFilter.java`（配方 1：過濾系統聊天，PacketEvents）

```java
package com.example.filter.packet;

import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterSnapshot;
import com.example.filter.state.FilterState;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSystemChatMessage;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;

import java.util.UUID;

/**
 * Hides system chat from players in {@code chatHidden}, except messages that start with the allowed
 * prefix and action bar (overlay) messages.
 *
 * <p>Runs on the Netty event loop: reads {@link FilterState#current()} only, no Bukkit API.
 * Fail-open: any exception lets the packet through and disables this filter.
 */
public final class ChatPacketFilter extends PacketListenerAbstract {

    private final FilterState state;
    private final FailOpenGuard guard;

    public ChatPacketFilter(FilterState state, FailOpenGuard guard) {
        super(PacketListenerPriority.NORMAL);
        this.state = state;
        this.guard = guard;
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        if (!guard.active() || event.getPacketType() != PacketType.Play.Server.SYSTEM_CHAT_MESSAGE) {
            return;
        }
        try {
            User user = event.getUser();
            UUID recipient = user == null ? null : user.getUUID();
            if (recipient == null) {
                return; // still logging in
            }
            FilterSnapshot snapshot = state.current();
            if (!snapshot.chatHidden().contains(recipient)) {
                return;
            }
            WrapperPlayServerSystemChatMessage wrapper = new WrapperPlayServerSystemChatMessage(event);
            if (wrapper.isOverlay()) {
                return;
            }
            String plain = PlainTextComponentSerializer.plainText().serialize(wrapper.getMessage());
            if (!plain.startsWith(snapshot.allowedPrefix())) {
                event.setCancelled(true); // last statement: only reached when everything above worked
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);
        }
    }
}
```

### `LorePainter.java`（只處理 clone，不碰封包型別）

```java
package com.example.filter.packet;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds modified <b>clones</b> of items. Never edits the stack it is given: that object may be the
 * server's own stack. The injected line carries an {@code insertion} marker so stripping is exact and
 * idempotent (do not compare line prefixes: players and other plugins can write identical text).
 */
public final class LorePainter {

    public static final String MARKER = "example-filter-lore";

    /** @return a clone with one extra lore line, or null when there is nothing to change */
    public @Nullable ItemStack paint(@Nullable ItemStack item, String text) {
        if (item == null || item.getType().isAir() || text.isEmpty()) {
            return null;
        }
        Component line = Component.text(text).decoration(TextDecoration.ITALIC, false).insertion(MARKER);
        ItemStack copy = item.clone();
        copy.editMeta(meta -> {
            List<Component> lore = withoutOurs(meta.lore());
            lore.add(line);
            meta.lore(lore);
        });
        return copy;
    }

    /** @return a clone without our lore line, or null when the item did not carry it */
    public @Nullable ItemStack strip(@Nullable ItemStack item) {
        if (item == null || item.getType().isAir() || !item.hasItemMeta()) {
            return null;
        }
        ItemMeta meta = item.getItemMeta();
        List<Component> before = meta.lore();
        if (before == null) {
            return null;
        }
        List<Component> after = withoutOurs(before);
        if (after.size() == before.size()) {
            return null;
        }
        ItemStack copy = item.clone();
        copy.editMeta(m -> m.lore(after.isEmpty() ? null : after));
        return copy;
    }

    private static List<Component> withoutOurs(@Nullable List<Component> lore) {
        List<Component> out = new ArrayList<>();
        if (lore != null) {
            for (Component line : lore) {
                if (!MARKER.equals(line.insertion())) {
                    out.add(line);
                }
            }
        }
        return out;
    }
}
```

### `LoreInjector.java`（配方 2：每位觀看者的 lore，PacketEvents）

```java
package com.example.filter.packet;

import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterSnapshot;
import com.example.filter.state.FilterState;
import com.github.retrooper.packetevents.event.PacketListener;
import com.github.retrooper.packetevents.event.PacketReceiveEvent;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.wrapper.play.client.WrapperPlayClientCreativeInventoryAction;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSetSlot;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerWindowItems;
import io.github.retrooper.packetevents.util.SpigotConversionUtil;
import org.bukkit.inventory.ItemStack;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Adds a per-viewer lore line to items in SET_SLOT / WINDOW_ITEMS, and strips it again from creative
 * inventory actions. Creative viewers are skipped (the client echoes what it sees back to the server).
 *
 * <p>Netty thread: reads the {@link FilterState} snapshot only. {@code SpigotConversionUtil} returns an
 * independent Bukkit stack and {@link LorePainter} clones before editing, so the server-side stack is
 * never touched. The viewer is identified through {@link User#getUUID()}, not {@code event.getPlayer()}:
 * before PLAY there is no Bukkit player behind the connection.
 */
public final class LoreInjector implements PacketListener {

    private final FilterState state;
    private final FailOpenGuard guard;
    private final LorePainter painter;

    public LoreInjector(FilterState state, FailOpenGuard guard, LorePainter painter) {
        this.state = state;
        this.guard = guard;
        this.painter = painter;
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        boolean setSlot = event.getPacketType() == PacketType.Play.Server.SET_SLOT;
        if (!guard.active() || (!setSlot && event.getPacketType() != PacketType.Play.Server.WINDOW_ITEMS)) {
            return;
        }
        try {
            User user = event.getUser();
            UUID viewer = user == null ? null : user.getUUID();
            FilterSnapshot snapshot = state.current();
            if (viewer == null || snapshot.loreText().isEmpty() || snapshot.creative().contains(viewer)) {
                return;
            }
            boolean changed = setSlot
                    ? paintSetSlot(new WrapperPlayServerSetSlot(event), snapshot)
                    : paintWindowItems(new WrapperPlayServerWindowItems(event), snapshot);
            if (changed) {
                event.markForReEncode(true); // only after the wrapper was fully updated
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);
        }
    }

    @Override
    public void onPacketReceive(PacketReceiveEvent event) {
        if (!guard.active() || event.getPacketType() != PacketType.Play.Client.CREATIVE_INVENTORY_ACTION) {
            return;
        }
        try {
            WrapperPlayClientCreativeInventoryAction wrapper = new WrapperPlayClientCreativeInventoryAction(event);
            ItemStack stripped = painter.strip(SpigotConversionUtil.toBukkitItemStack(wrapper.getItemStack()));
            if (stripped != null) {
                wrapper.setItemStack(SpigotConversionUtil.fromBukkitItemStack(stripped));
                event.markForReEncode(true);
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);
        }
    }

    private boolean paintSetSlot(WrapperPlayServerSetSlot wrapper, FilterSnapshot snapshot) {
        ItemStack painted = paint(wrapper.getItem(), snapshot);
        if (painted == null) {
            return false;
        }
        wrapper.setItem(SpigotConversionUtil.fromBukkitItemStack(painted));
        return true;
    }

    private boolean paintWindowItems(WrapperPlayServerWindowItems wrapper, FilterSnapshot snapshot) {
        boolean changed = false;
        List<com.github.retrooper.packetevents.protocol.item.ItemStack> out = new ArrayList<>();
        for (com.github.retrooper.packetevents.protocol.item.ItemStack slot : wrapper.getItems()) {
            ItemStack painted = paint(slot, snapshot);
            out.add(painted == null ? slot : SpigotConversionUtil.fromBukkitItemStack(painted));
            changed |= painted != null;
        }
        if (changed) {
            wrapper.setItems(out);
        }
        Optional<com.github.retrooper.packetevents.protocol.item.ItemStack> carried = wrapper.getCarriedItem();
        if (carried.isPresent()) {
            ItemStack painted = paint(carried.get(), snapshot);
            if (painted != null) {
                wrapper.setCarriedItem(SpigotConversionUtil.fromBukkitItemStack(painted));
                changed = true;
            }
        }
        return changed;
    }

    private @Nullable ItemStack paint(com.github.retrooper.packetevents.protocol.item.ItemStack packetItem,
                                      FilterSnapshot snapshot) {
        ItemStack item = SpigotConversionUtil.toBukkitItemStack(packetItem);
        if (!snapshot.loreMaterials().contains(item.getType())) {
            return null;
        }
        return painter.paint(item, snapshot.loreText());
    }
}
```

### `QuietPacketFilter.java`（配方 3：對單一玩家隱藏粒子／音效，PacketEvents）

```java
package com.example.filter.packet;

import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterSnapshot;
import com.example.filter.state.FilterState;
import com.github.retrooper.packetevents.event.PacketListenerAbstract;
import com.github.retrooper.packetevents.event.PacketListenerPriority;
import com.github.retrooper.packetevents.event.PacketSendEvent;
import com.github.retrooper.packetevents.protocol.packettype.PacketType;
import com.github.retrooper.packetevents.protocol.packettype.PacketTypeCommon;
import com.github.retrooper.packetevents.protocol.player.User;
import com.github.retrooper.packetevents.protocol.sound.Sound;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerEntitySoundEffect;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerParticle;
import com.github.retrooper.packetevents.wrapper.play.server.WrapperPlayServerSoundEffect;

import java.util.UUID;

/**
 * Cancels selected particles and sounds for players in {@code quiet}. Particle and sound keys are the
 * namespaced ids ({@code minecraft:sweep_attack}, {@code minecraft:entity.player.attack.sweep}).
 * Netty thread, snapshot-only, fail-open.
 */
public final class QuietPacketFilter extends PacketListenerAbstract {

    private final FilterState state;
    private final FailOpenGuard guard;

    public QuietPacketFilter(FilterState state, FailOpenGuard guard) {
        super(PacketListenerPriority.NORMAL);
        this.state = state;
        this.guard = guard;
    }

    @Override
    public void onPacketSend(PacketSendEvent event) {
        PacketTypeCommon type = event.getPacketType();
        if (!guard.active()
                || (type != PacketType.Play.Server.PARTICLE
                && type != PacketType.Play.Server.SOUND_EFFECT
                && type != PacketType.Play.Server.ENTITY_SOUND_EFFECT)) {
            return;
        }
        try {
            User user = event.getUser();
            UUID receiver = user == null ? null : user.getUUID();
            FilterSnapshot snapshot = state.current();
            if (receiver == null || !snapshot.quiet().contains(receiver)) {
                return;
            }
            if (shouldDrop(event, type, snapshot)) {
                event.setCancelled(true);
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);
        }
    }

    private static boolean shouldDrop(PacketSendEvent event, PacketTypeCommon type, FilterSnapshot snapshot) {
        if (type == PacketType.Play.Server.PARTICLE) {
            String key = new WrapperPlayServerParticle(event).getParticle().getType().getName().toString();
            return snapshot.mutedParticles().contains(key);
        }
        Sound sound = type == PacketType.Play.Server.SOUND_EFFECT
                ? new WrapperPlayServerSoundEffect(event).getSound()
                : new WrapperPlayServerEntitySoundEffect(event).getSound();
        return sound != null && snapshot.mutedSounds().contains(sound.getSoundId().toString());
    }
}
```

### `PacketEventsBridge.java`（唯一碰 PacketEvents 的註冊點）

```java
package com.example.filter.integration;

import com.example.filter.packet.ChatPacketFilter;
import com.example.filter.packet.LoreInjector;
import com.example.filter.packet.LorePainter;
import com.example.filter.packet.QuietPacketFilter;
import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterState;
import com.github.retrooper.packetevents.PacketEvents;
import com.github.retrooper.packetevents.event.EventManager;
import com.github.retrooper.packetevents.event.PacketListenerCommon;
import com.github.retrooper.packetevents.event.PacketListenerPriority;

import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

/**
 * The only class (with the listeners) that touches PacketEvents types. <b>It must never be loaded when
 * the packetevents plugin is absent</b>: the types are compileOnly, so loading it would throw
 * {@link NoClassDefFoundError}. {@link PacketEventsHook} guards every call.
 *
 * <p>Only registers and unregisters listeners. Never call {@code load()}, {@code init()} or
 * {@code terminate()}: the API lifecycle belongs to the packetevents plugin and other plugins share it.
 */
final class PacketEventsBridge {

    private PacketEventsBridge() {
    }

    /** @return opaque handles to pass back to {@link #unregister(List)} */
    static List<Object> register(FilterState state, Logger log) {
        EventManager events = PacketEvents.getAPI().getEventManager();
        List<PacketListenerCommon> registered = new ArrayList<>();
        try {
            registered.add(events.registerListener(
                    new ChatPacketFilter(state, new FailOpenGuard(log, "chat"))));
            registered.add(events.registerListener(
                    new QuietPacketFilter(state, new FailOpenGuard(log, "quiet"))));
            registered.add(events.registerListener(
                    new LoreInjector(state, new FailOpenGuard(log, "lore"), new LorePainter()),
                    PacketListenerPriority.NORMAL));
        } catch (RuntimeException | LinkageError e) {
            registered.forEach(events::unregisterListener); // no half-registered state
            throw e;
        }
        return List.copyOf(registered);
    }

    static void unregister(List<Object> handles) {
        EventManager events = PacketEvents.getAPI().getEventManager();
        for (Object handle : handles) {
            events.unregisterListener((PacketListenerCommon) handle);
        }
    }
}
```

### `PacketEventsHook.java`（軟依賴接點，不含 PacketEvents 型別）

```java
package com.example.filter.integration;

import com.example.filter.state.FilterState;
import org.bukkit.Bukkit;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Soft-dependency entry point for packetevents. Has no PacketEvents types in fields, signatures or
 * lambdas; everything that touches them is in {@link PacketEventsBridge}, reached only after
 * {@code isPluginEnabled} is true and wrapped in a {@link LinkageError} catch.
 * Without packetevents the plugin logs one warning and the rest keeps working.
 */
public final class PacketEventsHook {

    public static final String PLUGIN_NAME = "packetevents";

    private final Logger log;
    private @Nullable List<Object> handles;

    public PacketEventsHook(Logger log) {
        this.log = log;
    }

    /** Call from {@code onEnable}. @return whether the filters are active */
    public boolean install(FilterState state) {
        if (handles != null) {
            return true; // already registered: never register twice
        }
        if (!Bukkit.getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
            log.warning("packetevents is not installed: packet filters are disabled; everything else works.");
            return false;
        }
        try {
            handles = PacketEventsBridge.register(state, log);
            return true;
        } catch (LinkageError | RuntimeException e) {
            log.log(Level.WARNING, "packetevents is enabled but the filters could not be registered.", e);
            return false;
        }
    }

    /** Call from {@code onDisable}. No-op when nothing was registered. */
    public void uninstall() {
        List<Object> registered = handles;
        handles = null;
        if (registered == null) {
            return;
        }
        try {
            PacketEventsBridge.unregister(registered);
        } catch (LinkageError | RuntimeException e) {
            // packetevents may have been disabled first, taking its listeners with it
            log.log(Level.FINE, "Could not unregister packet filters (packetevents already disabled?)", e);
        }
    }

    public boolean installed() {
        return handles != null;
    }
}
```

### `ProtocolLibLoreAdapter.java`（ProtocolLib 版：PacketAdapter）

```java
package com.example.filter.packet;

import com.comphenix.protocol.PacketType;
import com.comphenix.protocol.events.ListenerPriority;
import com.comphenix.protocol.events.PacketAdapter;
import com.comphenix.protocol.events.PacketContainer;
import com.comphenix.protocol.events.PacketEvent;
import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterSnapshot;
import com.example.filter.state.FilterState;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.Plugin;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * ProtocolLib variant of {@link LoreInjector} (outgoing SET_SLOT / WINDOW_ITEMS only).
 *
 * <p>Same rules: snapshot-only reads, clone before editing, skip creative, fail-open. ProtocolLib
 * listeners registered with {@code addPacketListener} run on the Netty thread; if you move work to
 * ProtocolLib's async manager it runs on a ProtocolLib pool thread, still never the main thread.
 */
public final class ProtocolLibLoreAdapter extends PacketAdapter {

    private final FilterState state;
    private final FailOpenGuard guard;
    private final LorePainter painter;

    public ProtocolLibLoreAdapter(Plugin plugin, FilterState state, FailOpenGuard guard, LorePainter painter) {
        super(plugin, ListenerPriority.NORMAL, PacketType.Play.Server.SET_SLOT, PacketType.Play.Server.WINDOW_ITEMS);
        this.state = state;
        this.guard = guard;
        this.painter = painter;
    }

    @Override
    public void onPacketSending(PacketEvent event) {
        // During the configuration->play handshake the "player" is a TemporaryPlayer proxy
        // whose getUniqueId() throws; skip those packets (resend the inventory a tick after join).
        if (!guard.active() || event.isPlayerTemporary()) {
            return;
        }
        try {
            UUID viewer = event.getPlayer().getUniqueId(); // the only Player call allowed here
            FilterSnapshot snapshot = state.current();
            if (snapshot.loreText().isEmpty() || snapshot.creative().contains(viewer)) {
                return;
            }
            PacketContainer packet = event.getPacket();
            if (event.getPacketType() == PacketType.Play.Server.SET_SLOT) {
                paintSlot(packet, snapshot);
            } else {
                paintWindow(packet, snapshot);
            }
        } catch (RuntimeException | LinkageError e) {
            guard.trip(e);
        }
    }

    private void paintSlot(PacketContainer packet, FilterSnapshot snapshot) {
        ItemStack painted = paint(packet.getItemModifier().read(0), snapshot);
        if (painted != null) {
            packet.getItemModifier().write(0, painted);
        }
    }

    private void paintWindow(PacketContainer packet, FilterSnapshot snapshot) {
        List<ItemStack> items = packet.getItemListModifier().read(0);
        List<ItemStack> out = new ArrayList<>(items.size());
        boolean changed = false;
        for (ItemStack item : items) {
            ItemStack painted = paint(item, snapshot);
            out.add(painted == null ? item : painted);
            changed |= painted != null;
        }
        if (changed) {
            packet.getItemListModifier().write(0, out);
        }
    }

    private @Nullable ItemStack paint(@Nullable ItemStack item, FilterSnapshot snapshot) {
        if (item == null || !snapshot.loreMaterials().contains(item.getType())) {
            return null;
        }
        return painter.paint(item, snapshot.loreText()); // a clone; never edit `item`
    }
}
```

### `ProtocolLibBridge.java`

```java
package com.example.filter.integration;

import com.comphenix.protocol.ProtocolLibrary;
import com.comphenix.protocol.events.PacketListener;
import com.example.filter.packet.LorePainter;
import com.example.filter.packet.ProtocolLibLoreAdapter;
import com.example.filter.state.FailOpenGuard;
import com.example.filter.state.FilterState;
import org.bukkit.plugin.Plugin;

import java.util.logging.Logger;

/** The only class that touches ProtocolLib types besides the adapter. Loaded only via {@link ProtocolLibHook}. */
final class ProtocolLibBridge {

    private ProtocolLibBridge() {
    }

    static Object register(Plugin plugin, FilterState state, Logger log) {
        PacketListener adapter = new ProtocolLibLoreAdapter(
                plugin, state, new FailOpenGuard(log, "lore"), new LorePainter());
        ProtocolLibrary.getProtocolManager().addPacketListener(adapter);
        return adapter;
    }

    static void unregister(Object handle) {
        ProtocolLibrary.getProtocolManager().removePacketListener((PacketListener) handle);
    }
}
```

### `ProtocolLibHook.java`

```java
package com.example.filter.integration;

import com.example.filter.state.FilterState;
import org.bukkit.plugin.Plugin;
import org.jspecify.annotations.Nullable;

import java.util.logging.Level;
import java.util.logging.Logger;

/** Same shape as {@link PacketEventsHook}, for ProtocolLib (plugin name {@code ProtocolLib}). */
public final class ProtocolLibHook {

    public static final String PLUGIN_NAME = "ProtocolLib";

    private final Plugin plugin;
    private final Logger log;
    private @Nullable Object handle;

    public ProtocolLibHook(Plugin plugin) {
        this.plugin = plugin;
        this.log = plugin.getLogger();
    }

    public boolean install(FilterState state) {
        if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
            log.warning("ProtocolLib is not installed: packet filters are disabled.");
            return false;
        }
        try {
            handle = ProtocolLibBridge.register(plugin, state, log);
            return true;
        } catch (LinkageError | RuntimeException e) {
            log.log(Level.WARNING, "ProtocolLib is enabled but the adapter could not be registered.", e);
            return false;
        }
    }

    public void uninstall() {
        Object registered = handle;
        handle = null;
        if (registered == null) {
            return;
        }
        try {
            ProtocolLibBridge.unregister(registered);
        } catch (LinkageError | RuntimeException e) {
            log.log(Level.FINE, "Could not unregister ProtocolLib adapter (ProtocolLib already disabled?)", e);
        }
    }
}
```

### `GameModeTracker.java`（主執行緒發布快照；不含封包型別）

```java
package com.example.filter;

import com.example.filter.state.FilterState;
import org.bukkit.GameMode;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerGameModeChangeEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.Plugin;

import java.util.UUID;

/**
 * Main thread -> Netty thread bridge. Netty listeners cannot call {@code Player#getGameMode()}, so this
 * listener publishes the creative flag into the snapshot, then resends the inventory so the client
 * redraws with or without the injected lore.
 */
public final class GameModeTracker implements Listener {

    private final Plugin plugin;
    private final FilterState state;

    public GameModeTracker(Plugin plugin, FilterState state) {
        this.plugin = plugin;
        this.state = state;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        UUID id = player.getUniqueId();
        boolean creative = player.getGameMode() == GameMode.CREATIVE;
        state.update(s -> s.withCreative(id, creative));
        // The login-time SET_SLOT / WINDOW_ITEMS were skipped (no player yet): redraw one tick later.
        plugin.getServer().getScheduler().runTask(plugin, player::updateInventory);
    }

    @EventHandler
    public void onGameMode(PlayerGameModeChangeEvent event) {
        Player player = event.getPlayer();
        UUID id = player.getUniqueId();
        boolean creative = event.getNewGameMode() == GameMode.CREATIVE; // event fires before the change
        state.update(s -> s.withCreative(id, creative));
        plugin.getServer().getScheduler().runTask(plugin, player::updateInventory);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        UUID id = event.getPlayer().getUniqueId();
        state.update(s -> s.withoutPlayer(id));
    }
}
```

### `FilterPlugin.java`（生命週期）

```java
package com.example.filter;

import com.example.filter.integration.PacketEventsHook;
import com.example.filter.integration.ProtocolLibHook;
import com.example.filter.state.FilterState;
import org.bukkit.Material;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.Set;

public final class FilterPlugin extends JavaPlugin {

    private final FilterState state = new FilterState();
    private PacketEventsHook packetEvents;
    private ProtocolLibHook protocolLib;

    @Override
    public void onEnable() {
        // Publish configuration as an immutable snapshot (rebuild and republish on reload).
        state.update(s -> s
                .withChatRule("[Server] ")
                .withMuted(Set.of("minecraft:entity.player.attack.sweep"), Set.of("minecraft:sweep_attack"))
                .withLore(Set.of(Material.DIAMOND, Material.EMERALD), "Worth: 100"));

        getServer().getPluginManager().registerEvents(new GameModeTracker(this, state), this);

        // PacketEvents first; ProtocolLib only when PacketEvents is not there. Never run both for the same job.
        packetEvents = new PacketEventsHook(getLogger());
        if (!packetEvents.install(state)) {
            protocolLib = new ProtocolLibHook(this);
            protocolLib.install(state);
        }
    }

    @Override
    public void onDisable() {
        if (packetEvents != null) {
            packetEvents.uninstall();
        }
        if (protocolLib != null) {
            protocolLib.uninstall();
        }
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/filter/
├── FilterPlugin.java              ← 生命週期；只依賴 Hook，不 import 封包型別
├── GameModeTracker.java           ← 主執行緒事件 → 發布快照
├── state/                         ← 無封包型別，Bukkit 可安全載入
│   ├── FilterSnapshot.java
│   ├── FilterState.java
│   └── FailOpenGuard.java
├── packet/                        ← 只有這裡與 Bridge 會 import 封包函式庫
│   ├── ChatPacketFilter.java
│   ├── LoreInjector.java
│   ├── LorePainter.java           ← 只用 Bukkit 型別
│   ├── QuietPacketFilter.java
│   └── ProtocolLibLoreAdapter.java
└── integration/
    ├── PacketEventsHook.java      ← 無封包型別
    ├── PacketEventsBridge.java
    ├── ProtocolLibHook.java
    └── ProtocolLibBridge.java
```

## 執行緒安全注意事項 / Thread Safety

| 規則 | 說明 |
|------|------|
| 監聽器在 Netty 執行緒 | `onPacketSend` / `onPacketSending` 不在主執行緒，一個慢監聽器會拖慢該玩家的整條連線 |
| 只讀快照 | `state.current()` 每個封包讀一次，存成區域變數；快照不可變，不需要鎖 |
| 禁用 Bukkit API | `Bukkit.*`、`Player.*`（除了 UUID）、世界、方塊、排程器一律不碰。身分用 `event.getUser().getUUID()`；要記 log 也只記 UUID |
| 只改 clone | `SpigotConversionUtil` 轉出的 `ItemStack` 與 `LorePainter` 的 clone 可以改；伺服器端的物品、背包絕不能改 |
| 狀態只在主執行緒寫 | 事件、指令、reload 在主執行緒組新快照後 `state.update(...)`；監聽器永遠不寫 |
| 重送封包 | 狀態先改、再重送（`player.updateInventory()` 或 PacketEvents `PlayerManager#sendPacket`，後者會再經過監聽鏈）；重送在主執行緒呼叫 |
| 例外 | 一律 fail-open：`catch (RuntimeException \| LinkageError)` → `guard.trip(e)`；`setCancelled(true)` / `markForReEncode(true)` 放在 try 的最後一行 |

詳見 [`Skills/_shared/paper-threading.md`](../../_shared/paper-threading.md)。

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `NoClassDefFoundError: com/github/retrooper/...` | 沒裝 packetevents，但 Bukkit 反射到引用其型別的類別（欄位、方法簽名、lambda 參數） | 封包型別只出現在 `packet/` 與 Bridge；Hook／Plugin／Listener 成員簽名不得出現；寫一個缺函式庫 classpath 的反射測試 |
| 啟動時 `registerListener` 丟 `NoSuchMethodError` | 伺服器上的 packetevents 版本與編譯版本 API 不一致 | Hook 接 `LinkageError` 降級並記 WARNING；升級伺服器上的 packetevents |
| 過濾器突然不作用、console 一行 WARNING | 某個封包解析失敗（MC 版本新、別的插件塞了奇怪 component）→ guard 已 trip | 這是 fail-open 的預期行為；確認 packetevents 支援目前 MC 版本 |
| 玩家登入時沒有 lore，一動背包才出現 | 登入握手期間沒有 Bukkit 玩家，該批封包被跳過 | 加入後一 tick `player.updateInventory()`（見 `GameModeTracker`） |
| 創造模式物品疊不起來 | 客戶端把看到的 lore 原樣回傳給伺服器 | 跳過創造模式觀看者，並在 `CREATIVE_INVENTORY_ACTION` 剝除標記行 |
| 兩個 lore 插件的行順序不一致 | 重送時直接送「已注入」封包而繞過監聽鏈 | 重送原物品，讓封包走一般監聽鏈 |
| ProtocolLib：`UnsupportedOperationException` 於 `getUniqueId()` | 連線仍是 `TemporaryPlayer` | 先檢查 `event.isPlayerTemporary()` |
| 取消註冊時例外 | packetevents／ProtocolLib 已先被停用 | `uninstall()` 接 `LinkageError \| RuntimeException`，只記 FINE |
| 同一個封包被處理兩次 | 重複 `register`、或兩個後端同時註冊 | Hook 在已有 handle 時忽略；PacketEvents 優先，ProtocolLib 只作備援 |
