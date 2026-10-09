---
id: paper-config-lang
title: Paper Config & Lang
titleZh: 設定與訊息（config / lang）
description: Parse config.yml once into an immutable validated record, layer bundled defaults under the deployed file, and send MiniMessage messages from lang.yml with safe placeholders and async reload.
descriptionZh: config.yml 只解析一次成不可變、已驗證的 record，jar 內預設疊在部署檔底下；lang.yml 用 MiniMessage 與安全 placeholder；非同步 reload 後原子換快照。
version: "1.0.0"
status: active
category: paper-data
categoryLabel: Paper 資料
categoryLabelEn: Paper Data
tags: [paper-api, config, lang, minimessage, reload, yaml]
triggerKeywords:
  - "config.yml"
  - "lang.yml"
  - "reload"
  - "config-version"
  - "MiniMessage 訊息"
  - "死鍵"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-config-lang/SKILL.md
featured: false
---

# Paper Config & Lang

## 目的

讓設定與訊息的載入方式一致：`config.yml` 解析一次成不可變 `record`（壞值回退預設並產生警告清單，不丟例外）；部署檔優先、jar 內預設疊底；處理器只讀目前的快照；reload 非同步讀檔、主執行緒原子換入、把警告回報給下指令的人。`lang.yml` 是 MiniMessage 模板，玩家可控的值一律當純文字插入。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證，無差異行）
- 純 Paper API，不需要 Paperweight
- Java 21（1.21.11）／25（26.2）

---

## 產生的代碼

### HomeConfig.java（不可變設定 + 驗證）

```java
import java.time.Duration;
import java.util.List;
import java.util.Map;

public record HomeConfig(int maxHomes, Duration teleportCooldown, boolean confirmTeleport, String defaultHomeName) {
    public static final int CURRENT_VERSION = 2;

    public record Parsed(HomeConfig config, List<String> warnings) {}

    /** raw：鍵 → YAML 原始值；壞值回退預設並加警告，不丟例外。 */
    public static Parsed from(Map<String, Object> raw) { /* ... */ }
}
```

### Lang.java（安全 placeholder）

```java
// {name} 風格：值經 escapeTags 以純文字插入
lang.send(player, "home.set", Map.of("name", playerTypedName));

// <player> 風格：Placeholder.unparsed 同樣是純文字
lang.send(player, "welcome", Placeholder.unparsed("player", player.getName()));
```

### SettingsService.java（非同步 reload）

```java
public void reload(Consumer<ReloadResult> onMain) {
    if (!reloading.compareAndSet(false, true)) {
        onMain.accept(new ReloadResult(null, List.of(), "busy"));
        return;
    }
    plugin.getServer().getScheduler().runTaskAsynchronously(plugin, () -> {
        ReloadResult result = tryBuild();                       // 非同步：讀檔、解析、驗證
        plugin.getServer().getScheduler().runTask(plugin, () -> {
            reloading.set(false);
            Settings fresh = result.settings();
            if (fresh != null) current.set(fresh);              // 主執行緒原子換入
            onMain.accept(result);
        });
    });
}
```

---

## 規則

- 處理器不呼叫 `getConfig()`，只讀 `settings.current()`；不要把某次的 `Settings` 存進長壽欄位
- `saveResource` 只在檔案不存在時執行；新鍵不會寫進已部署的檔案，型別變更會被靜靜忽略 → 每個 PR 附「部署檢查清單」
- 改鍵就把 `config-version` 加一並寫版本紀錄；落後時啟動與 reload 都列出警告
- YAML 的 `on`／`off`／`yes`／`no` 會變成布林：鍵與值都要加引號
- 玩家可控的值用 `Map`（自動 escape）或 `Placeholder.unparsed`，絕不拼進 MiniMessage 字串
- 缺鍵顯示紅色 `[missing key]` 並只記一行 log；不使用 `ChatColor` 或 `§`
- 加死鍵／缺鍵 JUnit 測試，lang.yml 才不會越長越肥

---

## 執行緒安全

- 讀檔與解析在非同步執行緒；換入快照在主執行緒
- `Settings` 整份不可變，任何執行緒（PlaceholderAPI、封包 listener）讀 `current()` 都安全
- reload 失敗保留舊快照，並把原因回報給指令發送者
