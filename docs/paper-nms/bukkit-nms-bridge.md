# Bukkit ↔ NMS 橋接速查表 / Bukkit ↔ NMS Bridge Reference

適用版本：Paper 1.21 – 1.21.3（Mojang mappings）
橋接套件：`org.bukkit.craftbukkit.*`

> Paper 1.20.5+ 已移除 CraftBukkit 的版本號 relocation，套件固定為 `org.bukkit.craftbukkit`（無 `v1_21_R1` 後綴）；`v1_xx_Rx` 只存在於 Spigot 與 Paper 1.20.4 以前。
> 需相容 Spigot / 舊版時請搭配 `Skills/nms/nms-reflection-bridge/SKILL.md`。

---

## 核心轉換表

### Bukkit → NMS（getHandle）

```java
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.craftbukkit.entity.CraftEntity;
import org.bukkit.craftbukkit.entity.CraftLivingEntity;
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.craftbukkit.inventory.CraftItemStack;
```

| Bukkit 類型 | NMS 類型 | 轉換方式 |
|-------------|---------|---------|
| `Player` | `ServerPlayer` | `((CraftPlayer) player).getHandle()` |
| `LivingEntity` | `LivingEntity`（NMS） | `((CraftLivingEntity) entity).getHandle()` |
| `Entity`（通用） | `Entity`（NMS） | `((CraftEntity) entity).getHandle()` |
| `World` | `ServerLevel` | `((CraftWorld) world).getHandle()` |
| `ItemStack`（Bukkit） | `ItemStack`（NMS） | `CraftItemStack.asNMSCopy(item)` |
| `ItemStack`（Bukkit，可能為 CraftItemStack） | `ItemStack`（NMS，shared） | `CraftItemStack.asNMSMirror(item)` |

### NMS → Bukkit（getBukkitEntity）

| NMS 類型 | Bukkit 類型 | 轉換方式 |
|---------|-------------|---------|
| `ServerPlayer` | `Player` | `(Player) serverPlayer.getBukkitEntity()` |
| `Entity`（NMS） | `Entity`（Bukkit） | `nmsEntity.getBukkitEntity()` |
| `LivingEntity`（NMS） | `LivingEntity`（Bukkit） | `(LivingEntity) nmsLiving.getBukkitEntity()` |
| `ItemStack`（NMS） | `ItemStack`（Bukkit） | `CraftItemStack.asBukkitCopy(nmsItem)` |
| `ServerLevel` | `World` | `nmsLevel.getWorld()` |

---

## 完整轉換範例

### Player 轉換

```java
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.network.ServerGamePacketListenerImpl;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;

// Bukkit → NMS
Player bukkit = Bukkit.getPlayer("Steve");
ServerPlayer nms = ((CraftPlayer) bukkit).getHandle();

// 取得連線
ServerGamePacketListenerImpl conn = nms.connection;

// 常用 NMS-only 欄位
int latency = nms.connection.latency();      // 延遲（ms）
int entityId = nms.getId();                  // NMS entity ID
java.util.UUID uuid = nms.getUUID();         // UUID（同 Bukkit）
```

---

### World / Level 轉換

```java
import net.minecraft.server.level.ServerLevel;
import org.bukkit.craftbukkit.CraftWorld;
import org.bukkit.World;

// Bukkit → NMS
World bukkit = Bukkit.getWorld("world");
ServerLevel nms = ((CraftWorld) bukkit).getHandle();

// NMS 世界操作
nms.addFreshEntity(mob, CreatureSpawnEvent.SpawnReason.CUSTOM);
net.minecraft.world.level.block.state.BlockState state =
    nms.getBlockState(new net.minecraft.core.BlockPos(0, 64, 0));

// NMS → Bukkit
World back = nms.getWorld();
```

---

### ItemStack 轉換

```java
import net.minecraft.world.item.ItemStack;
import org.bukkit.craftbukkit.inventory.CraftItemStack;

// Bukkit → NMS（副本，修改不影響原物品）
org.bukkit.inventory.ItemStack bukkit = player.getInventory().getItemInMainHand();
ItemStack nms = CraftItemStack.asNMSCopy(bukkit);

// Bukkit → NMS（共用引用，若是 CraftItemStack 則 zero-copy）
ItemStack nmsShared = CraftItemStack.asNMSMirror(bukkit);

// NMS → Bukkit（副本）
org.bukkit.inventory.ItemStack back = CraftItemStack.asBukkitCopy(nms);

// 空物品判斷
boolean isEmpty = nms.isEmpty(); // 優先用 NMS isEmpty()
```

---

### Adventure Component ↔ NMS Component

Paper 1.21 推薦使用 Adventure API，但 NMS 封包需要 NMS Component。

```java
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.gson.GsonComponentSerializer;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.core.RegistryAccess;

// Adventure → NMS（用於封包建構）
Component adventure = Component.text("Hello").color(net.kyori.adventure.text.format.NamedTextColor.GREEN);
String json = GsonComponentSerializer.gson().serialize(adventure);
MutableComponent nmsComponent = net.minecraft.network.chat.Component.Serializer
    .fromJson(json, RegistryAccess.EMPTY);

// NMS → Adventure（從封包讀取文字）
MutableComponent fromPacket = /* packet.getText() */;
String backJson = net.minecraft.network.chat.Component.Serializer.toJson(
    fromPacket, RegistryAccess.EMPTY);
Component backAdventure = GsonComponentSerializer.gson().deserialize(backJson);
```

