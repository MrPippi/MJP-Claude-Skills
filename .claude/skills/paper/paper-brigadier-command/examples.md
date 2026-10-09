# examples — paper-brigadier-command

## 範例 1：`/pay <player> <amount>`（k/m/b 金額）

**Input:**
```
root_literal: pay
arguments: target:player, amount:k/m/b
permission: example.pay
aliases: transfer
```

**Output — 金額解析結果（`Amounts.parse`）:**

| 輸入 | 結果 |
|------|------|
| `100` | 100 |
| `1.5k` | 1500 |
| `2m` | 2000000 |
| `1b` | 1000000000 |
| `1.0001k` | 錯誤（不是整數） |
| `0`、`-5`、`k`、`1e5` | 錯誤 |
| `99999999999b` | 錯誤（超出 long） |

**Output — 以記憶體帳本實作 `PayService`（主執行緒呼叫）:**
```java
import com.example.command.PayService;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** 示範用；實務上換成 Repository。只在主執行緒使用，所以不需要鎖。 */
public final class InMemoryPayService implements PayService {

    private final Map<UUID, Long> balances = new HashMap<>();

    public void deposit(UUID player, long amount) {
        balances.merge(player, amount, Long::sum);
    }

    @Override
    public Result pay(UUID from, UUID to, long amount) {
        if (from.equals(to)) {
            return Result.SELF;
        }
        long current = balances.getOrDefault(from, 0L);
        if (current < amount) {
            return Result.INSUFFICIENT;
        }
        balances.put(from, current - amount);
        balances.merge(to, amount, Long::sum);
        return Result.OK;
    }
}
```

玩家在聊天欄輸入 `/pay Steve 1.5kk` 時看到：`Invalid amount 1.5kk. Use a positive whole number, optionally with k, m or b (for example 1.5k).`

---

## 範例 2：管理員 `/eco give|take|set <players> <amount>`

**Input:**
```
root_literal: eco
arguments: players:players, amount:k/m/b
permission: example.admin
```

**Output — 三個子指令共用同一個建構方法，`players()` 可一次選多位（`@a`、`Steve`）:**
```java
import com.example.command.AmountArgumentType;
import com.example.command.CommandSupport;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
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
import java.util.UUID;

public final class EcoCommand {

    /** 帳本介面；回傳 false 代表該玩家沒有變動（例如 take 餘額不足）。 */
    public interface Ledger {
        boolean give(UUID player, long amount);
        boolean take(UUID player, long amount);
        boolean set(UUID player, long amount);
    }

    private interface Operation {
        boolean apply(UUID player, long amount);
    }

    private final Ledger ledger;

    public EcoCommand(Ledger ledger) {
        this.ledger = ledger;
    }

    public LiteralCommandNode<CommandSourceStack> build() {
        return Commands.literal("eco")
            .requires(CommandSupport.permission("example.admin"))
            .then(operation("give", ledger::give))
            .then(operation("take", ledger::take))
            .then(operation("set", ledger::set))
            .build();
    }

    private LiteralArgumentBuilder<CommandSourceStack> operation(String name, Operation operation) {
        return Commands.literal(name)
            .then(Commands.argument("players", ArgumentTypes.players())
                .then(Commands.argument("amount", new AmountArgumentType())
                    .executes(context -> run(context, name, operation))));
    }

    private int run(CommandContext<CommandSourceStack> context, String name, Operation operation)
        throws CommandSyntaxException {
        CommandSourceStack source = context.getSource();
        List<Player> targets = context.getArgument("players", PlayerSelectorArgumentResolver.class).resolve(source);
        long amount = context.getArgument("amount", Long.class);

        int changed = 0;
        for (Player target : targets) {
            if (operation.apply(target.getUniqueId(), amount)) {
                changed++;
            }
        }
        CommandSupport.send(source.getSender(), "<green>/eco <action>: changed <count> of <total> player(s).",
            Placeholder.unparsed("action", name),
            Placeholder.unparsed("count", String.valueOf(changed)),
            Placeholder.unparsed("total", String.valueOf(targets.size())));
        // 管理指令回傳「實際變動人數」，/execute store 可以直接使用；一般指令回 Command.SINGLE_SUCCESS
        return changed;
    }
}
```

