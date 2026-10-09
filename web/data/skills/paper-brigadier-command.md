---
id: paper-brigadier-command
title: Paper Brigadier Command
titleZh: Paper Brigadier 指令
description: Register Paper Brigadier commands through LifecycleEvents.COMMANDS with built-in and custom argument types (k/m/b amounts), permission gates, snapshot-only suggestions and a reload subcommand.
descriptionZh: 以 Paper Brigadier API 註冊指令：LifecycleEvents.COMMANDS、內建與自訂參數（k/m/b 金額）、權限 requires、補全只讀快照與 reload 子指令。
version: "1.0.0"
status: active
category: paper-command
categoryLabel: Paper 指令
categoryLabelEn: Paper Command
tags: [paper-api, brigadier, command, argument-type, tab-completion]
triggerKeywords:
  - "Brigadier"
  - "指令補全"
  - "LifecycleEvents.COMMANDS"
  - "Commands.literal"
  - "自訂參數型別"
  - "金額 k m b"
updatedAt: "2026-10-09"
githubPath: Skills/paper/paper-brigadier-command/SKILL.md
featured: false
---

# Paper Brigadier Command

## 目的

用 Paper 的 Brigadier API 註冊有型別參數、有補全、有分層權限的指令。內建 `ArgumentTypes`（玩家選擇器、世界、物品、座標…）由伺服器解析；自訂參數（例如 `1.5k` / `2m` / `1b` 金額）解析失敗時回傳清楚的聊天欄錯誤。

簡單、不需補全的指令仍可留在 `plugin.yml` 的 `commands:` + `getCommand()`；**同一個指令不可兩種方式都宣告**。

---

## 平台需求

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證）
- 純 Paper API，不需要 Paperweight
- 唯一差異：`CommandSourceStack#getPlayerOrThrow()` 只在 26.2；1.21.11 以 `getExecutor()` 判斷

---

## 產生的代碼

### 註冊（onEnable）

```java
public final class ExamplePlugin extends JavaPlugin {
    @Override
    public void onEnable() {
        PayCommand pay = new PayCommand((from, to, amount) -> PayService.Result.OK);
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> {
            Commands registrar = event.registrar();
            registrar.register(pay.build(), "Pay another player", List.of("transfer"));
        });
    }
}
```

### `/pay <player> <amount>`

```java
import com.mojang.brigadier.Command;
import com.mojang.brigadier.tree.LiteralCommandNode;

LiteralCommandNode<CommandSourceStack> node = Commands.literal("pay")
    .requires(CommandSupport.permission("example.pay"))
    .then(Commands.argument("target", ArgumentTypes.player())
        .then(Commands.argument("amount", new AmountArgumentType())
            .executes(context -> Command.SINGLE_SUCCESS)))
    .build();
```

### 自訂 k/m/b 金額參數

```java
import com.mojang.brigadier.arguments.ArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import java.util.OptionalLong;

public final class AmountArgumentType implements CustomArgumentType.Converted<Long, String> {
    @Override
    public Long convert(String nativeType) throws CommandSyntaxException {
        OptionalLong parsed = Amounts.parse(nativeType);   // 1.5k -> 1500
        if (parsed.isEmpty()) {
            throw CommandSupport.error("<red>Invalid amount <input>.", Placeholder.unparsed("input", nativeType));
        }
        return parsed.getAsLong();
    }
    @Override
    public ArgumentType<String> getNativeType() { return StringArgumentType.word(); }
}
```

---

## 規則

- 權限用 `getSender()` 檢查，針對自己的操作用 `getExecutor()`
- 成功回 `Command.SINGLE_SUCCESS`；失敗 `throw` 指令例外，不要回 `0` 再自己印訊息
- 玩家輸入進 MiniMessage 一律用 `Placeholder.unparsed`
- 權限在 `plugin.yml` 的 `permissions:` 宣告並給明確 default；使用 Brigadier 時不寫 `commands:`
- `paper-plugin.yml` 沒有 `commands:`；bootstrap 註冊用 `PluginBootstrap#bootstrap` + `LifecycleEvents.COMMANDS`

---

## 執行緒安全

- `executes` 在主執行緒；耗時工作自行丟非同步並回主執行緒回覆
- `suggests` 不保證在主執行緒：只讀不可變快照，不查資料庫、不走訪可變集合
