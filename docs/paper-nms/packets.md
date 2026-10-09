# NMS Packet 速查表 / NMS Packet Reference

適用版本：Paper 1.21 – 1.21.3（Mojang mappings）
套件根：`net.minecraft.network.protocol`

> 封包發送用法見 `Skills/nms/nms-packet-sender/SKILL.md`
> 封包攔截用法見 `Skills/nms/nms-packet-interceptor/SKILL.md`
> 執行緒規則見 `Skills/_shared/nms-threading.md`

---

## Clientbound 封包（伺服器 → 客戶端）

### Display / 顯示

#### `ClientboundSetActionBarTextPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket;
import net.minecraft.network.chat.Component;

// 建構
ClientboundSetActionBarTextPacket packet =
    new ClientboundSetActionBarTextPacket(Component.literal("Hello"));
```
| 欄位 | 類型 | 說明 |
|------|------|------|
| `text` | `Component` | Action bar 顯示的文字 |

---

#### `ClientboundSetTitleTextPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetTitleTextPacket;

ClientboundSetTitleTextPacket packet =
    new ClientboundSetTitleTextPacket(Component.literal("§6Boss 戰開始！"));
```

---

#### `ClientboundSetSubtitleTextPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetSubtitleTextPacket;

ClientboundSetSubtitleTextPacket packet =
    new ClientboundSetSubtitleTextPacket(Component.literal("準備好了嗎？"));
```

---

#### `ClientboundSetTitlesAnimationPacket`
控制 title 的淡入/顯示/淡出時間（單位：tick）。
```java
import net.minecraft.network.protocol.game.ClientboundSetTitlesAnimationPacket;

// fadeIn=10, stay=70, fadeOut=20 ticks
ClientboundSetTitlesAnimationPacket packet =
    new ClientboundSetTitlesAnimationPacket(10, 70, 20);
```

---

#### `ClientboundClearTitlesPacket`
```java
import net.minecraft.network.protocol.game.ClientboundClearTitlesPacket;

// resetTimes=true 同時重設計時器
ClientboundClearTitlesPacket packet = new ClientboundClearTitlesPacket(true);
```

---

### Entity / 實體

#### `ClientboundSetEntityDataPacket`
同步實體的 DataTracker 元資料（名稱、發光、靜音等）。
```java
import net.minecraft.network.protocol.game.ClientboundSetEntityDataPacket;
import net.minecraft.network.syncher.SynchedEntityData;

// 取得實體的 entityData 快照
List<SynchedEntityData.DataValue<?>> packedItems = entity.getEntityData().packAll();
if (packedItems != null) {
    ClientboundSetEntityDataPacket packet =
        new ClientboundSetEntityDataPacket(entity.getId(), packedItems);
}
```
| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | `int` | NMS entity ID |
| `packedItems` | `List<SynchedEntityData.DataValue<?>>` | 元資料列表 |

---

#### `ClientboundSetEntityMotionPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetEntityMotionPacket;
import net.minecraft.world.phys.Vec3;

ClientboundSetEntityMotionPacket packet =
    new ClientboundSetEntityMotionPacket(entity.getId(), entity.getDeltaMovement());
// 或手動指定速度
ClientboundSetEntityMotionPacket packet2 =
    new ClientboundSetEntityMotionPacket(entity.getId(), new Vec3(0.0, 0.5, 0.0));
```

---

#### `ClientboundSetEquipmentPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetEquipmentPacket;
import net.minecraft.world.entity.EquipmentSlot;
import com.mojang.datafixers.util.Pair;

List<Pair<EquipmentSlot, net.minecraft.world.item.ItemStack>> slots = List.of(
    Pair.of(EquipmentSlot.MAINHAND, swordItemStack)
);
ClientboundSetEquipmentPacket packet =
    new ClientboundSetEquipmentPacket(entity.getId(), slots);
```

---

#### `ClientboundEntityEventPacket`
觸發客戶端實體動畫（死亡、受傷、魔法等）。
```java
import net.minecraft.network.protocol.game.ClientboundEntityEventPacket;

// eventId: 2=受傷動畫, 3=死亡動畫, 6=馬跳躍, 18=貓發情
ClientboundEntityEventPacket packet =
    new ClientboundEntityEventPacket(entity, (byte) 2);
```

常用 `eventId` 值：

| ID | 效果 | 適用實體 |
|----|------|---------|
| 2 | 受傷動畫 | 所有 LivingEntity |
| 3 | 死亡動畫 | 所有 LivingEntity |
| 6 | 跳躍粒子 | Horse |
| 11 | 施法動畫 | Witch |
| 18 | 愛心粒子 | 可繁殖動物 |
| 29 | 盾牌格擋粒子 | Player |

---

#### `ClientboundTeleportEntityPacket`
```java
import net.minecraft.network.protocol.game.ClientboundTeleportEntityPacket;

ClientboundTeleportEntityPacket packet =
    new ClientboundTeleportEntityPacket(entity);