> ⚠️ `RegistryAccess.EMPTY` 適合純文字與格式代碼，若需要 hover/click event 或特殊資料包文字，需使用伺服器的完整 `RegistryAccess`：
> ```java
> RegistryAccess reg = ((CraftServer) Bukkit.getServer()).getServer().registryAccess();
> ```

---

## CraftBukkit 套件動態取得（相容 Spigot / 舊版）

Paper 1.20.5+ 固定為 `org.bukkit.craftbukkit`；Spigot 與 1.20.4 以前的 Paper 才有 `v1_xx_Rx` 後綴。
若同一個 jar 需跨這些平台運作，動態取得套件名：

```java
/** 取得 CraftBukkit 套件名（Paper 1.20.5+："org.bukkit.craftbukkit"）*/
public static String getCraftBukkitPackage() {
    String serverClass = Bukkit.getServer().getClass().getName();
    // Paper 1.20.5+: "org.bukkit.craftbukkit.CraftServer"；Spigot: "org.bukkit.craftbukkit.v1_21_R1.CraftServer"
    return serverClass.substring(0, serverClass.lastIndexOf('.'));
}

/** 動態取得 CraftPlayer class */
public static Class<?> getCraftPlayerClass() throws ClassNotFoundException {
    return Class.forName(getCraftBukkitPackage() + ".entity.CraftPlayer");
}

/** 動態呼叫 getHandle() */
public static Object getHandle(Player player) throws ReflectiveOperationException {
    return getCraftPlayerClass().getMethod("getHandle").invoke(player);
}
```

---

## 版本號對照

| MC 版本 | CraftBukkit 套件（Paper） | CraftBukkit 套件（Spigot） | Paper Dev Bundle |
|--------|------------------------|--------------------------|-----------------|
| 1.21 | `org.bukkit.craftbukkit` | `org.bukkit.craftbukkit.v1_21_R1` | `1.21-R0.1-SNAPSHOT` |
| 1.21.1 | `org.bukkit.craftbukkit` | `org.bukkit.craftbukkit.v1_21_R1` | `1.21.1-R0.1-SNAPSHOT` |
| 1.21.3 | `org.bukkit.craftbukkit` | `org.bukkit.craftbukkit.v1_21_R2` | `1.21.3-R0.1-SNAPSHOT` |

---

## RegistryAccess 取得方式

不同情境下取得 `RegistryAccess`：

```java
import net.minecraft.core.RegistryAccess;
import org.bukkit.craftbukkit.CraftServer;

// 方法 1：空 registry（純文字渲染適用）
RegistryAccess empty = RegistryAccess.EMPTY;

// 方法 2：完整伺服器 registry（推薦，支援所有資料包功能）
RegistryAccess full = ((CraftServer) Bukkit.getServer()).getServer().registryAccess();

// 方法 3：從 ServerLevel 取得
RegistryAccess fromLevel = serverLevel.registryAccess();
```

---

## 常用 NMS-only 操作（無 Bukkit 等效）

### 讀取玩家延遲（ms）

```java
int ping = ((CraftPlayer) player).getHandle().connection.latency();
```

### 發送封包（不通過 Bukkit 事件）

```java
((CraftPlayer) player).getHandle().connection.send(packet);
```

### 取得實體的 DataTracker

```java
import net.minecraft.network.syncher.SynchedEntityData;

SynchedEntityData data = nmsEntity.getEntityData();
// 讀取特定 key 的值
// data.get(EntityDataAccessor<T> key)
```

### 強制同步實體位置

```java
import net.minecraft.network.protocol.game.ClientboundTeleportEntityPacket;

ClientboundTeleportEntityPacket syncPacket = new ClientboundTeleportEntityPacket(nmsEntity);
// 廣播給視野內玩家
for (ServerPlayer viewer : serverLevel.players()) {
    viewer.connection.send(syncPacket);
}
```

---

## 橋接 API 廢棄警告

下列 CraftBukkit 橋接方法已被標記或計畫廢棄，避免依賴：

| 方法 | 狀態 | 替代方案 |
|------|------|---------|
| `CraftItemStack.asNMSMirror(null)` | NPE 風險 | 先檢查 item != null |
| import `org.bukkit.craftbukkit.v1_21_R1.*` | Paper 1.20.5+ 不存在此套件，編譯失敗 | 改用 `org.bukkit.craftbukkit.*`（Paperweight userdev） |
| `Bukkit.getUnsafe().serialize()` | 不穩定 | 使用 Adventure 序列化 |

---

## 相關技能

- `Skills/nms/nms-reflection-bridge/SKILL.md` — 無版本綁定的反射橋接
- `Skills/nms/nms-packet-sender/SKILL.md` — 使用橋接發送封包
- `Skills/nms/nms-custom-entity/SKILL.md` — 使用橋接生成實體
- `docs/paper-nms/packets.md` — 封包類型參考
- `docs/paper-nms/entities.md` — 實體類層次
