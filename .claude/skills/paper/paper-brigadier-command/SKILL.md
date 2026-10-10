---
name: paper-brigadier-command
description: "以 Paper Brigadier API 註冊指令：LifecycleEvents.COMMANDS、內建 ArgumentTypes、k/m/b 金額自訂參數、權限 requires、補全只讀快照、玩家／主控台處理與 reload 子指令 / Paper Brigadier commands with built-in and custom argument types, permission gates, snapshot-only suggestions and a reload subcommand"
---

# Paper Brigadier Command / Paper Brigadier 指令

## 技能名稱 / Skill Name

`paper-brigadier-command`

## 目的 / Purpose

用 Paper 的 Brigadier 指令 API 註冊「有型別參數、有補全、有分層權限」的指令：玩家選擇器（`@p`、玩家名）、世界、物品、座標等內建參數由伺服器解析並補全；自訂參數（例如接受 `1.5k` / `2m` / `1b` 的金額）解析失敗時回傳清楚的錯誤訊息，而不是丟例外。

**不是所有指令都需要 Brigadier。** 沒有參數補全需求的簡單指令留在 `plugin.yml` 的 `commands:` + `getCommand("x").setExecutor(...)` 即可。**同一個指令名稱不可同時用兩種方式宣告**（會互相覆蓋或行為不明）。

## Paper 版本需求 / Paper Version Requirements

- Paper 1.21.11 / 26.2（兩版皆經編譯驗證；範本預設 26.2，差異以 `// @1.21.11:` 行尾標註）
- 純 Paper API（Brigadier 類別隨 `paper-api` 提供），不需要 Paperweight
- 唯一差異：`CommandSourceStack#getPlayerOrThrow()` 只存在於 26.2；1.21.11 改用 `getExecutor()` 自行判斷
- 其餘 `Commands`、`ArgumentTypes`、`CustomArgumentType`、`MessageComponentSerializer`、`LifecycleEvents.COMMANDS` 兩版簽名相同

## 觸發條件 / Triggers

- 「Brigadier」「指令補全」「tab completion」「指令參數」「自訂參數型別」
- 「LifecycleEvents.COMMANDS」「Commands.literal」「CommandSourceStack」
- 「/pay 金額 k m b」「金額縮寫」「子指令」「reload 指令」
- 「getCommand 還是 Brigadier」「paper-plugin.yml 指令」

## 輸入參數 / Inputs

| 參數 | 範例 | 說明 |
|------|------|------|
| `command_package` | `com.example.command` | 指令類別所在 package |
| `root_literal` | `pay` | 根指令名稱 |
| `arguments` | `target:player`, `amount:k/m/b` | 參數名稱與型別 |
| `permission` | `example.pay` | 使用權限節點（宣告在 plugin.yml） |
| `aliases` | `transfer` | 別名（可空） |
| `registration` | `onEnable` ／ `bootstrap` | 註冊位置 |

## 輸出產物 / Outputs

- `CommandSupport.java` — 權限 predicate、玩家檢查、MiniMessage 訊息、錯誤例外、快照補全
- `Amounts.java` — 純函式：解析 `1.5k` / `2m` / `1b`
- `AmountArgumentType.java` — 自訂 Brigadier 參數（`CustomArgumentType.Converted`）
- `PayService.java` — 付款服務介面（由專案自行實作）
- `PayCommand.java` — `/pay <player> <amount>`
- `ExampleCommand.java` — 含 `reload` 子指令的根指令
- `ExamplePlugin.java` — `onEnable` 註冊
- `ExampleBootstrap.java` — （額外）`paper-plugin.yml` bootstrap 註冊

## 建置設定 / Build Setup

見 [`references/paper-api-platform.md`](references/paper-api-platform.md)。只需要 `paper-api`，不需額外依賴。

### `plugin.yml`（預設做法，指令走 Brigadier 時**不要**寫 `commands:`）

