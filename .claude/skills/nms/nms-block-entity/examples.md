# examples — nms-block-entity

## 範例 1：讀取 BlockEntity 資料

**Input:**
```
package_name: com.example.block
entity_class_name: GeneratorBlockEntity
has_ticker: true
```

**Output — 玩家右鍵方塊時顯示儲存能量:**
```java
@EventHandler
public void onInteract(PlayerInteractEvent event) {
    if (event.getAction() != Action.RIGHT_CLICK_BLOCK) return;
    Block block = event.getClickedBlock();
    if (block == null) return;

    BlockEntityHelper.getCustom(block.getLocation()).ifPresent(be -> {
        event.getPlayer().sendMessage("§6儲存能量: §e" + be.getStoredEnergy());
        event.getPlayer().sendMessage("§6擁有者: §f" + be.getOwnerName());
    });
}
```

---

## 範例 2：修改 BlockEntity 資料並同步客戶端

**Input:**
```
package_name: com.example.block
```

**Output — 指令充能 BlockEntity（必須在主執行緒）:**
```java
public void chargeGenerator(Location loc, int amount) {
    BlockEntityHelper.getCustom(loc).ifPresent(be -> {
        int newEnergy = Math.min(be.getStoredEnergy() + amount, 1000);
        be.setStoredEnergy(newEnergy); // 內部已呼叫 markDirtyAndSync()
    });
}
```

---

## 範例 3：Ticker 每秒自動充能

**Input:**
```
package_name: com.example.block
has_ticker: true
```

**Output — CustomBlockEntityTicker 每 20 tick 充能 10 點（已內建於 SKILL.md 範本）:**
```java
// 在自定義方塊的 getTicker() 方法中回傳 Ticker
@Override
@Nullable
public <T extends BlockEntity> BlockEntityTicker<T> getTicker(
        Level level, BlockState state, BlockEntityType<T> type) {
    if (level.isClientSide) return null;
    return createTickerHelper(type, MY_BLOCK_ENTITY_TYPE, new CustomBlockEntityTicker());
}
```

---

## 範例 4：NBT 持久化驗證

**Input:**
```
package_name: com.example.block
```

**Output — 確認 BlockEntity 在伺服器重啟後資料不丟失:**
```java
// 儲存資料
BlockEntityHelper.getCustom(loc).ifPresent(be -> {
    be.setOwnerName("Steve");
    be.setStoredEnergy(500);
    // setStoredEnergy 內部呼叫 setChanged()，資料將在下次 chunk 存檔時寫入
});

// 重啟後讀取（無需額外操作，NMS 自動從 NBT 恢復）
BlockEntityHelper.getCustom(loc).ifPresent(be -> {
    assert be.getOwnerName().equals("Steve");   // ✅ 持久化成功
    assert be.getStoredEnergy() == 500;         // ✅ 能量正確恢復
});
```
