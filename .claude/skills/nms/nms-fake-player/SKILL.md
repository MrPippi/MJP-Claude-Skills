---
name: nms-fake-player
description: "以真正的 NMS ServerPlayer 建立沒有客戶端的假玩家（機器人／訓練假人）：空連線、皮膚、原版戰鬥與移動物理、NMS 限定在單一套件並在版本不符時只停用該功能（Paper NMS + Paperweight）/ Client-less fake players backed by a real NMS ServerPlayer with vanilla combat and movement, confined NMS and version guard"
---

# NMS Fake Player / NMS 假玩家

## 技能名稱 / Skill Name

`nms-fake-player`

## 目的 / Purpose

建立一個「真的 `ServerPlayer`、但沒有客戶端」的假玩家，用於 PvP 機器人、訓練假人、展示用分身。
和 Citizens 之類的 NPC 不同：傷害、暴擊、擊退、舉盾、吃東西、走路與跳台階全部走原版邏輯，呼叫端只需要每 tick 餵輸入（前進／橫移／跳／疾跑）與轉頭。

這是插件中最容易隨版本壞掉的 NMS 程式碼，因此範本同時規範：
- **NMS 只出現在單一套件**，對外只交 Bukkit 型別
- **版本守門**：版本不符時只停用這個功能（例如 `/bot`），插件其餘功能照常

## NMS 版本需求 / NMS Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；版本差異以行尾 `// @1.21.11:` 標註）
- Paperweight userdev（見 [`references/paper-nms-platform.md`](references/paper-nms-platform.md)）
- 依賴 Paper 修補過的建構子與方法（`ServerGamePacketListenerImpl`、`CommonListenerCookie.createInitial`、`addFreshEntity` 的 CraftBukkit 重載），**同一個 MC 版本換 Paper build 也可能改簽名** → 第一次呼叫必須接 `LinkageError`

## 觸發條件 / Triggers

- 「假玩家」「fake player」「機器人」「bot」「訓練假人」「PvP bot」
- 「ServerPlayer NPC」「玩家分身」「不用 Citizens 的 NPC」
- 「EmptyConnection」「沒有客戶端的玩家」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.bot.nms` | NMS 專用套件（只有這個套件可以 import NMS） |
| `supported_versions` | `1.21.11`, `26.2` | 允許啟用的 MC 版本 |
| `name_rule` | `<player>_Bot` | 假玩家名稱規則（≤ 16 字元） |
| `skin_source` | 挑戰者本人 | 皮膚來源玩家 |

## 輸出產物 / Outputs

- `NmsGuard.java` — 版本守門（**不碰任何 NMS 型別**，版本不符時也能安全載入）
- `EmptyConnection.java` — 沒有客戶端的連線：丟掉封包，只保留給自己的擊退速度
- `FakePlayer.java` — 假玩家本體（spawn / tick / input / look / attack / remove），對外只交 Bukkit 型別
- `BotService.java` — Bukkit 端的管理與降級（接 `LinkageError`、每 tick 驅動、玩家上線補送皮膚）

## Paperweight 建置設定 / Build Setup

見 [`references/paper-nms-platform.md`](references/paper-nms-platform.md)。另外建議加一個檢查，確保 NMS／CraftBukkit 類別**沒有被打包**進 jar：

```groovy
tasks.register('verifyNoServerClassesInJar') {
    dependsOn tasks.named('jar')
    doLast {
        def forbidden = ['net/minecraft/', 'org/bukkit/craftbukkit/', 'com/mojang/']
        def jarFile = tasks.named('jar').get().archiveFile.get().asFile
        zipTree(jarFile).visit { details ->
            if (!details.isDirectory() && forbidden.any { details.relativePath.pathString.startsWith(it) }) {
                throw new GradleException("Server class packaged into plugin jar: ${details.relativePath}")
            }
        }
    }
}
tasks.named('build') { dependsOn 'verifyNoServerClassesInJar' }
```

## 代碼範本 / Code Template

### `NmsGuard.java`（版本守門，不碰 NMS）

```java
package com.example.bot;