**Output — 在 `onEnable` 註冊（`EcoCommand` 的註冊方式與 `PayCommand` 相同，`registrar.register(eco.build(), "Economy admin")`）:**
```java
import com.example.command.ExampleCommand;
import com.example.command.PayCommand;
import com.example.command.PayService;
import io.papermc.paper.command.brigadier.Commands;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;
import org.bukkit.plugin.java.JavaPlugin;

public final class EcoPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        PayCommand pay = new PayCommand((from, to, amount) -> PayService.Result.OK);
        ExampleCommand example = new ExampleCommand(this::reloadConfig);
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> {
            Commands registrar = event.registrar();
            registrar.register(pay.build(), "Pay another player");
            registrar.register(example.build(), "Example plugin command");
        });
    }
}
```

---

## 範例 3：離線玩家名補全與主控台可用的 `/balance [name]`

**Input:**
```
root_literal: balance
arguments: name:string (optional, offline players allowed)
```

**Output — 名稱快照由 join／帳本載入時更新，補全只讀快照；沒有參數時才要求玩家身分:**
```java
import com.example.command.CommandSupport;
import com.mojang.brigadier.Command;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.tree.LiteralCommandNode;
import io.papermc.paper.command.brigadier.CommandSourceStack;
import io.papermc.paper.command.brigadier.Commands;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.Collection;
import java.util.Optional;
import java.util.Set;

public final class BalanceCommand {

    /** 帳本查詢；{@code names()} 必須回傳不可變快照，可在任何執行緒讀取。 */
    public interface Accounts {
        Collection<String> names();
        Optional<Long> balanceOf(String name);
        Optional<Long> balanceOf(java.util.UUID id);
    }

    private final Accounts accounts;

    public BalanceCommand(Accounts accounts) {
        this.accounts = accounts;
    }

    public LiteralCommandNode<CommandSourceStack> build() {
        return Commands.literal("balance")
            .requires(CommandSupport.permission("example.use"))
            // 自己的餘額：必須是玩家（/execute as <玩家> 時 executor 是該玩家）
            .executes(context -> {
                Player self = CommandSupport.requirePlayer(context.getSource());
                String text = accounts.balanceOf(self.getUniqueId()).map(String::valueOf).orElse("0");
                CommandSupport.send(self, "<gray>Balance: <white><amount></white>", Placeholder.unparsed("amount", text));
                return Command.SINGLE_SUCCESS;
            })
            // 查別人：主控台與玩家都可以，所以回覆給 getSender()
            .then(Commands.argument("name", StringArgumentType.word())
                .suggests((context, builder) -> CommandSupport.suggest(accounts.names(), builder))
                .executes(context -> {
                    CommandSender sender = context.getSource().getSender();
                    String name = StringArgumentType.getString(context, "name");
                    Optional<Long> balance = accounts.balanceOf(name);
                    if (balance.isEmpty()) {
                        throw CommandSupport.error("<red>No account found for <name>.",
                            Placeholder.unparsed("name", name));
                    }
                    CommandSupport.send(sender, "<gray><name>: <white><amount></white>",
                        Placeholder.unparsed("name", name),
                        Placeholder.unparsed("amount", String.valueOf(balance.get())));
                    return Command.SINGLE_SUCCESS;
                }))
            .build();
    }

    /** 快照建立範例：寫入端複製成不可變集合後整個換掉，讀取端（補全）永遠看到完整的一份。 */
    public static Set<String> snapshotOf(Collection<String> names) {
        return Set.copyOf(names);
    }
}
```
