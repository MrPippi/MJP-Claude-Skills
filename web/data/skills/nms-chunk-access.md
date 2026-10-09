---
id: nms-chunk-access
title: NMS Chunk Access
titleZh: NMS 區塊直接存取
description: Direct LevelChunk block state, heightmap, and ChunkSection access for high-performance bulk operations on Paper 1.21.x with Mojang mappings.
descriptionZh: 透過 NMS LevelChunk 直接讀寫方塊狀態、高度圖與 ChunkSection，實現高效能大範圍方塊操作（Paper NMS + Mojang mappings）。
version: "1.0.0"
status: active
category: nms-world
categoryLabel: NMS 世界
categoryLabelEn: NMS World
tags: [nms, chunk, levelchunk, heightmap, bulk-block, performance, mojang-mapped]
triggerKeywords:
  - "chunk access"
  - "LevelChunk"
  - "區塊操作"
  - "chunk data"
  - "直接讀寫方塊"
  - "ChunkSection"
  - "heightmap"
  - "高度圖"
  - "bulk block"
  - "大量方塊"
  - "高效能方塊操作"
  - "structure paste"
updatedAt: "2026-04-30"
githubPath: Skills/nms/nms-chunk-access/SKILL.md
featured: false
---

# NMS Chunk Access

## 目的

透過 NMS `LevelChunk`、`ChunkAccess`、`LevelChunkSection` 直接讀寫方塊狀態與高度圖，繞過 Bukkit `Chunk.getBlock()` 的逐格開銷，實現高效能的大範圍方塊操作（如結構生成、地圖掃描）。

---

## 平台需求

- Paper 1.21 – 1.21.3
- Paperweight userdev 2.0.0-beta.24+
- Mojang mappings（Paper 1.20.5+ 原生支援）
- Java 21

---

## 產生的代碼

### ChunkAccessUtil.java

```java
// 取得指定座標的 NMS BlockState（不觸發光照更新）
BlockState state = ChunkAccessUtil.getBlockState(location);

// 直接設定 BlockState（繞過 Bukkit 事件；flags 3 = 更新鄰居 + 同步客戶端）
ChunkAccessUtil.setBlockState(location, Blocks.STONE.defaultBlockState(), 3);

// 讀取 WORLD_SURFACE 高度圖
int surfaceY = ChunkAccessUtil.getSurfaceHeight(chunk, x, z);
```

### BulkBlockEditor.java（批次操作）

```java
BulkBlockEditor editor = new BulkBlockEditor(level);

// 批次填充方塊（最小化客戶端更新）
for (BlockPos pos : positionList) {
    editor.setBlock(pos, Blocks.GLASS.defaultBlockState());
}

int count = editor.getPendingCount();  // 取得待提交數量
editor.commit();                       // 一次性推送所有區塊更新
```

---

## 執行緒安全

- `ChunkAccessUtil` 與 `BulkBlockEditor` 的所有操作**必須在主執行緒呼叫**
- 區塊讀取操作若區塊未載入，會觸發同步載入，可能造成短暫卡頓