```yaml
name: Example
version: '${version}'
main: com.example.command.ExamplePlugin
api-version: '26.2'

# 不宣告 commands:；指令由 LifecycleEvents.COMMANDS 註冊。
# 權限一律在此宣告並給明確 default，伺服器管理員才看得到、也才能用權限插件調整。
permissions:
  example.pay:
    description: Use /pay
    default: true
  example.use:
    description: Use /example
    default: true
  example.admin:
    description: Use admin subcommands such as /example reload
    default: op
```

### `paper-plugin.yml`（額外：改用 bootstrap 註冊時）

```yaml
name: Example
version: '${version}'
main: com.example.command.ExamplePlugin
bootstrapper: com.example.command.ExampleBootstrap
api-version: '26.2'
```

- `paper-plugin.yml` **沒有** `commands:` 區段，指令只能走 Brigadier
- `plugin.yml` 與 `paper-plugin.yml` 不要並存
- 權限節點請在你的伺服器版本確認 `paper-plugin.yml` 的宣告是否支援；不確定時改在 `onEnable` 用 `PluginManager#addPermission` 註冊

## 代碼範本 / Code Template

### `CommandSupport.java`

```java
package com.example.command;

import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.exceptions.SimpleCommandExceptionType;
import com.mojang.brigadier.suggestion.Suggestions;
import com.mojang.brigadier.suggestion.SuggestionsBuilder;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.MessageComponentSerializer;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.Collection;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.function.Predicate;

/** 指令共用工具。全部是無狀態的靜態方法。 */
public final class CommandSupport {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private CommandSupport() {}

    /**
     * 權限門檻，給 {@code .requires(...)} 用。
     * 一律檢查 {@code getSender()}（真正下指令的人），不要檢查 {@code getExecutor()}：
     * {@code /execute as <別人> run ...} 時 executor 是被代表的實體，不是有權限的人。
     */
    public static Predicate<CommandSourceStack> permission(String node) {
        return source -> source.getSender().hasPermission(node);
    }

    /**
     * 取得「以玩家身分執行」的玩家；主控台或非玩家實體會得到一則清楚的錯誤。
     * 這個方法會被 {@code executes} 呼叫，執行緒為主執行緒。
     */
    public static Player requirePlayer(CommandSourceStack source) throws CommandSyntaxException {
        Player player = source.getPlayerOrThrow(); // @1.21.11: Player player = source.getExecutor() instanceof Player p ? p : null;
        if (player == null) {
            throw error("<red>This command can only be used by a player.");
        }
        return player;
    }

    /** 傳送 MiniMessage 訊息；玩家輸入的內容一律用 {@code Placeholder.unparsed} 傳入，不要拼進 template。 */
    public static void send(CommandSender target, String template, TagResolver... resolvers) {
        target.sendMessage(MINI.deserialize(template, resolvers));
    }

    /** 建立會顯示在聊天欄（紅字）的指令錯誤；參數解析失敗與 executes 中途失敗都用它 throw。 */
    public static CommandSyntaxException error(String template, TagResolver... resolvers) {
        return new SimpleCommandExceptionType(
            MessageComponentSerializer.message().serialize(MINI.deserialize(template, resolvers))
        ).create();
    }

    /**
     * 以「快照」補全。{@code snapshot} 必須是不可變集合（例如 {@code Set.copyOf(...)}）：
     * 補全可能不在主執行緒被呼叫，不可在這裡走訪 Bukkit 的可變集合或查資料庫。
     */
    public static CompletableFuture<Suggestions> suggest(Collection<String> snapshot, SuggestionsBuilder builder) {
        String typed = builder.getRemaining().toLowerCase(Locale.ROOT);
        for (String candidate : snapshot) {
            if (candidate.toLowerCase(Locale.ROOT).startsWith(typed)) {
                builder.suggest(candidate);
            }
        }
        return builder.buildFuture();
    }
}
```