import org.bukkit.Bukkit;

import java.util.Set;

/**
 * 唯一可以在 NMS 對不上時呼叫的入口：只比對 Bukkit 的版本字串，簽名與欄位都不出現 NMS 型別。
 * 版本相同但 Paper build 改了簽名的情況比不出來 → 呼叫端第一次碰 FakePlayer 時仍要接 LinkageError。
 */
public final class NmsGuard {

    private static final Set<String> SUPPORTED = Set.of("1.21.11", "26.2");

    private NmsGuard() {}

    public static boolean supported() {
        return SUPPORTED.contains(Bukkit.getMinecraftVersion());
    }
}
```

### `EmptyConnection.java`（NMS 套件）

```java
package com.example.bot.nms;

import io.netty.channel.ChannelFutureListener;
import io.netty.channel.embedded.EmbeddedChannel;
import net.minecraft.network.Connection;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.PacketFlow;
import net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
import net.minecraft.world.phys.Vec3;

import java.net.InetSocketAddress;

/**
 * 假玩家的連線：伺服器送給它的封包全部丟掉，只留下「給自己的速度封包」。
 *
 * <p>原版近戰打到玩家時，把擊退包成 ClientboundSetEntityMotionPacket 送給受害者客戶端，送完就還原伺服器端速度——
 * 真玩家的擊退是客戶端收到封包才動。假玩家沒有客戶端，所以由 FakePlayer#tick() 在下一 tick 套用這裡留下的速度
 * （丟掉這個封包就打不退）。
 *
 * <p>ServerGamePacketListenerImpl 會讀 channel 與 address，因此給一個不連到任何地方的 EmbeddedChannel 與 loopback 位址。
 */
final class EmptyConnection extends Connection {

    private int ownerId = Integer.MIN_VALUE;
    private Vec3 pendingMotion;

    EmptyConnection() {
        super(PacketFlow.SERVERBOUND);
        this.channel = new EmbeddedChannel();
        this.address = new InetSocketAddress("127.0.0.1", 0);
    }

    void owner(int entityId) {
        this.ownerId = entityId;
    }

    /** 上一 tick 以來該套用的速度；取走即清空，沒有回 null。 */
    Vec3 takePendingMotion() {
        Vec3 motion = pendingMotion;
        pendingMotion = null;
        return motion;
    }

    @Override
    public void send(Packet<?> packet) {
        capture(packet);
    }

    @Override
    public void send(Packet<?> packet, ChannelFutureListener listener) {
        capture(packet);
    }

    @Override
    public void send(Packet<?> packet, ChannelFutureListener listener, boolean flush) {
        capture(packet);
    }

    private void capture(Packet<?> packet) {
        if (packet instanceof ClientboundSetEntityMotionPacket motion
                && motion.id() == ownerId) { // @1.21.11:                 && motion.getId() == ownerId) {
            pendingMotion = motion.movement(); // @1.21.11:             pendingMotion = motion.getMovement();
        }
    }

    @Override
    public void flushChannel() {
        // 沒有客戶端
    }

    @Override
    public boolean isConnected() {
        return true;
    }
}
```

### `FakePlayer.java`（NMS 套件，對外只交 Bukkit 型別）

```java
package com.example.bot.nms;

import com.mojang.authlib.GameProfile;
import net.minecraft.network.protocol.Packet;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoRemovePacket;
import net.minecraft.network.protocol.game.ClientboundPlayerInfoUpdatePacket;
import net.minecraft.network.protocol.game.ServerboundPlayerLoadedPacket;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ClientInformation;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.CommonListenerCookie;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.phys.Vec3;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.craftbukkit.entity.CraftEntity;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.event.entity.CreatureSpawnEvent;

import java.util.List;
import java.util.UUID;

