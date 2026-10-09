---
id: nms-block-entity
title: NMS Block Entity
titleZh: NMS 自定義方塊實體
description: Implement custom NMS BlockEntity with NBT serialization, tick logic, and client sync via packets on Paper 26.x with official Mojang names.
descriptionZh: 繼承 NMS BlockEntity 實作自定義方塊實體，支援 NBT 讀寫、伺服器端 Tick、封包同步（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-world
categoryLabel: NMS 世界
categoryLabelEn: NMS World
tags: [nms, block-entity, tile-entity, nbt, ticker, mojang-mapped]
triggerKeywords:
  - "BlockEntity"
  - "TileEntity"
  - "自定義方塊實體"
  - "block entity"
  - "tile entity"
  - "方塊 tick"
  - "BlockEntityTicker"
  - "方塊 NBT"
  - "custom block nms"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-block-entity/SKILL.md
featured: false
---

# NMS Block Entity

## 目的

繼承 NMS `BlockEntity` 實作自定義方塊實體，實現 NBT 讀寫、伺服器端 Tick 邏輯（`BlockEntityTicker`）、以及透過封包同步狀態至客戶端。

---

## 平台需求

- Paper 26.2
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）
- Java 25

---

## 產生的代碼

### CustomBlockEntity.java

```java
public class CustomBlockEntity extends BlockEntity {

    private int storedEnergy = 0;

    public CustomBlockEntity(BlockEntityType<?> type, BlockPos pos, BlockState state) {
        super(type, pos, state);
    }

    // 1.21.6+：序列化改用 ValueOutput / ValueInput
    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putInt("storedEnergy", storedEnergy);
    }

    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        storedEnergy = input.getIntOr("storedEnergy", 0);
    }

    @Override
    public ClientboundBlockEntityDataPacket getUpdatePacket() {
        return ClientboundBlockEntityDataPacket.create(this);
    }
}
```

### BlockEntityHelper.java（工具類）

```java
// 在指定位置取得自定義 BlockEntity
Optional<CustomBlockEntity> be = BlockEntityHelper.getCustom(location);

// 標記已修改（觸發 NBT 儲存與客戶端同步）
be.ifPresent(CustomBlockEntity::markDirtyAndSync);
```

---

## 執行緒安全

- 所有 BlockEntity 操作**必須在主執行緒呼叫**
- `getUpdatePacket()` 封包在 Netty IO 執行緒傳送，建構資料須在主執行緒完成