### `Amounts.java`

```java
package com.example.command;

import java.math.BigDecimal;
import java.util.Locale;
import java.util.Map;
import java.util.OptionalLong;
import java.util.regex.Pattern;

/** 解析 {@code 100}、{@code 1.5k}、{@code 2m}、{@code 1b}。純函式，可直接單元測試。 */
public final class Amounts {

    private static final Pattern NUMBER = Pattern.compile("\\d+(\\.\\d+)?");
    private static final Map<Character, BigDecimal> SUFFIXES = Map.of(
        'k', BigDecimal.valueOf(1_000L),
        'm', BigDecimal.valueOf(1_000_000L),
        'b', BigDecimal.valueOf(1_000_000_000L)
    );

    private Amounts() {}

    /**
     * 回傳正整數金額；格式錯誤、非正數、不是整數（例如 {@code 1.0001k}）或超出 long 範圍時回 empty，
     * 由呼叫端轉成使用者看得懂的錯誤訊息。
     */
    public static OptionalLong parse(String text) {
        String normalized = text.strip().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return OptionalLong.empty();
        }
        BigDecimal multiplier = BigDecimal.ONE;
        BigDecimal suffix = SUFFIXES.get(normalized.charAt(normalized.length() - 1));
        if (suffix != null) {
            multiplier = suffix;
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        if (!NUMBER.matcher(normalized).matches()) {
            return OptionalLong.empty();
        }
        BigDecimal value = new BigDecimal(normalized).multiply(multiplier);
        if (value.signum() <= 0) {
            return OptionalLong.empty();
        }
        try {
            return OptionalLong.of(value.longValueExact());
        } catch (ArithmeticException notIntegralOrTooLarge) {
            return OptionalLong.empty();
        }
    }
}
```

### `AmountArgumentType.java`

```java
package com.example.command;

import com.mojang.brigadier.arguments.ArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.suggestion.Suggestions;
import com.mojang.brigadier.suggestion.SuggestionsBuilder;
import io.papermc.paper.command.brigadier.argument.CustomArgumentType;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;

import java.util.Collection;
import java.util.List;
import java.util.OptionalLong;
import java.util.concurrent.CompletableFuture;

/**
 * 金額參數：接受 {@code 100}、{@code 1.5k}、{@code 2m}、{@code 1b}，解析成 {@code long}。
 *
 * <p>底層用 {@code StringArgumentType.word()} 傳給客戶端，所以原版客戶端不需要任何模組也能連線。
 * 取值：{@code ctx.getArgument("amount", Long.class)}。
 */
public final class AmountArgumentType implements CustomArgumentType.Converted<Long, String> {

    private static final List<String> SUFFIXES = List.of("k", "m", "b");

    @Override
    public Long convert(String nativeType) throws CommandSyntaxException {
        OptionalLong parsed = Amounts.parse(nativeType);
        if (parsed.isEmpty()) {
            throw CommandSupport.error(
                "<red>Invalid amount <input>. Use a positive whole number, optionally with k, m or b (for example 1.5k).",
                Placeholder.unparsed("input", nativeType)
            );
        }
        return parsed.getAsLong();
    }

    @Override
    public ArgumentType<String> getNativeType() {
        return StringArgumentType.word();
    }

    @Override
    public Collection<String> getExamples() {
        return List.of("100", "1.5k", "2m", "1b");
    }

    /** 已輸入純數字時補上 k / m / b。只看輸入字串，不碰任何外部狀態。 */
    @Override
    public <S> CompletableFuture<Suggestions> listSuggestions(CommandContext<S> context, SuggestionsBuilder builder) {
        String typed = builder.getRemaining();
        if (typed.matches("\\d+(\\.\\d+)?")) {
            for (String suffix : SUFFIXES) {
                builder.suggest(typed + suffix);
            }
        }
        return builder.buildFuture();
    }
}
```

