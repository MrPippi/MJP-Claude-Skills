---
name: paper-brigadier-command
description: "以 Paper Brigadier API 註冊指令：LifecycleEvents.COMMANDS、內建 ArgumentTypes、k/m/b 金額自訂參數、權限 requires、補全只讀快照、玩家／主控台處理與 reload 子指令 / Paper Brigadier commands with built-in and custom argument types, permission gates, snapshot-only suggestions and a reload subcommand"
---

# Paper Brigadier Command

## Skill Name

`paper-brigadier-command`

## Purpose

Register commands with typed arguments, tab completion, and layered permissions using Paper's Brigadier command API: built-in arguments such as player selectors (`@p`, player names), worlds, items, and positions are parsed and completed by the server; custom arguments (for example an amount accepting `1.5k` / `2m` / `1b`) return a clear error message on parse failure instead of throwing.

**Not every command needs Brigadier.** Simple commands without tab-completion needs can stay in `plugin.yml` `commands:` + `getCommand("x").setExecutor(...)`. **Never declare the same command name both ways** (they override each other or behave unpredictably).

## Paper Version Requirements

- Paper 1.21.11 / 26.2 (both compile-verified; the templates default to 26.2, with differences marked by a trailing `// @1.21.11:`)
- Pure Paper API (the Brigadier classes ship with `paper-api`), no Paperweight needed
- The only difference: `CommandSourceStack#getPlayerOrThrow()` exists only on 26.2; on 1.21.11 check `getExecutor()` yourself
- The remaining `Commands`, `ArgumentTypes`, `CustomArgumentType`, `MessageComponentSerializer`, and `LifecycleEvents.COMMANDS` signatures are identical on both versions

## Triggers

- 「Brigadier」「指令補全」「tab completion」「指令參數」「自訂參數型別」
- 「LifecycleEvents.COMMANDS」「Commands.literal」「CommandSourceStack」
- 「/pay 金額 k m b」「金額縮寫」「子指令」「reload 指令」
- 「getCommand 還是 Brigadier」「paper-plugin.yml 指令」

## Inputs

| Parameter | Example | Description |
|------|------|------|
| `command_package` | `com.example.command` | Package of the command classes |
| `root_literal` | `pay` | Root command name |
| `arguments` | `target:player`, `amount:k/m/b` | Argument names and types |
| `permission` | `example.pay` | Permission node to use it (declared in plugin.yml) |
| `aliases` | `transfer` | Aliases (may be empty) |
| `registration` | `onEnable` / `bootstrap` | Where to register |

## Outputs

- `CommandSupport.java` - permission predicate, player check, MiniMessage messages, error exceptions, snapshot completion
- `Amounts.java` - pure function: parses `1.5k` / `2m` / `1b`
- `AmountArgumentType.java` - custom Brigadier argument (`CustomArgumentType.Converted`)
- `PayService.java` - payment service interface (implemented by the project)
- `PayCommand.java` — `/pay <player> <amount>`
- `ExampleCommand.java` - root command with a `reload` subcommand
- `ExamplePlugin.java` - registers in `onEnable`
- `ExampleBootstrap.java` - (extra) `paper-plugin.yml` bootstrap registration

## Build Setup

See [`references/paper-api-platform.md`](references/paper-api-platform.md). Only `paper-api` is required, with no extra dependencies.

### `plugin.yml` (default approach; do **not** write `commands:` when commands go through Brigadier)

```yaml
name: Example
version: '${version}'
main: com.example.command.ExamplePlugin
api-version: '26.2'

# Do not declare commands:; commands are registered via LifecycleEvents.COMMANDS.
# Always declare permissions here with an explicit default so server admins can see them and adjust them with a permissions plugin.
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

### `paper-plugin.yml` (extra: when registering from bootstrap)

```yaml
name: Example
version: '${version}'
main: com.example.command.ExamplePlugin
bootstrapper: com.example.command.ExampleBootstrap
api-version: '26.2'
```

- `paper-plugin.yml` has **no** `commands:` section; commands can only go through Brigadier
- Do not keep `plugin.yml` and `paper-plugin.yml` side by side
- Check on your server version whether `paper-plugin.yml` supports permission declarations; if unsure, register them in `onEnable` with `PluginManager#addPermission`

## Code Template

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

/** Shared command utilities. All stateless static methods. */
public final class CommandSupport {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private CommandSupport() {}

    /**
     * Permission gate for {@code .requires(...)}.
     * Always check {@code getSender()} (whoever actually issued the command), never {@code getExecutor()}:
     * with {@code /execute as <someone> run ...} the executor is the entity being represented, not the person holding the permission.
     */
    public static Predicate<CommandSourceStack> permission(String node) {
        return source -> source.getSender().hasPermission(node);
    }

