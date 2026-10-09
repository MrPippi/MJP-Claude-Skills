# examples — nms-version-adapter

## 範例 1：單模組（只支援一個版本）起步

**Input:**
```
package_name: com.example.nms
adapter_interface: NmsAdapter
supported_versions: 26.2
```

**使用端：雖只支援單版本，但透過 adapter 未來升級更容易:**
```java
// onEnable
AdapterRegistry.register(new V26_2_Adapter());
AdapterRegistry.initialize();

// 業務代碼
Component msg = Component.text("歡迎！").color(NamedTextColor.GREEN);
AdapterRegistry.get().sendActionBar(player, msg);
```

---

## 範例 2：支援 26.2 與 26.3（Try-catch 註冊）

**Input:**
```
package_name: com.example.nms
adapter_interface: NmsAdapter
supported_versions: 26.2, 26.3
```

**使用端：安全註冊（執行環境若不含某 adapter class 也不崩潰）:**
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

## 範例 3：Multi-module Gradle build 結構

**根目錄 settings.gradle:**
```groovy
rootProject.name = 'my-plugin'

include 'core'
include 'adapter-v26_2'
include 'adapter-v26_3'
include 'plugin'
```

**core/build.gradle（版本無關介面）:**
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

**plugin/build.gradle（整合打包）:**
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

## 範例 4：Adapter 方法加 default 實作（向後相容）

**使用端：新增 adapter 方法時不破壞既有 adapter:**
```java
public interface NmsAdapter {
    NmsVersion version();
    void sendActionBar(Player player, Component message);

    /** 新增方法，提供預設（退化）實作 */
    default void sendTitle(Player player, Component title, Component subtitle) {
        // 退化：用 Bukkit API
        player.showTitle(Title.title(title, subtitle));
    }

    /** 特定版本才有的功能，不支援時丟例外 */
    default void playClientSound(Player player, String soundKey) {
        throw new UnsupportedOperationException(
            "playClientSound not supported on " + version());
    }
}
```

**使用端檢查支援性:**
```java
try {
    AdapterRegistry.get().playClientSound(player, "custom.ambient");
} catch (UnsupportedOperationException e) {
    // Fallback 至 Bukkit API
    player.playSound(player.getLocation(), Sound.AMBIENT_CAVE, 1f, 1f);
}
```
