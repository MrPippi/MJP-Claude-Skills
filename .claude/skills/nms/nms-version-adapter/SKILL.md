---
name: nms-version-adapter
description: "多版本 NMS 相容性 Adapter 模式：抽象介面 + 版本特定實作 + runtime dispatch，讓同一 plugin 支援多個 MC 版本 / Multi-version NMS compatibility adapter pattern"
---

# NMS Version Adapter / NMS 多版本適配器

## 技能名稱 / Skill Name

`nms-version-adapter`

## 目的 / Purpose

建立抽象 Adapter 介面定義共通 NMS 操作，再為每個支援的 MC 版本提供具體實作，runtime 時根據伺服器版本自動選擇正確 adapter。適合需支援多版本發佈的商業/大型 plugin。

## NMS 版本需求 / NMS Version Requirements

- 支援範圍：Paper 1.21.11 / 26.x（範例以 26.2 / 26.3 兩個 adapter 示範；1.21.11 adapter 寫法相同，dev bundle 改為 `1.21.11-R0.1-SNAPSHOT`、Java 21）
- 建議搭配 `nms-reflection-bridge` 或 multi-module Gradle build
- Adapter 實作可選 Paperweight（需 multi-module）或純反射

## 觸發條件 / Triggers

- 「version adapter」「版本適配器」「multi-version」
- 「多版本相容」「跨版本 NMS」「backwards compatibility」
- 「adapter pattern NMS」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `package_name` | `com.example.nms` | 產出類別所在 package |
| `adapter_interface` | `NmsAdapter` | 抽象介面名稱 |
| `supported_versions` | `26.2, 26.3` | 需支援的 MC 版本列表 |

## 輸出產物 / Outputs

- `NmsAdapter.java` — 共通抽象介面
- `AdapterRegistry.java` — 版本偵測與 adapter 選擇器
- `V26_2_Adapter.java` — Paper 26.2 實作
- `V26_3_Adapter.java` — Paper 26.3 實作
- `NmsVersion.java` — 版本列舉

## Paperweight 建置設定 / Build Setup

建議採用 **multi-module Gradle build**，每個版本各自 module 編譯：

```
my-plugin/
├── build.gradle
├── core/                  # 版本無關邏輯 + NmsAdapter 介面
├── adapter-v26_2/         # 使用 26.2 dev bundle 編譯
├── adapter-v26_3/       # 使用 26.3 dev bundle 編譯
└── plugin/                # 整合所有 adapter 並打包
```

## 代碼範本 / Code Template

### `NmsVersion.java`

```java
package com.example.nms;

import org.bukkit.Bukkit;

public enum NmsVersion {
    V26_1,
    V26_2,
    V26_3,
    UNSUPPORTED;

    public static NmsVersion detect() {
        // 26.x 起版本號為「年份.drop[.hotfix]」，例如 "26.2"、"26.1.2"；以前兩段比對
        String[] parts = Bukkit.getMinecraftVersion().split("\\.");
        String majorMinor = parts.length >= 2 ? parts[0] + "." + parts[1] : parts[0];
        return switch (majorMinor) {
            case "26.1" -> V26_1;
            case "26.2" -> V26_2;
            case "26.3" -> V26_3;
            default -> UNSUPPORTED;
        };
    }
}
```

### `NmsAdapter.java`

```java
package com.example.nms;

import org.bukkit.entity.Player;
import org.bukkit.Location;
import net.kyori.adventure.text.Component;

/**
 * 跨版本 NMS 操作介面。所有方法必須對所有支援版本給出等效結果。
 */
public interface NmsAdapter {

    /** 回傳此 adapter 支援的 MC 版本。 */
    NmsVersion version();

    /** 發送 action bar 文字。 */
    void sendActionBar(Player player, Component message);

    /** 取得玩家網路延遲（ms）。 */
    int getLatency(Player player);

    /** 在指定座標生成粒子（純客戶端，不觸發 event）。 */
    void spawnParticleClient(Location loc, String particleKey, int count);

    /** 直接 tick 實體（用於強制更新）。 */
    void forceTickEntity(org.bukkit.entity.Entity entity);
}
```

### `AdapterRegistry.java`