### `PayService.java`

```java
package com.example.command;

import java.util.UUID;

/** 付款服務；由專案提供實作（資料庫、Vault、ServicesManager 皆可）。呼叫端保證在主執行緒。 */
public interface PayService {

    enum Result { OK, INSUFFICIENT, SELF }

    Result pay(UUID from, UUID to, long amount);
}
```

### `PayCommand.java`

```java
package com.example.command;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import com.mojang.brigadier.tree.LiteralCommandNode;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import io.papermc.paper.command.brigadier.argument.ArgumentTypes;
import io.papermc.paper.command.brigadier.argument.resolvers.selector.PlayerSelectorArgumentResolver;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.entity.Player;

import java.util.List;

/** {@code /pay <player> <amount>}：目標用內建玩家選擇器，金額用自訂 k/m/b 參數。 */
public final class PayCommand {

    public static final String PERMISSION = "example.pay";

    private static final String ARG_TARGET = "target";
    private static final String ARG_AMOUNT = "amount";

    private final PayService pay;

    public PayCommand(PayService pay) {
        this.pay = pay;
    }

    public LiteralCommandNode<CommandSourceStack> build() {
        return Commands.literal("pay")
            .requires(CommandSupport.permission(PERMISSION))
            .then(Commands.argument(ARG_TARGET, ArgumentTypes.player())
                .then(Commands.argument(ARG_AMOUNT, new AmountArgumentType())
                    .executes(this::execute)))
            .build();
    }

    private int execute(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
        CommandSourceStack source = context.getSource();
        Player from = CommandSupport.requirePlayer(source);

        // 選擇器要用「來源」解析（@p、@s 才有意義）；player() 保證恰好一位，查無玩家時伺服器已回報錯誤
        List<Player> matches = context.getArgument(ARG_TARGET, PlayerSelectorArgumentResolver.class).resolve(source);
        Player to = matches.get(0);
        long amount = context.getArgument(ARG_AMOUNT, Long.class);

        PayService.Result result = pay.pay(from.getUniqueId(), to.getUniqueId(), amount);
        switch (result) {
            case OK -> {
                CommandSupport.send(from, "<green>You paid <white><amount></white> to <white><player></white>.",
                    Placeholder.unparsed("amount", String.valueOf(amount)),
                    Placeholder.unparsed("player", to.getName()));
                CommandSupport.send(to, "<green><player> paid you <white><amount></white>.",
                    Placeholder.unparsed("amount", String.valueOf(amount)),
                    Placeholder.unparsed("player", from.getName()));
            }
            case INSUFFICIENT -> CommandSupport.send(from, "<red>You do not have enough money.");
            case SELF -> CommandSupport.send(from, "<red>You cannot pay yourself.");
        }
        return Command.SINGLE_SUCCESS;
    }
}
```

### `ExampleCommand.java`

```java
package com.example.command;

import com.mojang.brigadier.Command;
import com.mojang.brigadier.tree.LiteralCommandNode;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;

/** {@code /example}（資訊）與 {@code /example reload}（需要 admin 權限）。 */
public final class ExampleCommand {

    public static final String PERMISSION_USE = "example.use";
    public static final String PERMISSION_ADMIN = "example.admin";

    private final Runnable reload;

    /** @param reload 重載動作；在主執行緒被呼叫，失敗請自行處理並記錄，不要讓例外傳出指令 */
    public ExampleCommand(Runnable reload) {
        this.reload = reload;
    }

    public LiteralCommandNode<CommandSourceStack> build() {
        return Commands.literal("example")
            .requires(CommandSupport.permission(PERMISSION_USE))
            .executes(context -> {
                CommandSupport.send(context.getSource().getSender(),
                    "<gray>Example plugin. Use <white>/example reload</white> to reload.");
                return Command.SINGLE_SUCCESS;
            })
            .then(Commands.literal("reload")
                // 子節點的 requires 與父節點是「且」的關係：兩者都通過才看得到、才執行得了
                .requires(CommandSupport.permission(PERMISSION_ADMIN))
                .executes(context -> {
                    reload.run();
                    CommandSupport.send(context.getSource().getSender(), "<green>Configuration reloaded.");
                    return Command.SINGLE_SUCCESS;
                }))
            .build();
    }
}
```

