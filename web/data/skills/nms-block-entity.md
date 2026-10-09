---
id: nms-block-entity
title: NMS Block Entity
titleZh: NMS 自定義方塊實體
description: Implement custom NMS BlockEntity with NBT serialization, tick logic, and client sync via packets on Paper 1.21.x with Mojang mappings.
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

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

### CustomBlockEntity.java

```java
public class CustomBlockEntity extends BlockEntity {

    private int storedEnergy = 0;

    @Override
    protected void saveAdditional(CompoundTag tag, HolderLookup.Provider registries) {
        super.saveAdditional(tag, registries);
        tag.putInt("storedEnergy", storedEnergy);
    }

    @Override
    public void loadAdditional(CompoundTag tag, HolderLookup.Provider registries) {
        super.loadAdditional(tag, registries);
        storedEnergy = tag.getInt("storedEnergy");
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
Optional<CustomBlockEntity> be = BlockEntityHelper.get(world, pos, CustomBlockEntity.class);

// 標記已修改（觸發 NBT 儲存與客戶端同步）
BlockEntityHelper.markDirtyAndSync(level, blockEntity);
```

---

## 執行緒安全

- 所有 BlockEntity 操作**必須在主執行緒呼叫**
- `getUpdatePacket()` 封包在 Netty IO 執行緒傳送，建構資料須在主執行緒完成
