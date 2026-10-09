---
id: paper-service-api
title: Paper Service API
titleZh: 跨插件 Service API
description: Publish and consume cross-plugin APIs through Bukkit ServicesManager with add-only interfaces and consumer hooks that survive jar version skew.
descriptionZh: 透過 Bukkit ServicesManager 發布與取用跨插件 API：只加不改的 api 介面、提供端註冊、使用端 Hook 每次 load 並容忍版本落差。
version: "1.0.0"
status: active
category: paper-integration
categoryLabel: Paper 整合
categoryLabelEn: Paper Integration
tags: [paper-api, services-manager, cross-plugin, api, linkage-error]
triggerKeywords:
  - "跨插件 API"
  - "cross-plugin API"
  - "ServicesManager"
  - "service provider"
  - "NoSuchMethodError"
  - "api package"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-service-api/SKILL.md
featured: false
---

# Paper Service API

## 目的

讓同一插件集內的插件安全地互相呼叫。提供端把只含 JDK 型別的 `api` 介面註冊到 `ServicesManager`；使用端以 `compileOnly` 依賴，執行期每次 `load` 取得，並接住兩個 jar 版本不一致時的 `LinkageError`。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### WalletApi.java（提供端 api package）

```java
public interface WalletApi {
    OptionalLong balance(UUID player);
    ApiResult deposit(UUID player, long amount, String note);
    ApiResult withdraw(UUID player, long amount, String note);
}
```

### WalletPlugin.java（註冊）

```java
getServer().getServicesManager().register(WalletApi.class, new WalletApiImpl(), this, ServicePriority.Normal);
// onDisable
getServer().getServicesManager().unregisterAll(this);
```

### WalletHook.java（使用端）

```java
public boolean withdraw(UUID player, long amount, String note) {
    if (!available()) return false;
    try {
        WalletApi api = plugin.getServer().getServicesManager().load(WalletApi.class);
        return api != null && api.withdraw(player, amount, note) == ApiResult.OK;
    } catch (LinkageError e) {   // 兩個 jar 版本不一致
        warnOnce(e);
        return false;
    }
}
```

---

## 規則

- API 介面只用 JDK 型別、**只加不改**，新方法加在最後
- 使用端每次呼叫都重新 `load`，不快取實作
- API 型別只出現在方法本體的 `try` 內，避免提供端未安裝時 class 載入失敗
- API package 不可被 shade／relocate 進使用端 jar

---

## 執行緒安全

- 提供端方法預設只允許主執行緒，違反時丟 `IllegalStateException`
- 需要任意執行緒讀取的方法必須讀不可變快照