### `ExamplePlugin.java`

```java
package com.example.command;

import io.papermc.paper.command.brigadier.Commands;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import org.bukkit.plugin.java.JavaPlugin;

import java.util.List;

public final class ExamplePlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        saveDefaultConfig();

        // 示範用服務：實務上換成真正的實作（建構子注入，不要用靜態單例）
        PayService payService = (from, to, amount) ->
            from.equals(to) ? PayService.Result.SELF : PayService.Result.OK;
        PayCommand pay = new PayCommand(payService);
        ExampleCommand example = new ExampleCommand(this::reloadConfig);

        // 在 COMMANDS 事件裡才 register：伺服器 /reload 時會重新觸發這個事件
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> {
            Commands registrar = event.registrar();
            registrar.register(pay.build(), "Pay another player", List.of("transfer"));
            registrar.register(example.build(), "Example plugin command");
        });
    }
}
```

### `ExampleBootstrap.java`（額外：`paper-plugin.yml` 的 bootstrap 註冊）

```java
package com.example.command;

import io.papermc.paper.plugin.bootstrap.BootstrapContext;
import io.papermc.paper.plugin.bootstrap.PluginBootstrap;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;

/**
 * 在 bootstrap 階段註冊指令（插件主類別尚未建立）。
 *
 * <p>限制：此時沒有 JavaPlugin 實例，指令不能直接用 plugin 的 logger／scheduler／config。
 * 需要時改用 {@code context.getLogger()}、{@code context.getDataDirectory()}，或在 executes 執行時才取得服務。
 * 與 {@code ExamplePlugin} 的 onEnable 註冊擇一，不可兩邊都註冊同一個指令。
 */
public final class ExampleBootstrap implements PluginBootstrap {

    @Override
    public void bootstrap(BootstrapContext context) {
        context.getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event ->
            event.registrar().register(new ExampleCommand(() -> { }).build(), "Example plugin command")
        );
    }
}
```

## 推薦目錄結構 / Recommended Directory Structure

```
src/main/java/com/example/command/
├── ExamplePlugin.java        ← onEnable 註冊（或 ExampleBootstrap）
├── CommandSupport.java       ← 權限、訊息、錯誤、快照補全
├── Amounts.java              ← 純函式，可單元測試
├── AmountArgumentType.java   ← 自訂參數
├── PayCommand.java           ← 一個指令一個類別，build() 回傳 LiteralCommandNode
├── PayService.java           ← 業務邏輯介面（指令類別只負責解析與回覆）
└── ExampleCommand.java
src/main/resources/
└── plugin.yml                ← 只有 permissions，沒有 commands:
```

## 規則重點 / Key Rules

| 主題 | 做法 |
|------|------|
| 註冊位置 | `getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> event.registrar().register(node, description, aliases))`；不要在事件外直接註冊 |
| `register` 簽名 | `register(node)`、`register(node, description)`、`register(node, aliases)`、`register(node, description, aliases)`；別名是 `Collection<String>` |
| 參數解析 | 內建 `ArgumentTypes.player()`／`players()`／`world()`／`itemStack()`／`finePosition()`…；選擇器與座標回傳的是 **Resolver**，要在 `executes` 裡 `resolve(source)` 才有值（結果依來源位置而定） |
| 取參數 | `context.getArgument("name", Type.class)`；名稱與 `Commands.argument` 的字串一致，建議抽成常數 |
| 權限 | `.requires(source -> source.getSender().hasPermission(node))`；同時決定該指令是否出現在客戶端補全 |
| 回傳值 | 成功回 `Command.SINGLE_SUCCESS`（`1`）；失敗用 `throw CommandSupport.error(...)`，不要回 `0` 後又自己印訊息 |
| 失敗訊息 | `SimpleCommandExceptionType` + `MessageComponentSerializer.message().serialize(component)`，玩家在聊天欄看到紅字 |
| 玩家輸入進訊息 | `Placeholder.unparsed(...)`；不可拼進 MiniMessage template（避免標籤注入） |
| 補全 | 只讀不可變快照（`Set.copyOf` / `volatile` 快照），不在補全裡查資料庫或走訪 Bukkit 可變集合 |