```

---

### World / 世界

#### `ClientboundLevelParticlesPacket`
```java
import net.minecraft.network.protocol.game.ClientboundLevelParticlesPacket;
import net.minecraft.core.particles.ParticleTypes;

ClientboundLevelParticlesPacket packet = new ClientboundLevelParticlesPacket(
    ParticleTypes.FLAME,   // 粒子類型
    true,                  // 強制顯示（遠距離也顯示）
    x, y, z,              // 中心座標
    0.5f, 0.5f, 0.5f,     // 隨機偏移範圍
    0.0f,                  // speed（影響粒子初速度）
    10                     // 數量
);
```

常用粒子類型（`ParticleTypes.xxx`）：

| 常數 | 效果 |
|------|------|
| `FLAME` | 火焰 |
| `HEART` | 愛心 |
| `EXPLOSION` | 爆炸 |
| `SMOKE` | 煙霧 |
| `END_ROD` | 末影柱粒子 |
| `ENCHANT` | 附魔粒子 |
| `HAPPY_VILLAGER` | 綠色星星 |
| `ANGRY_VILLAGER` | 黑色星星 |
| `CRIT` | 暴擊粒子 |
| `SOUL_FIRE_FLAME` | 靈魂火焰 |
| `DRAGON_BREATH` | 龍息 |

---

#### `ClientboundBlockUpdatePacket`
```java
import net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.block.Blocks;

ClientboundBlockUpdatePacket packet = new ClientboundBlockUpdatePacket(
    new BlockPos(x, y, z),
    Blocks.STONE.defaultBlockState()
);
```

---

#### `ClientboundExplodePacket`

> 類名為 `ClientboundExplodePacket`（非 ~~ClientboundExplosionPacket~~），且建構子在 1.21.2 改版，兩版本寫法不同。

```java
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.protocol.game.ClientboundExplodePacket;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.level.Explosion;
import net.minecraft.world.phys.Vec3;

// 1.21 – 1.21.1：純客戶端爆炸效果，不破壞方塊
ClientboundExplodePacket packet = new ClientboundExplodePacket(
    x, y, z,                               // 中心座標
    3.0f,                                  // 強度（影響視覺效果）
    List.of(),                             // 受影響的方塊位置列表（空 = 不破壞）
    Vec3.ZERO,                             // 玩家 knockback
    Explosion.BlockInteraction.KEEP,
    ParticleTypes.EXPLOSION,               // 小爆炸粒子
    ParticleTypes.EXPLOSION_EMITTER,       // 大爆炸粒子
    SoundEvents.GENERIC_EXPLODE
);

// 1.21.2 – 1.21.3：簡化為 中心點 / 可選 knockback / 粒子 / 音效
ClientboundExplodePacket packet = new ClientboundExplodePacket(
    new Vec3(x, y, z),
    java.util.Optional.empty(),            // 玩家 knockback
    ParticleTypes.EXPLOSION_EMITTER,
    SoundEvents.GENERIC_EXPLODE
);
```

---

### Player / 玩家狀態

#### `ClientboundSetHealthPacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetHealthPacket;

// health: 0.0–20.0, foodLevel: 0–20, saturation: 0.0–5.0
ClientboundSetHealthPacket packet =
    new ClientboundSetHealthPacket(20.0f, 20, 5.0f);
```

---

#### `ClientboundSetExperiencePacket`
```java
import net.minecraft.network.protocol.game.ClientboundSetExperiencePacket;

// progress: 0.0–1.0（進度條）, totalExp: 總經驗, level: 等級
ClientboundSetExperiencePacket packet =
    new ClientboundSetExperiencePacket(0.5f, 100, 10);
```

---

#### `ClientboundContainerSetSlotPacket`
```java
import net.minecraft.network.protocol.game.ClientboundContainerSetSlotPacket;

// containerId=-1=玩家背包, -2=所有格子, 0+=容器開啟ID
ClientboundContainerSetSlotPacket packet = new ClientboundContainerSetSlotPacket(
    -1,         // containerId（-1 = 玩家背包）
    stateId,    // stateId（通常用 0）
    slotIndex,  // 格子索引（0=頭盔, 1=胸甲, 2=褲子, 3=靴子, 9-44=背包）
    nmsItemStack
);
```

---

### Network / 網路

#### `ClientboundCustomPayloadPacket`（Plugin Message）
```java
import io.netty.buffer.Unpooled;
import net.minecraft.network.protocol.common.ClientboundCustomPayloadPacket;
import net.minecraft.network.protocol.common.custom.DiscardedPayload;
import net.minecraft.resources.ResourceLocation;

ResourceLocation channel = ResourceLocation.fromNamespaceAndPath("myplugin", "sync");
byte[] data = /* your data */;

// 1.20.5+：CustomPacketPayload 改為 type() + StreamCodec；任意 channel 原始位元組用 Paper 的 DiscardedPayload
ClientboundCustomPayloadPacket packet =
    new ClientboundCustomPayloadPacket(new DiscardedPayload(channel, Unpooled.wrappedBuffer(data)));
