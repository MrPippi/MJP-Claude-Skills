# MJP-Claude-Skills — Minecraft NMS Claude Code Skills

**專為 Paper 1.21.x Mojang-mapped NMS 底層開發設計的 [Claude Code Agent Skills](https://docs.anthropic.com/en/docs/claude-code) 函式庫。**

MJP-Claude-Skills 提供生產就緒的 NMS 技能範本，Claude Code 在產生插件代碼前會自動讀取這些範本，涵蓋封包發送、Netty pipeline 攔截、自定義實體 AI、反射式跨版本橋接，以及多版本 Adapter 模式。

> English documentation: [README.md](README.md)

---

## 平台資訊

| 項目 | 說明 |
|------|------|
| **MC 版本** | 1.21 – 1.21.3 |
| **NMS 映射** | Mojang mappings（Paper 1.20.5+ 原生支援） |
| **建置工具** | Paperweight userdev `2.0.0-beta.24+` |
| **Java** | 21（toolchain） |
| **執行時** | `.claude/skills/`（Claude Code 專用） |

---

## 技能列表

| Skill ID | 類別 | 功能 |
|----------|------|------|
| [`nms-packet-sender`](Skills/nms/nms-packet-sender/SKILL.md) | nms-packet | 透過 `ServerPlayer.connection.send()` 發送 Clientbound 封包 |
| [`nms-packet-interceptor`](Skills/nms/nms-packet-interceptor/SKILL.md) | nms-packet | 注入 `ChannelDuplexHandler` 至 Netty pipeline 攔截/修改封包 |
| [`nms-custom-entity`](Skills/nms/nms-custom-entity/SKILL.md) | nms-entity | 繼承 NMS Mob 類並加入自訂 `PathfinderGoal` AI 行為 |
| [`nms-reflection-bridge`](Skills/nms/nms-reflection-bridge/SKILL.md) | nms-bridge | 以 `MethodHandle` 快取存取 NMS，不需 Paperweight 編譯依賴 |
| [`nms-version-adapter`](Skills/nms/nms-version-adapter/SKILL.md) | nms-bridge | 抽象 Adapter 介面 + runtime dispatch 實現多版本 NMS 相容 |

---

## 快速開始

### 1. 安裝技能執行時

將 `.claude/skills/` 複製到你的專案根目錄：

```bash
cp -r /path/to/MJP-Claude-Skills/.claude/skills/ .claude/skills/
```

### 2. 設定 Claude Code

Claude Code 會自動掃描 `.claude/skills/`，無需額外設定。

### 3. 使用技能

在 Claude Code 工作階段中，用觸發關鍵字描述需求：

```
# 範例：
"幫我實作封包發送器，發送 Action Bar 訊息給玩家"
"我需要攔截 ServerboundChatPacket，過濾特定詞彙"
"建立一個繼承 Zombie、有自訂 AI 追蹤行為的自定義實體"
```

Claude Code 會讀取匹配的 `SKILL.md` 並產生生產就緒的代碼。

---

## 倉庫結構

```
MJP-Claude-Skills/
├── .claude/skills/          ← Claude Code 執行時（與 Skills/ 鏡像）
│   ├── skills-registry.yml
│   ├── _shared/
│   └── nms/
├── Skills/                  ← 規範技能來源
│   ├── skills-registry.yml  ← v5.0.0
│   ├── _shared/
│   │   ├── nms-threading.md   ← NMS 執行緒安全模式
│   │   └── nms-obfuscation.md ← Mojang 映射說明
│   ├── paper-nms/
│   │   └── PLATFORM.md        ← Paperweight build.gradle 範本
│   └── nms/
│       ├── nms-packet-sender/
│       ├── nms-packet-interceptor/
│       ├── nms-custom-entity/
│       ├── nms-reflection-bridge/
│       └── nms-version-adapter/
└── docs/paper-nms/          ← NMS API 速查表
    ├── packets.md               ← Clientbound/Serverbound 封包目錄
    ├── entities.md              ← 實體類層次、Goal 系統、Attribute 常數
    ├── network.md               ← Netty pipeline 與執行緒模型
    └── bukkit-nms-bridge.md     ← Bukkit ↔ NMS 橋接轉換表
```

---

## 新增技能

1. 在 `Skills/nms/<slug>/` 建立 `SKILL.md` + `examples.md`（至少 2 個範例）
2. 同步至 `.claude/skills/nms/<slug>/`
3. 在兩份 `skills-registry.yml` 加入新條目
4. 在 SKILL.md 的 Fallback 章節引用 `docs/paper-nms/` 相關文件

完整 7 步流程與不變式見 `CLAUDE.md`。

---

## 授權

MIT
