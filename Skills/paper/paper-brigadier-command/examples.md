# examples — paper-brigadier-command

## Example 1: `/pay <player> <amount>` (k/m/b amounts)

**Input:**
```
root_literal: pay
arguments: target:player, amount:k/m/b
permission: example.pay
aliases: transfer
```

**Output — amount parsing results (`Amounts.parse`):**

| Input | Result |
|------|------|
| `100` | 100 |
| `1.5k` | 1500 |
| `2m` | 2000000 |
| `1b` | 1000000000 |
| `1.0001k` | Error (not a whole number) |
| `0`, `-5`, `k`, `1e5` | Error |
| `99999999999b` | Error (exceeds long) |

**Output — `PayService` implemented with an in-memory ledger (called on the main thread):**
```java
import com.example.command.PayService;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** For demonstration; use a Repository in practice. Used only on the main thread, so no locking is needed. */
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

When a player types `/pay Steve 1.5kk` in chat, they see:`Invalid amount 1.5kk. Use a positive whole number, optionally with k, m or b (for example 1.5k).`

---

## Example 2: Admin `/eco give|take|set <players> <amount>`

**Input:**
```
root_literal: eco
arguments: players:players, amount:k/m/b
permission: example.admin
```

**Output — the three subcommands share one builder method, and `players()` can select several players at once (`@a`, `Steve`):**
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

    /** Ledger interface; returning false means that player was not changed (for example take with an insufficient balance). */
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
        // Admin commands return the number of players actually changed, which /execute store can use directly; regular commands return Command.SINGLE_SUCCESS
        return changed;
    }
}
```

**Output — register in `onEnable` (`EcoCommand` registers the same way as `PayCommand`: `registrar.register(eco.build(), "Economy admin")`):**
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

## Example 3: Offline-Player Name Completion and a Console-Friendly `/balance [name]`

**Input:**
```
root_literal: balance
arguments: name:string (optional, offline players allowed)
```

**Output — the name snapshot is refreshed on join / ledger load, completion only reads the snapshot, and a player identity is required only when no argument is given:**
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

    /** Ledger lookup; {@code names()} must return an immutable snapshot that can be read from any thread. */
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
            // Own balance: must be a player (with /execute as <player> the executor is that player)
            .executes(context -> {
                Player self = CommandSupport.requirePlayer(context.getSource());
                String text = accounts.balanceOf(self.getUniqueId()).map(String::valueOf).orElse("0");
                CommandSupport.send(self, "<gray>Balance: <white><amount></white>", Placeholder.unparsed("amount", text));
                return Command.SINGLE_SUCCESS;
            })
            // Looking up someone else: both the console and players may do it, so reply to getSender()
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

    /** Snapshot-building example: the writer copies into an immutable collection and swaps the whole thing, so readers (completion) always see a complete copy. */
    public static Set<String> snapshotOf(Collection<String> names) {
        return Set.copyOf(names);
    }
}
```