    /**
     * Returns the player the command runs as; the console or a non-player entity gets a clear error.
     * This method is called from {@code executes}, which runs on the main thread.
     */
    public static Player requirePlayer(CommandSourceStack source) throws CommandSyntaxException {
        Player player = source.getPlayerOrThrow(); // @1.21.11: Player player = source.getExecutor() instanceof Player p ? p : null;
        if (player == null) {
            throw error("<red>This command can only be used by a player.");
        }
        return player;
    }

    /** Sends a MiniMessage message; always pass player input through {@code Placeholder.unparsed}, never concatenate it into the template. */
    public static void send(CommandSender target, String template, TagResolver... resolvers) {
        target.sendMessage(MINI.deserialize(template, resolvers));
    }

    /** Builds a command error shown in chat (red text); throw it for both argument parse failures and mid-executes failures. */
    public static CommandSyntaxException error(String template, TagResolver... resolvers) {
        return new SimpleCommandExceptionType(
            MessageComponentSerializer.message().serialize(MINI.deserialize(template, resolvers))
        ).create();
    }

    /**
     * Completes from a snapshot. {@code snapshot} must be an immutable collection (for example {@code Set.copyOf(...)}):
     * completion may be called off the main thread, so never iterate mutable Bukkit collections or query a database here.
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

/** Parses {@code 100}, {@code 1.5k}, {@code 2m}, {@code 1b}. Pure function, directly unit-testable. */
public final class Amounts {

    private static final Pattern NUMBER = Pattern.compile("\\d+(\\.\\d+)?");
    private static final Map<Character, BigDecimal> SUFFIXES = Map.of(
        'k', BigDecimal.valueOf(1_000L),
        'm', BigDecimal.valueOf(1_000_000L),
        'b', BigDecimal.valueOf(1_000_000_000L)
    );

    private Amounts() {}

    /**
     * Returns a positive whole amount; returns empty for a bad format, a non-positive value, a non-integer (for example {@code 1.0001k}), or a value outside the long range,
     * and the caller turns that into an error message the user can understand.
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
 * Amount argument: accepts {@code 100}, {@code 1.5k}, {@code 2m}, {@code 1b} and parses it to {@code long}.
 *
 * <p>It is sent to the client as {@code StringArgumentType.word()}, so a vanilla client can connect without any mod.
 * Read it with {@code ctx.getArgument("amount", Long.class)}.
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

    /** Appends k / m / b once a plain number has been typed. Looks only at the typed string and touches no external state. */
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

/** Payment service; implemented by the project (database, Vault, or ServicesManager all work). Callers are guaranteed to be on the main thread. */
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

/** {@code /pay <player> <amount>}: the target uses the built-in player selector, the amount uses the custom k/m/b argument. */
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

        // Resolve the selector against the source (so @p and @s make sense); player() guarantees exactly one, and the server already reports an error when no player is found
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

/** {@code /example} (info) and {@code /example reload} (requires the admin permission). */
public final class ExampleCommand {

    public static final String PERMISSION_USE = "example.use";
    public static final String PERMISSION_ADMIN = "example.admin";

    private final Runnable reload;

    /** @param reload reload action; called on the main thread; handle and log failures yourself and never let an exception escape the command */
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
                // A child node's requires is ANDed with its parent's: both must pass for it to be visible and runnable
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

        // Demo service: replace with a real implementation in practice (constructor injection, no static singleton)
        PayService payService = (from, to, amount) ->
            from.equals(to) ? PayService.Result.SELF : PayService.Result.OK;
        PayCommand pay = new PayCommand(payService);
        ExampleCommand example = new ExampleCommand(this::reloadConfig);

        // Register only inside the COMMANDS event: the server fires it again on /reload
        getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> {
            Commands registrar = event.registrar();
            registrar.register(pay.build(), "Pay another player", List.of("transfer"));
            registrar.register(example.build(), "Example plugin command");
        });
    }
}
```

### `ExampleBootstrap.java` (extra: bootstrap registration for `paper-plugin.yml`)

```java
package com.example.command;

import io.papermc.paper.plugin.bootstrap.BootstrapContext;
import io.papermc.paper.plugin.bootstrap.PluginBootstrap;
import io.papermc.paper.plugin.lifecycle.event.types.LifecycleEvents;