/**
 * 沒有客戶端的假玩家：真的 ServerPlayer，不走登入流程、不進 PlayerList（不觸發 PlayerJoinEvent、不在 tab 與 getOnlinePlayers()）。
 * 只能在主執行緒使用；呼叫端每 tick 呼叫一次 tick()——真玩家的 doTick 由連線驅動，假玩家不呼叫就不會動。
 *
 * <p>第一次碰這個類別的地方要接 LinkageError（不是 Exception）：Paper build 改了建構子／方法簽名時，錯誤在第一次呼叫才出現。
 */
@SuppressWarnings("UnstableApiUsage")
public final class FakePlayer {

    private final ServerPlayer handle;
    private final EmptyConnection connection;

    private FakePlayer(ServerPlayer handle, EmptyConnection connection) {
        this.handle = handle;
        this.connection = connection;
    }

    /** 在 at 生成名為 name、皮膚取自 skinFrom 的假玩家，並把皮膚資訊送給所有線上玩家。 */
    public static FakePlayer spawn(Location at, String name, Player skinFrom) {
        ServerLevel level = ((CraftWorld) at.getWorld()).getHandle();
        MinecraftServer server = level.getServer();
        ServerPlayer skinOwner = ((CraftPlayer) skinFrom).getHandle();
        GameProfile profile = new GameProfile(UUID.randomUUID(), name, skinOwner.getGameProfile().properties());

        // 沿用皮膚來源玩家的外觀設定（皮膚各層、慣用手）；createDefault() 會把帽子、披風等外層全關
        ServerPlayer handle = new Body(server, level, profile, skinOwner.clientInformation());
        // 建構時會把它登記進全域成就監聽；不拆的話記憶體洩漏，還可能對全服公告假玩家達成成就
        handle.getAdvancements().clearTriggers(); // @1.21.11:         handle.getAdvancements().stopListening();

        EmptyConnection connection = new EmptyConnection();
        connection.owner(handle.getId());
        handle.connection = new ServerGamePacketListenerImpl(server, connection, handle,
            CommonListenerCookie.createInitial(profile, false));
        handle.snapTo(at.getX(), at.getY(), at.getZ(), at.getYaw(), at.getPitch());
        handle.setYHeadRot(at.getYaw());

        FakePlayer fake = new FakePlayer(handle, connection);
        // 客戶端必須先收到玩家資訊，才會畫出之後的生成封包
        for (Player viewer : Bukkit.getOnlinePlayers()) {
            fake.showTo(viewer);
        }
        if (!level.addFreshEntity(handle, CreatureSpawnEvent.SpawnReason.CUSTOM)) {
            fake.hideFromAll(); // 被其他插件取消：收回已送出的玩家資訊，避免客戶端留下幽靈 UUID
            throw new IllegalStateException("Fake player spawn was cancelled: " + name);
        }
        // 不當成真玩家：怪物目標、睡覺人數、World#getPlayers() 都看 level.players()
        level.players().remove(handle);
        return fake;
    }

    public Player bukkit() {
        return handle.getBukkitEntity();
    }

    /** 還在世界裡且活著。被移除、區塊卸載、死亡都回 false。 */
    public boolean isValid() {
        return !handle.isRemoved() && handle.isAlive();
    }

    /**
     * 每 tick 呼叫一次。先套用上一 tick 收到的擊退，再交給原版 doTick()。
     * 換世界或重新追蹤時它可能回到 level.players()，因此每 tick 開頭再移出一次。
     */
    public void tick() {
        if (!isValid()) return;
        if (handle.level() instanceof ServerLevel level) {
            level.players().remove(handle);
        }
        Vec3 knockback = connection.takePendingMotion();
        if (knockback != null) {
            handle.setDeltaMovement(knockback);
        }
        handle.doTick();
    }