## 玩家與主控台 / Sender Handling

- `getSender()`：真正輸入指令的人／主控台／command block；**權限檢查與回覆訊息用它**
- `getExecutor()`：指令「代表」的實體（`/execute as <entity> run ...` 時是那個實體）；沒有時可能為 `null`；**針對自己的操作（扣自己的錢、傳送自己）用它**
- 需要玩家：`CommandSupport.requirePlayer(source)`（26.2 內部呼叫 `getPlayerOrThrow()`，1.21.11 自行判斷 `getExecutor()`）
- 主控台可用的指令（例如 `reload`）不要呼叫 `requirePlayer`，直接對 `getSender()` 回覆

## 執行緒安全注意事項 / Thread Safety

- `executes` 在**主執行緒**執行，可呼叫 Bukkit API；耗時工作（資料庫、HTTP）請自行丟到非同步，完成後回主執行緒回覆並重新驗證玩家仍在線
- `suggests` / `listSuggestions` **不保證在主執行緒**：只讀不可變快照，不呼叫 Bukkit 世界／實體 API
- `requires` 會在建立客戶端指令樹時被呼叫，也要保持輕量、無副作用
- 詳見 [`references/paper-threading.md`](references/paper-threading.md)

## 何時不要用 Brigadier / When NOT to Use

- 指令沒有參數或只有少數固定字串、不需要補全 → `plugin.yml` 的 `commands:` + `getCommand("x").setExecutor(...)` 更簡單
- 想沿用既有 `CommandExecutor` / `TabCompleter` 程式碼，且沒有升級需求 → 維持原樣
- **同一個指令名稱只能擇一**：Brigadier 與 `plugin.yml commands:` 同名並存會造成行為不明

## 失敗回退 / Fallback

| 錯誤 | 原因 | 解法 |
|------|------|------|
| 指令不存在／`Unknown command` | 沒在 `COMMANDS` 事件裡註冊，或事件處理器丟了例外 | 確認在 `registerEventHandler(LifecycleEvents.COMMANDS, ...)` 內 register，查看 console 啟動錯誤 |
| `plugin.yml` 的 `commands:` 與 Brigadier 衝突 | 同名重複宣告 | 擇一；Brigadier 版就刪掉 `commands:` 與 `getCommand()` |
| 取玩家參數得到 `ClassCastException` | 參數取成 `Player` 而非 Resolver | 取 `PlayerSelectorArgumentResolver.class` 後呼叫 `resolve(source)` |
| 補全偶發 `ConcurrentModificationException` | 補全在非主執行緒走訪可變集合 | 改用不可變快照 |
| 子指令沒有權限卻出現在補全 | 子節點沒有 `requires` | 每個需要權限的節點各自 `.requires(...)` |
| `/execute as` 後權限判斷怪異 | 用 `getExecutor()` 做權限檢查 | 權限用 `getSender()`，對象用 `getExecutor()` |
| 26.2 編譯過、1.21.11 找不到 `getPlayerOrThrow` | 該方法只在 26.2 | 照 `CommandSupport.requirePlayer` 的 `// @1.21.11:` 寫法 |
| `paper-plugin.yml` 載入失敗 | 仍寫了 `commands:` | 移除；指令全部走 Brigadier |