```java
package com.example.nms;

import java.util.EnumMap;
import java.util.Map;

public final class AdapterRegistry {

    private static final Map<NmsVersion, NmsAdapter> ADAPTERS = new EnumMap<>(NmsVersion.class);
    private static NmsAdapter active;

    private AdapterRegistry() {}

    public static void register(NmsAdapter adapter) {
        ADAPTERS.put(adapter.version(), adapter);
    }

    /** 在 plugin onEnable 呼叫，自動選擇當前版本的 adapter。 */
    public static void initialize() {
        NmsVersion detected = NmsVersion.detect();
        if (detected == NmsVersion.UNSUPPORTED) {
            throw new IllegalStateException(
                "Unsupported MC version: " + org.bukkit.Bukkit.getMinecraftVersion());
        }
        active = ADAPTERS.get(detected);
        if (active == null) {
            throw new IllegalStateException(
                "No adapter registered for version: " + detected);
        }
    }

    /** 取得當前執行環境的 adapter。 */
    public static NmsAdapter get() {
        if (active == null) throw new IllegalStateException("AdapterRegistry not initialized");
        return active;
    }
}
```

### `V26_2_Adapter.java`（範例實作）

```java
package com.example.nms.v26_2;

import com.example.nms.NmsAdapter;
import com.example.nms.NmsVersion;
import io.papermc.paper.adventure.PaperAdventure;
import net.kyori.adventure.text.Component;
import net.minecraft.network.protocol.game.ClientboundSetActionBarTextPacket;
import net.minecraft.server.level.ServerPlayer;
import org.bukkit.craftbukkit.entity.CraftPlayer;
import org.bukkit.entity.Player;
import org.bukkit.Location;

@SuppressWarnings("UnstableApiUsage")
public class V26_2_Adapter implements NmsAdapter {

    @Override
    public NmsVersion version() {
        return NmsVersion.V26_2;
    }

    @Override
    public void sendActionBar(Player player, Component message) {
        ClientboundSetActionBarTextPacket packet =
            new ClientboundSetActionBarTextPacket(PaperAdventure.asVanilla(message));
        ServerPlayer nms = ((CraftPlayer) player).getHandle();
        if (nms.connection != null) nms.connection.send(packet);
    }

    @Override
    public int getLatency(Player player) {
        return ((CraftPlayer) player).getHandle().connection.latency();
    }

    @Override
    public void spawnParticleClient(Location loc, String particleKey, int count) {
        // 26.2 版本實作：使用 ClientboundLevelParticlesPacket
        // ...
    }

    @Override
    public void forceTickEntity(org.bukkit.entity.Entity entity) {
        // 26.2 版本實作
        // ...
    }
}
```

### 初始化（`MyNmsPlugin.onEnable`）

```java
@Override
public void onEnable() {
    AdapterRegistry.register(new V26_2_Adapter());
    AdapterRegistry.register(new V26_3_Adapter());
    AdapterRegistry.initialize();

    getLogger().info("Using NMS adapter: " + AdapterRegistry.get().version());
}
```

### 使用端

```java
// 版本無關的業務邏輯
public void sendWelcome(Player player) {
    AdapterRegistry.get().sendActionBar(player, Component.text("歡迎！"));
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/
├── MyNmsPlugin.java
└── nms/
    ├── NmsAdapter.java
    ├── NmsVersion.java
    ├── AdapterRegistry.java
    └── v26_2/
        └── V26_2_Adapter.java
    └── v26_3/
        └── V26_3_Adapter.java
```

## 執行緒安全注意事項 / Thread Safety

- ✅ `AdapterRegistry` 單次初始化後為 immutable，讀取執行緒安全
- ⚠️ Adapter 的具體方法仍遵守 NMS 執行緒規則（參見 [`references/nms-threading.md`](references/nms-threading.md)）
- ⚠️ `AdapterRegistry.register()` 只應在 `onEnable()` 執行一次，避免 race condition
- ⚠️ 若使用 multi-module build，各 adapter module 不可互相引用

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| `IllegalStateException: Unsupported MC version` | 在未支援版本上啟動 | 在 `NmsVersion.detect()` 加 fallback 分支（嘗試最接近的版本） |
| `ClassNotFoundException` / `NoClassDefFoundError` | adapter 引用的 NMS 類別在目前版本不存在 | 在 `register()` 外層用 try-catch，若失敗則不註冊該 adapter |
| `AbstractMethodError` | adapter 介面新增方法但舊 adapter 未實作 | 為介面方法加 `default` 實作 |
| Multi-module 打包遺漏 | shadowJar 未包含 adapter module | 在 `plugin/build.gradle` 加 `shadow project(':adapter-v26_2')` |
| 不同版本 NMS 簽名差異 | 新版本方法移除或改名 | 用 reflection 在 adapter 內做版本分支（結合 `nms-reflection-bridge`） |
