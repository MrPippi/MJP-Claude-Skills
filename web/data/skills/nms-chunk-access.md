---
id: nms-chunk-access
title: NMS Chunk Access
titleZh: NMS 區塊直接存取
description: Direct LevelChunk block state, heightmap, and ChunkSection access for high-performance bulk operations on Paper 26.x with official Mojang names.
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

- Paper 26.2
- Paperweight userdev 2.0.0-beta.24+
- Mojang 官方名稱（Minecraft 26.1 起不再混淆）
- Java 25

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
BulkBlockEditor editor = new BulkBlockEditor(world);

// 批次填充方塊（最小化客戶端更新）
editor.fill(0, 64, 0, 15, 70, 15, Blocks.GLASS.defaultBlockState())
      .set(8, 71, 8, Blocks.GLOWSTONE.defaultBlockState());

int count = editor.pendingCount();  // 取得待提交數量
editor.commit(3);                   // 一次性推送（flags 3 = 更新鄰居 + 同步客戶端）
```

---

## 執行緒安全

- `ChunkAccessUtil` 與 `BulkBlockEditor` 的所有操作**必須在主執行緒呼叫**
- 區塊讀取操作若區塊未載入，會觸發同步載入，可能造成短暫卡頓
