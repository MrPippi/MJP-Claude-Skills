---
id: paper-softdepend-hook
title: Paper Softdepend Hook
titleZh: 第三方軟依賴接點
description: Use Vault, PlaceholderAPI and packetevents as soft dependencies safely with a Hook + Bridge split, guarded construction, listener-signature rules, LinkageError fallbacks and a class-load boundary test.
descriptionZh: 安全使用 Vault、PlaceholderAPI、packetevents 等第三方軟依賴：Hook + Bridge 分離、isPluginEnabled 後才建構、監聽器簽名規則、接 LinkageError，並以邊界測試驗證沒裝時也能載入。
version: "1.0.0"
status: active
category: paper-integration
categoryLabel: Paper 整合
categoryLabelEn: Paper Integration
tags: [paper-api, softdepend, vault, placeholderapi, packetevents, linkage-error]
triggerKeywords:
  - "軟依賴"
  - "softdepend"
  - "Vault"
  - "PlaceholderAPI"
  - "packetevents"
  - "NoClassDefFoundError"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-softdepend-hook/SKILL.md
featured: false
---

# Paper Softdepend Hook

## 目的

讓插件在有裝第三方插件時多一項功能、沒裝時照常啟動。這是 `paper-service-api`（自家插件之間）的第三方版本：第三方型別不在你的 jar 裡，JVM 一載入引用它們的類別就會丟 `NoClassDefFoundError`，所以要用 Hook + Bridge + 自家 Port 三層隔開。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證，無版本差異）
- 純 Paper API；VaultAPI 1.7.1、PlaceholderAPI 2.11.6、packetevents-spigot 2.13.0 皆為 `compileOnly`
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### VaultHook.java（沒有任何 Vault 型別）

```java
public boolean install() {
    if (!plugin.getServer().getPluginManager().isPluginEnabled(PLUGIN_NAME)) {
        return false;                         // 沒裝：直接降級
    }
    try {
        money = new Guarded(VaultBridge.create(plugin.getServer().getServicesManager()));
        return true;
    } catch (LinkageError e) {                // 載入失敗或版本不合
        warnOnce(e);
        return false;
    }
}
```

### MarketExpansion.java（PlaceholderAPI，任意執行緒讀快照）

```java
@Override public boolean persist() { return true; }

@Override
public String onRequest(OfflinePlayer player, String params) {
    if (player == null) return null;
    double balance = publisher.current().balance(player.getUniqueId()); // volatile 不可變快照
    return "balance".equals(params) ? String.format(Locale.ROOT, "%,.2f", balance) : null;
}
```

### 邊界測試

```java
// 軟依賴只用 compileOnly：測試 classpath 沒有它們，反射行為等同於「伺服器沒裝」
assertDoesNotThrow(() -> { type.getDeclaredFields(); type.getDeclaredMethods(); });
```

---

## 規則

- `isPluginEnabled` 先於任何會載入第三方型別的程式碼；Bridge 是唯一 `import` 第三方 package 的類別
- Listener 的任何成員簽名（含 lambda 捕獲）不得出現軟依賴型別，否則 `registerEvents` 失敗、監聽器靜默失效
- `Economy.format()` 常含舊式色碼：轉成 Component 再當 MiniMessage placeholder，不要拼字串
- 每次操作重新向 `ServicesManager` 取 `Economy`，不快取提供端
- 接 `LinkageError`，降級並只警告一次；`onDisable` 取消註冊 expansion 與服務

---

## 執行緒安全

- Vault 提供端只在主執行緒呼叫
- PlaceholderAPI `onRequest` 可能在任何執行緒：只讀由主執行緒發佈的不可變 volatile 快照
- packetevents listener 在 Netty 執行緒：只讀快照、不呼叫 Bukkit API