    /** 移動輸入，下一次 tick() 交給原版 travel()。forward／strafe 範圍 -1 到 1。 */
    public void input(float forward, float strafe, boolean jump, boolean sprint) {
        handle.zza = forward;
        handle.xxa = strafe;
        handle.setJumping(jump);
        handle.setSprinting(sprint);
    }

    public void look(float yaw, float pitch) {
        handle.setYRot(yaw);
        handle.setXRot(pitch);
        handle.setYHeadRot(yaw);
    }

    /**
     * 立刻可被攻擊：生成後的無敵來自「客戶端尚未回報載入完成」的逾時，這裡代替不存在的客戶端送出載入完成封包
     * （會觸發 Paper 的 PlayerClientLoadedWorldEvent）。
     */
    public void clearSpawnInvulnerability() {
        handle.connection.handleAcceptPlayerLoad(new ServerboundPlayerLoadedPacket());
    }

    /** 原版近戰：揮手 + Player#attack，傷害、暴擊、擊退、破盾都由原版計算。 */
    public void attack(Entity target) {
        handle.swing(InteractionHand.MAIN_HAND);
        handle.attack(((CraftEntity) target).getHandle());
    }

    /** 讓 viewer 看得到它（listed=false，不出現在 tab）；給生成後才上線的玩家補送。 */
    public void showTo(Player viewer) {
        send(viewer, ClientboundPlayerInfoUpdatePacket.createSinglePlayerInitializing(handle, false));
    }

    public void remove() {
        handle.discard();
        handle.getAdvancements().clearTriggers(); // @1.21.11:         handle.getAdvancements().stopListening();
        hideFromAll();
    }

    private void hideFromAll() {
        ClientboundPlayerInfoRemovePacket packet = new ClientboundPlayerInfoRemovePacket(List.of(handle.getUUID()));
        for (Player viewer : Bukkit.getOnlinePlayers()) {
            send(viewer, packet);
        }
    }

    private static void send(Player viewer, Packet<?> packet) {
        ((CraftPlayer) viewer).getHandle().connection.send(packet);
    }

    /**
     * 由伺服器計算物理的玩家。真玩家的位置由客戶端回報（isClientAuthoritative 為 true），
     * 伺服器會跳過部分垂直碰撞；假玩家沒有客戶端，要像生物一樣由伺服器算。
     * getKnownMovement／getKnownSpeed 對真玩家來自客戶端移動封包，假玩家永遠是零，原版近戰用它判斷橫掃，因此改回伺服器速度。
     */
    private static final class Body extends ServerPlayer {

        Body(MinecraftServer server, ServerLevel level, GameProfile profile, ClientInformation info) {
            super(server, level, profile, info);
        }

        @Override
        public boolean isClientAuthoritative() {
            return false;
        }

        @Override
        public Vec3 getKnownMovement() {
            return getDeltaMovement();
        }

        @Override
        public Vec3 getKnownSpeed() {
            return getDeltaMovement();
        }
    }
}
```

### `BotService.java`（Bukkit 端：驅動、降級、補送皮膚）

```java
package com.example.bot;

import com.example.bot.nms.FakePlayer;
import org.bukkit.Location;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.scheduler.BukkitTask;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.logging.Level;

/**
 * 假玩家的 Bukkit 端管理。FakePlayer 只出現在方法本體內，版本不符時本類別仍可安全載入。
 * 任何 LinkageError 都把整個功能關掉（只影響 bot），並只記錄一次。
 */
public final class BotService implements Listener {

    private final JavaPlugin plugin;
    private final List<FakePlayer> bots = new ArrayList<>();
    private boolean available;
    private BukkitTask ticker;

    public BotService(JavaPlugin plugin) {
        this.plugin = plugin;
        this.available = NmsGuard.supported();
        if (!available) {
            plugin.getLogger().warning("Unsupported Minecraft version for bots; /bot is disabled.");
        }
    }

    public boolean available() {
        return available;
    }