```

---

#### `ClientboundDisconnectPacket`
```java
import net.minecraft.network.protocol.login.ClientboundLoginDisconnectPacket;
import net.minecraft.network.protocol.common.ClientboundDisconnectPacket; // 1.20.2+ 移至 common

// Game 階段踢出
ClientboundDisconnectPacket packet =
    new ClientboundDisconnectPacket(Component.literal("你被踢出了"));
```

---

## Serverbound 封包（客戶端 → 伺服器）

### Movement / 移動

#### `ServerboundMovePlayerPacket` 系列

| 類名 | 傳送內容 |
|------|---------|
| `ServerboundMovePlayerPacket.Pos` | 位置（x, y, z）+ onGround |
| `ServerboundMovePlayerPacket.PosRot` | 位置 + 角度（yaw, pitch）+ onGround |
| `ServerboundMovePlayerPacket.Rot` | 僅角度 + onGround |
| `ServerboundMovePlayerPacket.StatusOnly` | 僅 onGround 狀態 |

攔截範例：
```java
import net.minecraft.network.protocol.game.ServerboundMovePlayerPacket;

if (msg instanceof ServerboundMovePlayerPacket.PosRot move) {
    double x = move.getX(player.getX());
    double y = move.getY(player.getY());
    double z = move.getZ(player.getZ());
    float yaw = move.getYRot(player.getYRot());
}
```

---

### Interaction / 互動

#### `ServerboundInteractPacket`
```java
import net.minecraft.network.protocol.game.ServerboundInteractPacket;

if (msg instanceof ServerboundInteractPacket interact) {
    int entityId = interact.getEntityId();
    // interact.getAction() == ServerboundInteractPacket.Action.INTERACT
    // interact.getAction() == ServerboundInteractPacket.Action.ATTACK
}
```

#### `ServerboundUseItemPacket`
```java
import net.minecraft.network.protocol.game.ServerboundUseItemPacket;
import net.minecraft.world.InteractionHand;

if (msg instanceof ServerboundUseItemPacket use) {
    InteractionHand hand = use.getHand(); // MAIN_HAND or OFF_HAND
}
```

---

### Chat / 聊天

#### `ServerboundChatPacket`
```java
import net.minecraft.network.protocol.game.ServerboundChatPacket;

if (msg instanceof ServerboundChatPacket chat) {
    String message = chat.message(); // 聊天文字
    // chat.timeStamp()  — 訊息時間戳記
}
```

#### `ServerboundChatCommandPacket`
```java
import net.minecraft.network.protocol.game.ServerboundChatCommandPacket;

if (msg instanceof ServerboundChatCommandPacket cmd) {
    String command = cmd.command(); // 不含 "/" 的指令字串
}
```

---

### Player Action / 玩家動作

#### `ServerboundPlayerActionPacket`
```java
import net.minecraft.network.protocol.game.ServerboundPlayerActionPacket;
import net.minecraft.network.protocol.game.ServerboundPlayerActionPacket.Action;

if (msg instanceof ServerboundPlayerActionPacket action) {
    Action type = action.getAction();
    // Action.START_DESTROY_BLOCK   — 開始挖掘
    // Action.STOP_DESTROY_BLOCK    — 停止挖掘
    // Action.ABORT_DESTROY_BLOCK   — 取消挖掘
    // Action.DROP_ALL_ITEMS        — 丟出整組物品（Q+Ctrl）
    // Action.DROP_ITEM             — 丟出單個物品（Q）
    // Action.RELEASE_USE_ITEM      — 放開使用鍵（弓射擊）
    // Action.SWAP_ITEM_WITH_OFFHAND — 換手（F 鍵）
}
```

#### `ServerboundSwingPacket`
```java
import net.minecraft.network.protocol.game.ServerboundSwingPacket;

if (msg instanceof ServerboundSwingPacket swing) {
    InteractionHand hand = swing.getHand(); // 揮動哪隻手
}
```

---

## FriendlyByteBuf 常用操作

```java
import net.minecraft.network.FriendlyByteBuf;
import io.netty.buffer.Unpooled;

FriendlyByteBuf buf = new FriendlyByteBuf(Unpooled.buffer());

// 寫入
buf.writeInt(42);
buf.writeUtf("hello");
buf.writeBoolean(true);
buf.writeFloat(3.14f);
buf.writeVarInt(1000);       // 壓縮整數（封包常用）
buf.writeResourceLocation(ResourceLocation.withDefaultNamespace("stone"));

// 讀取
int i = buf.readInt();
String s = buf.readUtf(32767);  // 最大長度
boolean b = buf.readBoolean();
float f = buf.readFloat();
int vi = buf.readVarInt();
```

---

## 相關技能

- `Skills/nms/nms-packet-sender/SKILL.md` — 發送封包
- `Skills/nms/nms-packet-interceptor/SKILL.md` — 攔截封包
- `Skills/_shared/nms-threading.md` — 執行緒安全
- `docs/paper-nms/network.md` — Netty pipeline 結構
