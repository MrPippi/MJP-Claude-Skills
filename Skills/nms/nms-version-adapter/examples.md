# examples — nms-version-adapter

## Example 1: Single module (one supported version) getting started

**Input:**
```
package_name: com.example.nms
adapter_interface: NmsAdapter
supported_versions: 26.2
```

**Usage: even with a single version, an adapter makes future upgrades easier:**
```java
// onEnable
AdapterRegistry.register(new V26_2_Adapter());
AdapterRegistry.initialize();

// Business code
Component msg = Component.text("Welcome!").color(NamedTextColor.GREEN);
AdapterRegistry.get().sendActionBar(player, msg);
```

---

## Example 2: Supporting 26.2 and 26.3 (try-catch registration)

**Input:**
```
package_name: com.example.nms
adapter_interface: NmsAdapter
supported_versions: 26.2, 26.3
```

**Usage: safe registration (no crash if the runtime lacks some adapter class):**
```java
@Override
public void onEnable() {
    tryRegister("com.example.nms.v26_2.V26_2_Adapter");
    tryRegister("com.example.nms.v26_3.V26_3_Adapter");

    try {
        AdapterRegistry.initialize();
    } catch (IllegalStateException e) {
        getLogger().severe(e.getMessage());
        getServer().getPluginManager().disablePlugin(this);
    }
}

private void tryRegister(String className) {
    try {
        Class<?> cls = Class.forName(className);
        NmsAdapter adapter = (NmsAdapter) cls.getDeclaredConstructor().newInstance();
        AdapterRegistry.register(adapter);
    } catch (Throwable t) {
        getLogger().fine("Adapter not available: " + className);
    }
}
```

---

## Example 3: Multi-module Gradle build structure

**Root settings.gradle:**
```groovy
rootProject.name = 'my-plugin'

include 'core'
include 'adapter-v26_2'
include 'adapter-v26_3'
include 'plugin'
```

**core/build.gradle (version-independent interface):**
```groovy
plugins { id 'java' }

dependencies {
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
}

java { toolchain.languageVersion = JavaLanguageVersion.of(25) }
```

**adapter-v26_2/build.gradle:**
```groovy
plugins {
    id 'java'
    id 'io.papermc.paperweight.userdev' version '2.0.0-beta.24'
}

dependencies {
    paperweight.paperDevBundle('26.2.build.132-stable')
    compileOnly project(':core')
}

java { toolchain.languageVersion = JavaLanguageVersion.of(25) }
```

**adapter-v26_3/build.gradle:**
```groovy
plugins {
    id 'java'
    id 'io.papermc.paperweight.userdev' version '2.0.0-beta.24'
}

dependencies {
    paperweight.paperDevBundle('26.3.build.166-beta')
    compileOnly project(':core')
}

java { toolchain.languageVersion = JavaLanguageVersion.of(25) }
```

**plugin/build.gradle (integration and packaging):**
```groovy
plugins {
    id 'java'
    id 'com.gradleup.shadow' version '9.6.1'
}

dependencies {
    implementation project(':core')
    implementation project(':adapter-v26_2')
    implementation project(':adapter-v26_3')
    compileOnly 'io.papermc.paper:paper-api:26.2.build.132-stable'
}

shadowJar {
    archiveClassifier.set('')
}
```

---

## Example 4: Add default implementations to adapter methods (backward compatible)

**Usage: add adapter methods without breaking existing adapters:**
```java
public interface NmsAdapter {
    NmsVersion version();
    void sendActionBar(Player player, Component message);

    /** New method with a default (degraded) implementation */
    default void sendTitle(Player player, Component title, Component subtitle) {
        // Degraded: use the Bukkit API
        player.showTitle(Title.title(title, subtitle));
    }

    /** Feature only available on specific versions; throws when unsupported */
    default void playClientSound(Player player, String soundKey) {
        throw new UnsupportedOperationException(
            "playClientSound not supported on " + version());
    }
}
```

**Usage: check for support:**
```java
try {
    AdapterRegistry.get().playClientSound(player, "custom.ambient");
} catch (UnsupportedOperationException e) {
    // Fall back to the Bukkit API
    player.playSound(player.getLocation(), Sound.AMBIENT_CAVE, 1f, 1f);
}
```