    public void start() {
        if (!available) return;
        ticker = plugin.getServer().getScheduler().runTaskTimer(plugin, this::tickAll, 1L, 1L);
    }

    /** 主執行緒呼叫。功能已停用或版本不符時回 empty。 */
    public Optional<Player> spawn(Location at, String name, Player skinFrom) {
        if (!available) return Optional.empty();
        try {
            FakePlayer bot = FakePlayer.spawn(at, name, skinFrom);
            bot.clearSpawnInvulnerability();
            bots.add(bot);
            return Optional.of(bot.bukkit());
        } catch (LinkageError e) {
            disable(e);
            return Optional.empty();
        } catch (IllegalStateException e) {
            plugin.getLogger().warning(e.getMessage());
            return Optional.empty();
        }
    }

    private void tickAll() {
        try {
            bots.removeIf(bot -> {
                if (!bot.isValid()) {
                    bot.remove();
                    return true;
                }
                bot.tick();
                return false;
            });
        } catch (LinkageError e) {
            disable(e);
        }
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        if (!available) return;
        try {
            for (FakePlayer bot : bots) {
                bot.showTo(event.getPlayer()); // 生成後才上線的玩家也要收到皮膚資訊
            }
        } catch (LinkageError e) {
            disable(e);
        }
    }

    public void shutdown() {
        if (ticker != null) ticker.cancel();
        try {
            bots.forEach(FakePlayer::remove);
        } catch (LinkageError ignored) {
            // 已在停用流程中
        }
        bots.clear();
    }

    private void disable(LinkageError e) {
        if (!available) return;
        available = false;
        plugin.getLogger().log(Level.WARNING,
            "Fake player NMS signatures do not match this server build; bots disabled.", e);
        shutdown();
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/bot/
├── BotService.java          ← Bukkit 端；不 import NMS
├── NmsGuard.java            ← 只比版本字串；不 import NMS
├── brain/                   ← AI 決策（只用 Bukkit 型別，可單元測試）
└── nms/                     ← 唯一可以 import net.minecraft / craftbukkit 的套件
    ├── EmptyConnection.java
    └── FakePlayer.java
```

建議用 ArchUnit 或簡單的原始碼掃描測試守住「只有 `nms/` 能 import `net.minecraft`」。

## 執行緒安全注意事項 / Thread Safety

- ⚠️ `FakePlayer` 的所有方法**只能在主執行緒呼叫**（生成、tick、攻擊、移除）
- `tick()` 每個伺服器 tick 呼叫**一次**；呼叫兩次就是兩倍速
- AI 決策可以在非同步預先計算路徑，但結果要回主執行緒才套用到 `input()` / `look()`
- 詳見 [`references/nms-threading.md`](references/nms-threading.md)

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `NoSuchMethodError` / `NoClassDefFoundError` | Paper build 改了建構子或方法簽名 | `BotService` 接 `LinkageError` 停用 bot；以新的 dev bundle 重新編譯 |
| 假玩家打不退 | `EmptyConnection` 把速度封包也丟了 | 保留 owner 的 `ClientboundSetEntityMotionPacket`，下一 tick 套用 |
| 旁觀者看到對手在打空氣 | 觀看者沒收到玩家資訊封包 | 生成前對所有人 `showTo`，新上線玩家在 join 時補送 |
| 假玩家出現在 tab／`getOnlinePlayers()` | 走了 `PlayerList.placeNewPlayer` | 改用 `addFreshEntity` 並從 `level.players()` 移出 |
| 記憶體逐局增加 | 成就監聽未拆 | 建構後與移除時都 `getAdvancements().clearTriggers()`（1.21.11：`stopListening()`） |
| 生成後幾秒打不到 | 等待客戶端載入完成的逾時 | `clearSpawnInvulnerability()` |
| 外層皮膚（帽子、披風）沒顯示 | 用了 `ClientInformation.createDefault()` | 沿用來源玩家的 `clientInformation()` |
