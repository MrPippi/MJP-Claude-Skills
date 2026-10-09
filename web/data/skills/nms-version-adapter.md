---
id: nms-version-adapter
title: NMS Version Adapter
titleZh: NMS 多版本適配器
description: Abstract adapter interface with version-specific implementations and runtime dispatch for multi-version NMS compatibility across Paper 26.x versions.
descriptionZh: 抽象 Adapter 介面搭配版本特定實作與 runtime dispatch，讓同一 plugin 支援多個 Paper 26.x 版本。
version: "1.0.0"
status: active
category: nms-bridge
categoryLabel: NMS 橋接
categoryLabelEn: NMS Bridge
tags: [nms, adapter, multi-version, strategy-pattern, paperweight]
triggerKeywords:
  - "version adapter"
  - "版本適配器"
  - "multi-version"
  - "多版本相容"
  - "adapter pattern NMS"
updatedAt: "2026-04-19"
githubPath: Skills/nms/nms-version-adapter/SKILL.md
featured: false
---

# NMS Version Adapter

## 目的

建立抽象 Adapter 介面定義共通 NMS 操作，為每個支援的 MC 版本提供具體實作，runtime 時根據伺服器版本自動選擇。

---

## 平台需求

- Paper 26.x（26.2 / 26.3 adapter 範例）
- 建議搭配 multi-module Gradle build（每個版本各自 module 使用 Paperweight 編譯）

---

## 產生的代碼

### NmsAdapter.java（介面）

```java
public interface NmsAdapter {
    NmsVersion version();
    void sendActionBar(Player player, Component message);
    int getLatency(Player player);
    void spawnParticleClient(Location loc, String particleKey, int count);
}
```

### AdapterRegistry.java

```java
// 啟動時注冊各版本 adapter
AdapterRegistry.register(new V26_2_Adapter());
AdapterRegistry.register(new V26_3_Adapter());
AdapterRegistry.initialize(); // 自動偵測版本並選擇

// 使用（版本無關）
AdapterRegistry.get().sendActionBar(player, Component.text("歡迎！"));
```

### NmsVersion.java

```java
public enum NmsVersion {
    V26_1, V26_2, V26_3, UNSUPPORTED;

    public static NmsVersion detect() {
        String[] parts = Bukkit.getMinecraftVersion().split("\\."); // "26.2"、"26.1.2"
        return switch (parts[0] + "." + parts[1]) {
            case "26.1" -> V26_1;
            case "26.2" -> V26_2;
            case "26.3" -> V26_3;
            default -> UNSUPPORTED;
        };
    }
}
```

---

## Multi-module Gradle 結構

```
my-plugin/
├── core/           # NmsAdapter 介面（只依賴 paper-api）
├── adapter-v26_2/  # Paper 26.2 dev bundle 編譯
├── adapter-v26_3/# Paper 26.3 dev bundle 編譯
└── plugin/         # shadowJar 整合打包
```