/**
 * Registers commands during bootstrap (the main plugin class has not been created yet).
 *
 * <p>Limitation: there is no JavaPlugin instance at this point, so commands cannot use the plugin's logger / scheduler / config directly.
 * Use {@code context.getLogger()} and {@code context.getDataDirectory()} when needed, or obtain services only when executes runs.
 * Pick either this or the onEnable registration in {@code ExamplePlugin}; never register the same command from both.
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

## Recommended Directory Structure

```
src/main/java/com/example/command/
├── ExamplePlugin.java        <- registers in onEnable (or ExampleBootstrap)
├── CommandSupport.java       <- permissions, messages, errors, snapshot completion
├── Amounts.java              <- pure function, unit-testable
├── AmountArgumentType.java   <- custom argument
├── PayCommand.java           <- one class per command; build() returns a LiteralCommandNode
├── PayService.java           <- business-logic interface (command classes only parse and reply)
└── ExampleCommand.java
src/main/resources/
└── plugin.yml                <- permissions only, no commands:
```

## Key Rules

| Topic | Approach |
|------|------|
| Where to register | `getLifecycleManager().registerEventHandler(LifecycleEvents.COMMANDS, event -> event.registrar().register(node, description, aliases))`; never register outside the event |
| `register` signatures | `register(node)`, `register(node, description)`, `register(node, aliases)`, `register(node, description, aliases)`; aliases are a `Collection<String>` |
| Argument parsing | Built-in `ArgumentTypes.player()` / `players()` / `world()` / `itemStack()` / `finePosition()` ...; selectors and positions return a **Resolver**, which only yields a value after `resolve(source)` inside `executes` (the result depends on the source position) |
| Reading arguments | `context.getArgument("name", Type.class)`; the name must match the string in `Commands.argument`, so extract it into a constant |
| Permissions | `.requires(source -> source.getSender().hasPermission(node))`; this also decides whether the command appears in client-side completion |
| Return value | Return `Command.SINGLE_SUCCESS` (`1`) on success; on failure `throw CommandSupport.error(...)`, do not return `0` and print the message yourself |
| Failure messages | `SimpleCommandExceptionType` + `MessageComponentSerializer.message().serialize(component)`; the player sees red text in chat |
| Player input in messages | `Placeholder.unparsed(...)`; never concatenate into a MiniMessage template (avoids tag injection) |
| Completion | Read only an immutable snapshot (`Set.copyOf` / `volatile` snapshot); never query a database or iterate mutable Bukkit collections inside completion |

## Sender Handling

- `getSender()`: whoever actually typed the command / the console / a command block; **use it for permission checks and replies**
- `getExecutor()`: the entity the command "represents" (with `/execute as <entity> run ...` it is that entity); may be `null`; **use it for self-targeted actions (charging your own money, teleporting yourself)**
- When a player is required: `CommandSupport.requirePlayer(source)` (calls `getPlayerOrThrow()` internally on 26.2; checks `getExecutor()` itself on 1.21.11)
- Commands the console may use (for example `reload`) must not call `requirePlayer`; reply to `getSender()` directly

## Thread Safety

- `executes` runs on the **main thread** and may call the Bukkit API; push slow work (database, HTTP) to async yourself, then return to the main thread to reply and re-verify the player is still online
- `suggests` / `listSuggestions` are **not guaranteed to run on the main thread**: read only an immutable snapshot and never call Bukkit world/entity APIs
- `requires` is called while building the client command tree, so keep it lightweight and side-effect free
- See [`references/paper-threading.md`](references/paper-threading.md)

## When NOT to Use

- The command has no arguments or only a few fixed strings and needs no completion -> `plugin.yml` `commands:` + `getCommand("x").setExecutor(...)` is simpler
- You want to keep existing `CommandExecutor` / `TabCompleter` code and have no upgrade need -> leave it as is
- **Pick one approach per command name**: keeping Brigadier and `plugin.yml commands:` under the same name causes undefined behavior

## Fallback

| Error | Cause | Fix |
|------|------|------|
| Command missing / `Unknown command` | Not registered inside the `COMMANDS` event, or the handler threw | Make sure you register inside `registerEventHandler(LifecycleEvents.COMMANDS, ...)` and check the console startup errors |
| `plugin.yml` `commands:` conflicts with Brigadier | Duplicate declaration under the same name | Pick one; for the Brigadier version delete `commands:` and `getCommand()` |
| `ClassCastException` when reading a player argument | The argument was read as `Player` instead of a Resolver | Read `PlayerSelectorArgumentResolver.class`, then call `resolve(source)` |
| Occasional `ConcurrentModificationException` in completion | Completion iterates a mutable collection off the main thread | Use an immutable snapshot |
| Subcommand shows up in completion without permission | The child node has no `requires` | Give every node that needs a permission its own `.requires(...)` |
| Odd permission results after `/execute as` | Permission checked with `getExecutor()` | Use `getSender()` for permissions and `getExecutor()` for the target |
| Compiles on 26.2 but `getPlayerOrThrow` is not found on 1.21.11 | That method exists only on 26.2 | Follow the `// @1.21.11:` form in `CommandSupport.requirePlayer` |
| `paper-plugin.yml` fails to load | `commands:` is still present | Remove it; all commands go through Brigadier |
