# R6.5 是正実装プラン（R7 着手前）

最終更新: 2026-08-15

基準コミット: `0958028`（R6レビュー指摘を修正する）

関連文書: `docs/REFACTORING_ROADMAP.md`（R0〜R7 の全体計画）

## 1. 目的

R1〜R6 で導入した新しい責務境界（`EnemyVisualProfile`、`EnemyBehaviorStrategy`、各種 Factory、`FloorSnapshot` / `RoomId` / `Doorway`、`FOVCalculator` / `VisibilityRule`、`InteractionQuery` / `InteractionExecutor`）は方向として正しい。

一方で構造レビューの結果、次の状態が残っている。

- 新しい層を作ったが、旧経路が並存したまま正本が二重化している
- R7（Room ロック、スキャン、敵タイプ拡張）が乗る予定の拡張点が、実装上まだ接続されていない
- 一部は現時点で実際に動作していない（テストが緑のまま素通りしている）

本プランは、R7 の機能追加に入る前に上記を是正し、「R7 の各機能を独立して追加できる状態」を確定させることを目的とする。

## 2. 基準線（2026-08-15 時点で確認済み）

- `npx tsc --noEmit` エラーなし
- ユニットテスト: 41 スイート、514 件成功
- 対象コミット: `0958028`

本プランの各フェーズ完了時に、この基準線を下回らないことを条件とする。

## 3. 是正対象の一覧

| ID  | 内容                                          | 重大度 | 主な影響先        |
| --- | --------------------------------------------- | ------ | ----------------- |
| A1  | `'floor'` 比較が常に false（ポータル未生成）  | P0     | フロア進行全体    |
| A2  | FOV 半径が計算へ接続されていない              | P0     | R7-2 スキャン     |
| A3  | WorldSystem に第2のフロア生成経路がある       | P0     | 依存方向・保守性  |
| B1  | RoomId がフロアローカルで brand が失われる    | P1     | R7-1 Room ロック  |
| B2  | 現在フロアの正本が 2 つある                   | P1     | R7-6 フロア再訪   |
| B3  | Doorway 検証が本番で呼ばれていない            | P1     | 生成器リグレッション |
| B4  | Game がフロアデータの 2 つ目のコピーを持つ    | P1     | 世代ズレ          |
| C1  | Presentation 分離が Enemy だけ                | P1     | R7-2、表示規則    |
| C2  | 敵ステータスが `Enemy.ts` の switch のまま    | P1     | R7-3、R7-4        |
| C3  | 種別判定がタグと ID プレフィックスで二重化    | P1     | 全システム        |
| D1  | エンティティ検索がすべて線形走査              | P2     | スキャン時の性能  |
| D2  | 可視性イベントの全 Sprite ブロードキャスト    | P2     | 性能              |
| D3  | WorldSystem の委譲 API 肥大                   | P2     | 可読性            |
| D4  | ターン制に実時間 `setTimeout` が混在          | P2     | 状態の一貫性      |
| D5  | デッドコード                                  | P2     | 可読性            |

## 4. 実装単位の原則

`docs/REFACTORING_ROADMAP.md` §4.2 を継承する。

- 1 コミットでは 1 つの責務境界だけを変更する
- 公開 API やイベントを変える場合は、先に契約テストを追加する
- 新旧経路を一時的に併存させ、移行完了後に旧経路を削除する
- 旧 API 削除は移行コミットと分離する
- ファイル分割そのものを完了条件にせず、依存方向と所有権で判定する

追加の原則として、本プランでは次を守る。

- **A1 と B3 は「バグ修正」ではなく「テストで固定してから修正」とする**。現在テストが存在しない経路のため、先に失敗するテストを書く
- **B1 の決定はユーザー確認を経てから実装する**。決定内容は `decisions` へ記録する

---

## フェーズ A: 動作していない経路を閉じる（P0）

### A1: 床タイル判定を修正し、ポータル生成とフロア移動後の再配置を復旧する

**目的**: TileType の判定誤りにより実際に機能していない 2 経路を復旧し、以後同じ誤りが型検査で検出される形にする。

**現状**:

`src/game/Game.ts:743` と `src/engine/world/TileMap.ts:273` に同一の判定がある。

```ts
if (tile && (tile.type as any) === 'floor') {
```

`TileType` は数値 enum（`src/engine/types.ts:93`、`EMPTY = 0` 〜 `EVENT = 8`）であり `'floor'` というメンバは存在しない。`as any` により型エラーが抑止されているため、この条件は常に false になる。

影響:

1. `Game.buildEventObjects()` — `floorTiles` が空のまま `if (floorTiles.length === 0) return eventObjects;` で早期 return する。`createPortal` の呼び出し元は `src/game/Game.ts:758` のみであるため、ポータルおよびエネルギーチャージャーの Entity が 1 体も生成されない
2. `TileMap.getRandomFloorTile()` — 常に `null` を返す。`Game.regenerateFloor()`（`src/game/Game.ts:1132`）がこれを使うため `playerStartPos` が `undefined` となり、フロア移動後にプレイヤーが再配置されない

現在この 2 経路を覆うユニットテストは存在しない（`getRandomFloorTile` の参照が `tests/` に 0 件）。`FloorManager` のフロア遷移テストはハンドラーをモックしているため、この欠陥を検出しない。

**対象**:

- `src/engine/world/TileMap.ts`
- `src/game/Game.ts`
- `src/engine/types.ts`（述語の追加先）
- `tests/unit/world/TileMap.spec.ts`
- `tests/unit/game/GameInitialization.spec.ts`

**作業**:

1. 現状を固定する失敗テストを追加する
   - `TileMap.getRandomFloorTile()` が、床タイルを含むマップに対して非 null を返すこと
   - 生成済みマップから `Game` を初期化した後、`event_object` タグを持つ Entity が 1 体以上存在すること
2. 「床タイル」の定義を 1 箇所へ集約する。`TileType` を引数に取る純粋な述語（例: `isFloorTileType(type: TileType): boolean`）を `types.ts` もしくは `TileMap` 近傍へ置く
   - 判定は「歩行可能なタイルタイプ」を基準とし、`TileMap.isTypeWalkable()`（`src/engine/world/TileMap.ts:227` 付近）と定義が重複しないよう、どちらかへ寄せる
3. `TileMap.getRandomFloorTile()` を述語ベースへ置き換え、`as any` を除去する
4. `Game.buildEventObjects()` の床タイル収集を同じ述語へ置き換え、`as any` を除去する
5. リポジトリ全体で `tile.type as any` によるタイル比較が他にないか検索し、あれば同時に除去する
6. 追加したテストが成功することを確認する

**完了条件**:

- 追加したテストが、修正前に失敗し修正後に成功する
- ポータルとエネルギーチャージャーが初期フロアおよび再生成フロアで生成される
- フロア移動後にプレイヤー位置が新フロアの歩行可能タイルへ更新される
- タイルタイプの比較箇所に `as any` が残らない
- 既存 514 件のテストが維持される

**想定コミット数**: 2（テスト追加 → 修正）

**リスク**:

- ポータルが生成されるようになることで、これまで到達していなかった `portal_activated` → `FloorManager.moveToNextFloor()` の経路が初めて実行される。E2E とフロア遷移の手動確認を必ず行う

---

### A2: FOV の視野半径を計算入力へ接続する

**目的**: R7-2（HEAD パーツによるスキャン範囲拡張）が乗る拡張点を実際に開通させる。

**現状**:

`src/engine/fov/FOVSystem.ts:156` で `player.viewRadius` を取得しているが、`computeFOV()` へ渡していない。`src/engine/fov/FOVCalculator.ts:66-67` の `FRONT_RADIUS = 4` / `SIDE_RADIUS = 3` が固定値として効いている。

結果として次がすべて no-op になっている。

- `gameStore.player.status.viewRadius`（現在値 12）
- `Player._viewRadius` / `Player.viewRadius` / `Player.setViewRadius()`
- `fov_update_requested` イベント（視野半径変更時の再計算を意図したもの）

**対象**:

- `src/engine/fov/FOVCalculator.ts`
- `src/engine/fov/FOVSystem.ts`
- `src/engine/entity/Player.ts`
- `tests/unit/fov/FOVCalculator.spec.ts`
- `tests/unit/fov/FOVSystem.spec.ts`

**作業**:

1. 視野形状を表す純粋な値（例: `ViewProfile { frontRadius: number; sideRadius: number }`）を `FOVCalculator` 側に定義する
2. `FOVCalcInput` に視野形状を入力として追加する。既定値は現行の 4 / 3 を保持し、既存テストの期待値を変えない
3. `computeFOV()` 内の `FRONT_RADIUS` / `SIDE_RADIUS` 参照を入力値へ置き換える
4. `FOVSystem.updatePlayerFOV()` で `player.viewRadius` から視野形状を組み立てて渡す
   - `viewRadius` 単一値から front / side をどう導出するかを決める（下記の未決事項を参照）
5. `Player.setViewRadius()` が `fov_update_requested` を発行し、FOV が再計算されることをテストで固定する
6. スキャン拡張時に「半径だけ差し替えれば済む」ことをテストで示す（半径を広げると可視タイル集合が広がる契約テスト）

**未決事項**:

- `viewRadius`（現在 store 上は 12）を、現行の front 4 / side 3 とどう対応付けるか
  - 案 1: `viewRadius` を front とし、side は `front - 1`
  - 案 2: `viewRadius` を基準倍率とし、既定 8 のとき front 4 / side 3 になるようスケールする
  - 案 3: store の `viewRadius` を廃止し、front / side を持つ `ViewProfile` を Player の正本にする
- 現行の見た目を変えたくない場合は、既定値が 4 / 3 になる形を選ぶ

**完了条件**:

- `computeFOV()` が視野半径を入力として受け取り、内部に固定値を持たない
- `Player.setViewRadius()` の変更が可視タイル集合へ反映される
- 既定設定での可視タイル集合が現行と一致する（既存 FOV テストが変更なしで成功する）
- スキャン拡張時に FOVSystem の変更なしで半径を差し替えられる

**想定コミット数**: 2〜3

---

### A3: WorldSystem から第2のフロア生成経路を削除する

**目的**: WorldSystem を「フロアデータの保持と照会」に限定し、フロア生成方針の二重定義と逆方向依存を解消する。

**現状**:

`src/engine/world/WorldSystem.ts:384-451` の `changeFloor()` / `generateNewFloor()` が、難易度計算・StageType 選択・`MapGeneratorFacade` 呼び出しという Game / FloorManager と重複した生成方針を持つ。

- 唯一のトリガーである `portal_used` イベントは、コードベース内のどこからも emit されていない（デッドコード）
- このために `src/engine/world/WorldSystem.ts:775-777` でファイル末尾に `MapGeneratorFacade` と `StageType` の後付け import が置かれ、WorldSystem → MapGenerator の逆方向依存が生じている
- `docs/REFACTORING_ROADMAP.md` §3 の「`WorldSystem` はタイルマップ、ナビゲーション、経路探索を担当する」に反する

**対象**:

- `src/engine/world/WorldSystem.ts`
- `tests/unit/world/WorldSystem.spec.ts`

**作業**:

1. `portal_used` の購読者・発行者が他に存在しないことを再確認する
2. `WorldSystem.changeFloor()`、`generateNewFloor()`、`onPortalUsed()`、`portal_used` の購読を削除する
3. ファイル末尾の後付け import（`MapGeneratorFacade`、`StageType`）を削除する
4. `WorldSystem` が `world/` 配下の生成器へ依存しないことを、import 検査またはテストで固定する
5. フロア切替の唯一の入口が `setCurrentFloor()` / `registerFloorSnapshot()` であることを、コメントとテストで明示する

**完了条件**:

- `WorldSystem` が `MapGeneratorFacade` を参照しない
- フロア生成方針（難易度・StageType）の定義が `FloorManager` と `Game` の 1 経路のみになる
- ファイル末尾の import が存在しない
- 既存の WorldSystem テストが維持される

**想定コミット数**: 1

**第 1 レビューゲート**:

A1〜A3 完了時点で、Playwright E2E とゲーム開始・敵表示・移動・フロア遷移の手動確認を行う。A1 によりポータル経路が初めて実行されるため、ここは必ず通す。

---

## フェーズ B: フロアと Room のデータ境界を確定させる（P1）

### B1: RoomId のスコープを決定し、型境界を閉じる

**目的**: Room ロック・スキャン・フロア再訪が乗る前に、Room の同一性規則を確定させる。

**現状**:

- `RoomId` は branded 型（`src/engine/world/RoomId.ts:13`）だが、`Room.id` は `string | undefined`（`src/engine/types.ts:301`）であり、`FloorStore.ts:70` の `roomToId(room) as string` で brand が失われる
- `RoomId` はフロア内でのみ一意（`"x,y"`）。フロア横断で Room 状態を Map に持つと、別フロアの同座標 Room と衝突する
- `RoomId` の文字列形式 `"x,y"` は FOV の `tileKey(x, y)`（`src/engine/fov/FOVCalculator.ts:46`）と同形であり、`isRoomId(tileKey(3, 4))` が true になる
- `Corridor.connectedRooms` の `"x,y"` は `AStarCorridorGenerator.ts:377` と `LShapeCorridorGenerator.ts:191` でテンプレートリテラル直書きであり、`roomToId()` を経由していない

**未決事項（実装前にユーザー確認が必要）**:

`docs/REFACTORING_ROADMAP.md` §10-3 の未決事項をここで確定させる。

- 案 1: `RoomId` をフロア込みの永続 ID にする（例: `"F1:12,8"`）
  - 利点: フロア横断の Map を 1 つ持てる。スキャン結果やロック状態の保存が単純
  - 欠点: 既存の `connectedRooms` 生成箇所と Doorway 導出を同時に変更する必要がある
- 案 2: `RoomId` はフロアローカルのまま維持し、状態は `(floor, roomId)` の複合キーで持つ
  - 利点: 既存コードの変更が小さい
  - 欠点: 状態を持つ側すべてで複合キーの規約を守る必要がある
- 案 3: 座標由来をやめ、生成時に採番した不透明 ID にする
  - 利点: 座標変更に強く、tileKey との衝突がなくなる
  - 欠点: 生成器側で ID を発行する責務が増える

**対象**（案の決定後に確定）:

- `src/engine/world/RoomId.ts`
- `src/engine/types.ts`（`Room.id` の型）
- `src/engine/world/FloorStore.ts`
- `src/engine/world/Doorway.ts`
- `src/engine/world/corridors/AStarCorridorGenerator.ts`
- `src/engine/world/corridors/LShapeCorridorGenerator.ts`
- `tests/unit/world/RoomId.spec.ts`、`tests/unit/world/Doorway.spec.ts`

**作業**:

1. 上記 3 案からユーザー確認のうえ 1 案を決定し、`decisions` へ記録する
2. `Room.id` の型を `RoomId`（省略可）へ変更し、`as string` によるダウンキャストを除去する
3. 生成器の `connectedRooms` 生成を `roomToId()` 経由へ置き換える（形式の定義箇所を 1 つにする）
4. `isRoomId()` が tileKey と区別できる形式になるよう調整する（案 1・案 3 を選んだ場合は自然に解消される）
5. `Corridor.connectedRooms` の要素型を `RoomId[]` へ寄せられるか検討する（`types.ts` の変更範囲を確認してから判断）

**完了条件**:

- Room の同一性規則が 1 箇所で定義され、生成器・FloorStore・Doorway が同じ規則を参照する
- `RoomId` の brand が保持面・照会面で失われない
- Room ロック状態を保持するための安定したキーが、フロアを跨いでも衝突しない
- 既存 Doorway / RoomId テストが維持される

**想定コミット数**: 2〜3

---

### B2: 現在フロアの正本を 1 つにする

**目的**: 「生成」「登録」「切替」を分離し、フロア再訪・別フロア照会・スキャンが構造的に書ける状態にする。

**現状**:

- `FloorManager.currentFloor`（`src/engine/world/FloorManager.ts:33`）と `FloorStore.currentFloor`（`src/engine/world/FloorStore.ts:21`）が独立して存在する
- `FloorStore.register()`（`src/engine/world/FloorStore.ts:61-82`）が副作用として `currentFloor` と `currentTileMap` を切り替える。すなわち「登録＝切替」であり、切り替えずに登録できない
- `floor_changed` のペイロードが 2 種類ある
  - `FloorManager.ts:159`: `{ floor, maxFloors }`
  - `WorldSystem.ts:396`: `{ floorNumber }`（A3 で削除予定）
- 唯一の購読者である `FOVSystem`（`src/engine/fov/FOVSystem.ts:90-97`）はペイロードを参照せず `worldSystem.getCurrentFloor()` を問い合わせているため、現状は表面化していない

**対象**:

- `src/engine/world/FloorStore.ts`
- `src/engine/world/WorldSystem.ts`
- `src/engine/world/FloorManager.ts`
- `tests/unit/world/WorldSystem.spec.ts`、`tests/unit/world/FloorManager.spec.ts`

**作業**:

1. `floor_changed` のペイロード契約をテストで固定する（発行者・フィールド名・発行タイミング）
2. `FloorStore.register()` から現在フロア切替の副作用を分離する
   - `register(snapshot)`: 保存のみ。現在フロアを変更しない
   - `activateFloor(floor)`: 登録済みフロアへの切替のみ
3. `WorldSystem.registerFloorSnapshot()` を「登録のみ」に変更し、切替は明示的な `setCurrentFloor()` で行う
   - 呼び出し元（`Game.commitMapState`、`Game.regenerateFloor`）を、登録 → 切替の 2 ステップへ更新する
4. `floor_changed` の発行者を `FloorManager` に一本化し、ペイロードを 1 つに固定する
5. 現在フロアの正本を決める。`FloorManager` を正本とし、`WorldSystem.getCurrentFloor()` は表示中フロアの取得として役割を明示する（または FloorManager が WorldSystem の値を読む形へ統一する）
6. 生成失敗時に「登録済みだが未切替」の状態が残らないことをテストで確認する

**完了条件**:

- 現在フロアの切替が、登録とは独立した明示的な操作になる
- `floor_changed` の発行者とペイロードが 1 つに固定される
- 現在フロアを変更せずに別フロアの Room / Doorway を照会できる
- R0 で固定したフロア生成失敗時の契約（現在階の一致、旧フロア維持、エネルギー +20）が維持される

**想定コミット数**: 2〜3

---

### B3: Doorway 検証を本番経路へ接続する

**目的**: 生成器のリグレッションを検出できるようにし、R5 の完了条件を実データで担保する。

**現状**:

`validateDoorways` / `areAllRoomsConnected` / `buildRoomGraph` / `isRoomGraphConnected`（`src/engine/world/Doorway.ts`）の呼び出し元は `tests/` と `src/engine/world/index.ts` の再エクスポートのみ。生成されたマップに対して一度も実行されていない。

そのため R5 完了条件「必須 Room が孤立せず、Doorway が境界と通行可能タイル上にある」は、手書き fixture でのみ担保されている。

**対象**:

- `src/engine/world/WorldSystem.ts`（または `FloorStore`）
- `src/engine/world/Doorway.ts`
- `tests/unit/world/Doorway.spec.ts`
- `src/tools/map-evaluation/`（生成器評価への組み込み先候補）

**作業**:

1. フロア登録時に Doorway 検証を実行する経路を追加する。実行方針を決める
   - 案 A: `registerFloorSnapshot()` で常に検証し、違反を `console.warn` で報告する（本番影響なし、検知可能）
   - 案 B: 開発ビルドとテストでのみ検証する
   - 案 C: `src/tools/map-evaluation` 側で全 StageType のマップを生成して検証するテストを追加する
   - 推奨: 案 A と案 C の併用。実行時は警告に留め、生成テストで失敗させる
2. 実マップ生成 → Doorway 導出 → 検証を通す統合テストを追加する（各 StageType について最低 1 件）
3. 検証違反時に、どの Room / Corridor が原因かを特定できるログ形式にする（`DoorwayValidationError` は既にインデックスと種別を持つため、それを出力する）
4. B1 の生成器変更（`roomToId()` 経由）と整合を取る

**完了条件**:

- 生成されたマップに対して Doorway 検証が実行される
- 各 StageType の生成マップで Room が孤立しないことをテストで確認できる
- 検証違反が無言で通過しない
- `corridorsToDoorways` が空配列を返す状態を、テストが検出できる

**想定コミット数**: 2

---

### B4: Game が持つフロアデータの二重管理を解消する

**目的**: R5 で導入した `FloorSnapshot` を唯一のフロアデータ正本にする。

**現状**:

`Game` は `tileMap`、`currentRooms`、`currentCorridors`、`currentTacticalElements`、`placedObstacles`、`placedItems`、`placedEnemies` を保持している（`src/game/Game.ts:68-87`）。これは `WorldSystem` / `FloorStore` が持つ `FloorSnapshot` と同じ内容の 2 つ目のコピーである。

`Game.generateResources()`（`src/game/Game.ts:563-568`）は WorldSystem ではなく Game 側のコピーを読んでいるため、両者がずれた場合に検出できない。

**対象**:

- `src/game/Game.ts`
- `src/engine/world/WorldSystem.ts`（`getFloorSnapshot` の利用）
- `tests/unit/game/GameInitialization.spec.ts`

**作業**:

1. `Game.generateResources()` の入力を `worldSystem.getFloorSnapshot(floor)` 経由に変更する
2. `Game.currentRooms` / `currentCorridors` / `currentTacticalElements` / `tileMap` の参照箇所を洗い出し、順に WorldSystem 経由へ置き換える
3. 置き換え完了後にフィールドを削除する（削除は別コミット）
4. `placedObstacles` / `placedItems` / `placedEnemies` の用途を確認する
   - 現在フロアの配置結果を保持しているが、参照者が限られる場合は削除候補
   - R7-6（フロア再訪と探索状態の保持）で必要になるなら、`FloorSnapshot` 側へ持たせるか別のフロア別ストアへ移す
5. `Game.reset()` のクリア対象を、残したフィールドに合わせて更新する

**完了条件**:

- フロア構成データ（TileMap / Room / Corridor / TacticalElement）の正本が `FloorStore` のみになる
- `Game` はフロア番号と実行時参照のみを保持する
- Game 再初期化テストとフロア遷移テストが維持される

**想定コミット数**: 2〜3

**第 2 レビューゲート**:

B1〜B4 完了時点で、Room データ境界とフロア切替の設計を確認する。ここで R7-1（Room ロック）と R7-2（スキャン）の仕様化へ進めるかを判断する。

---

## フェーズ C: ドメインとプレゼンテーションの非対称を解消する（P1）

### C1: Player / Item の描画ライフサイクルを Presentation へ移す

**目的**: R2 で Enemy に適用した分離を他の Entity へ広げ、ドメイン層から PixiJS 依存を除去する。

**現状**:

- `src/engine/entity/Player.ts:14,385,407` が `RendererSystem` を直接参照
- `src/engine/entity/Item.ts:12-14,89` が `RendererSystem` と `PIXI.Graphics` を直接参照し、ドメインエンティティ内で描画オブジェクトを生成している
- `SpriteComponent`（`src/engine/entity/components/Sprite.ts`）が `entity/components/` 配下にありながら `pixi.js` を import するため、これを持つ Entity はすべて PixiJS へ依存する
- 結果として R6-4「Presentation は FOV の結果だけを受け取り、視界計算を知らない」は Enemy でのみ成立している

**対象**:

- `src/engine/presentation/`（`player/`、`item/` の追加）
- `src/engine/entity/Player.ts`、`src/engine/entity/Item.ts`
- `src/engine/factory/ItemFactory.ts`
- `tests/unit/entity/Item.spec.ts`、`tests/unit/presentation/`

**作業**:

1. `EnemyPresentation` / `EnemyPresentationFactory` と同じ構造で `ItemPresentation` を作る。`PIXI.Graphics` による円描画を Presentation 側へ移す
2. `ItemFactory.create()` で Presentation を組み立てる（`EnemyFactory` と同じ手順）
3. `Player` の描画参照（カメラ追従を除く）を Presentation 側へ移す
   - カメラ追従は描画関心のため、Presentation か RendererSystem 側の所有とする
4. `Item.ts` / `Player.ts` から `pixi.js` と `RendererSystem` の import を削除する
5. `SpriteComponent` の配置を見直す。`entity/components/` から `presentation/` 配下へ移すか、ドメインが直接 add しない規約をテストで固定する

**完了条件**:

- `Player.ts` と `Item.ts` が `pixi.js` と `RendererSystem` を参照しない
- Item を RendererSystem なしで初期化してテストできる
- 破棄時に Sprite / Graphics とイベント購読が残らない
- 画面上の見た目と E2E の起動経路が変わらない

**想定コミット数**: 3〜4

---

### C2: 敵ステータスを純データへ分離し、CombatSystem へ接続する

**目的**: R7-3（雑魚・中ボス・ボスのデータ差）と R7-4（ボスへの Parts 適用）を、`Enemy.ts` の変更なしで追加できるようにする。

**現状**:

- `Enemy.getEnemyStats()`（`src/engine/entity/Enemy.ts:100-141`）が EnemyType 別の `maxHealth` / `defense` / `moveSpeed` / `attackPower` を switch で保持している。R1 で見た目は `EnemyVisualProfile` へ出したが、ステータスは残っている
- `attackPower` はコードベース内のどこからも参照されていない（`Player.ts` の同名変数は別物）
- `CombatSystem.calculateDamage()`（`src/engine/combat/CombatSystem.ts:205-235`）は基本ダメージ 10 / 15 の固定値と `attackerId.startsWith('player')` のみで算出し、Entity のステータスを一切参照していない（`// TODO: ステータスベースのダメージ計算` が残る）

**対象**:

- `src/engine/entity/Enemy.ts`
- `src/engine/presentation/enemy/EnemyVisualProfile.ts`（対になる配置形式の参考）
- 新規: `EnemyStatProfile`（配置場所は要検討）
- `src/engine/factory/EnemyFactory.ts`
- `src/engine/combat/CombatSystem.ts`
- `tests/unit/entity/Enemy.spec.ts`、`tests/unit/combat/CombatSystem.spec.ts`

**作業**:

1. `EnemyVisualProfile` と同じ形式で `EnemyStatProfile`（純データ + 純粋関数）を作る。レベル倍率の計算も純粋関数として切り出す
2. 未知の EnemyType に対するフォールバックを固定する（`EnemyVisualProfile` と同じ規約にする）
3. `Enemy` はステータスを外部から受け取る形にし、`getEnemyStats()` の switch を削除する
4. `EnemyFactory.create()` でプロファイルを解決して注入する
5. `attackPower` の扱いを決める
   - CombatSystem へ接続する場合: 攻撃力を保持するコンポーネント（または既存コンポーネントの拡張）を通じて参照する
   - 接続しない場合: 死にフィールドとして削除する
   - 推奨: 本フェーズでは `EnemyStatProfile` に残したうえで、CombatSystem 側の接続は別コミットに分ける
6. `CombatSystem.calculateDamage()` を、攻撃側・防御側のステータスを参照する形へ変更する。現行のバランスを大きく変えないよう、既定値で現在のダメージ帯を維持する

**完了条件**:

- 新しい EnemyType の追加が、`Enemy.ts` の switch 変更なしで行える
- ステータスが PixiJS・Engine へ依存しない純データとして取得できる
- ダメージ計算が Entity のステータスを参照する
- 現在の SCOUT / SOLDIER / HEAVY の実効ステータスが変わらない

**想定コミット数**: 3〜4

**注意**: `docs/REFACTORING_ROADMAP.md` §9 でゲームバランス調整はスコープ外としている。本フェーズは「値の置き場所と参照経路」の変更に限定し、値そのものは変えない。

---

### C3: Entity 種別の判定規則を 1 つにする

**目的**: 種別判定の重複を解消し、非衝突オブジェクトや新しい Entity 種別を各システムの変更なしで追加できるようにする。

**現状**:

- ID 文字列プレフィックスによる判定が散在している
  - `src/engine/fov/FOVSystem.ts:74,83`
  - `src/engine/interaction/InteractionSystem.ts:77`
  - `src/engine/combat/CombatSystem.ts:181,220`
- 一方で `Entity` はタグ機構を持ち、`hasTag('player')` も併用されている
- `WorldSystem.isPositionOccupied()`（`src/engine/world/WorldSystem.ts:316-322`）は衝突除外を `hasTag('item')` / `hasTag('event_object')` / `hasTag('portal')` / `hasTag('charger')` のハードコードで判定している。非衝突オブジェクトを追加するたびに WorldSystem の変更が必要になる

**対象**:

- `src/engine/fov/FOVSystem.ts`
- `src/engine/interaction/InteractionSystem.ts`
- `src/engine/combat/CombatSystem.ts`
- `src/engine/world/WorldSystem.ts`
- `src/engine/entity/components/`（衝突宣言用コンポーネントの追加先）

**作業**:

1. プレイヤー判定を `hasTag('player')` へ統一する（`VisibilityRule.isPlayerEntity()` が既に正しい形なので、これを共通利用する）
2. `entityId.startsWith('player')` を全箇所で置き換える
3. 衝突判定の可否を Entity 側で宣言する形へ変更する
   - 案: `BlockingComponent`（または `Collidable`）を導入し、衝突する Entity のみが持つ
   - `WorldSystem.isPositionOccupied()` はコンポーネントの有無だけを見る
4. Room ロック用のドア・バリアを将来追加する際に、WorldSystem を変更せず衝突対象にできることをテストで示す

**完了条件**:

- Entity 種別の判定規則が 1 箇所で定義される
- ID 文字列プレフィックスによる種別判定が残らない
- 新しい非衝突・衝突 Entity の追加で `WorldSystem` を変更しなくてよい
- 既存の衝突・可視性の挙動が変わらない

**想定コミット数**: 2〜3

**第 3 レビューゲート**:

C1〜C3 完了時点で、ドメイン層の依存方向（`docs/REFACTORING_ROADMAP.md` §4.1）が目標どおりかを確認する。

---

## フェーズ D: 性能と整理（P2）

R7 の機能追加と並行して進められる。D1 はスキャン実装前に着手することを推奨する。

### D1: エンティティの位置インデックスを導入する

**現状**: 位置によるエンティティ検索がすべて線形走査になっている。

| 箇所                                          | 計算量                          |
| --------------------------------------------- | ------------------------------- |
| `WorldSystem.isPositionOccupied()` / `getEntityAtPosition()` | O(N)               |
| `FOVSystem.isBlocking()`（`FOVSystem.ts:237-253`） | O(N)。`computeFOV` の視線判定ごとに呼ばれるため実効 O(タイル数 × 視線長 × N) |
| `InteractionQuery.findEntityAtTilePosition()` | O(N)                            |
| `InteractionSystem.update()`                  | 毎フレーム `getEntitiesByTag` + `getEntities` で配列を新規生成 |

スキャン（広範囲 FOV）を追加すると最初に顕在化する。

**作業**:

1. `EntitySystem` にタイル座標 → Entity のインデックスを持たせる。`ENTITY_MOVED` と登録・削除で更新する
2. 上記 4 箇所をインデックス経由へ置き換える
3. `getEntities()` の毎フレーム配列生成を、読み取り専用ビューまたはキャッシュへ置き換える
4. インデックスと実際の Transform がずれないことをテストで固定する

**想定コミット数**: 2〜3

### D2: 可視性イベントの配信をレジストリ方式へ変更する

**現状**: 各 `SpriteComponent` が `entity_visibility_changed` を購読し、`entityId` で自己フィルタしている（`src/engine/entity/components/Sprite.ts:98-103`）。N 購読 × M 変化のコストになる。

**作業**: entityId → Presentation のレジストリを持ち、FOV の差分結果を該当 Presentation のみへ適用する。C1（Presentation の対称化）完了後に実施すると変更が 1 箇所で済む。

**想定コミット数**: 1〜2

### D3: WorldSystem の委譲 API を整理する

**現状**: `FloorStore` への単純委譲が「現在フロア版」と「フロア指定版」で二重に約 20 メソッド存在する（`src/engine/world/WorldSystem.ts:558-721`）。

**作業**:

1. `getFloorSnapshot(floor)` を主 API とし、現在フロア用は薄いショートカットに限定する
2. 旧 API `registerFloor()`（`src/engine/world/WorldSystem.ts:528-535`）の呼び出し元がなくなった時点で削除する
3. `setRooms` / `setCorridors` / `setTacticalElements` の用途を確認し、`FloorSnapshot` の不変性と矛盾する場合は削除または再設計する

**想定コミット数**: 1〜2

### D4: タイル効果の実時間タイマーをターンベースへ変更する

**現状**: `WorldSystem.applyTileEffect()` が `setTimeout(..., 1000)` / `setTimeout(..., 3000)` で移動速度を戻している（`src/engine/world/WorldSystem.ts:208,229`）。ターン制のゲームに実時間の状態変化が混在し、フロア遷移や `reset()` 後もタイマーが生き残る。

**作業**: 効果の残存をターン数で表現し、`TurnSystem` の進行で減算する。`destroy()` / `reset()` で確実に破棄されることをテストで固定する。

**想定コミット数**: 1〜2

### D5: デッドコードを削除する

- `src/engine/world/MapGenerator.ts`（202 行）: `src/` `tests/` からの import が 0 件
- `Game.generateMapWithStageType()` 内のコメントアウトされた TODO 群（`src/game/Game.ts:454-475`）
- `Enemy.attackPower`（C2 の判断に従う）
- A3 で削除する `WorldSystem` のフロア生成経路（重複記載）

**想定コミット数**: 1

---

## 5. 推奨実行順

```text
第1バッチ: A1 → A2 → A3
  動作していない経路を閉じる（第1レビューゲート）

第2バッチ: B1 → B2 → B3 → B4
  フロアと Room のデータ境界を確定（第2レビューゲート）
  ※ B1 は先にユーザー確認が必要

第3バッチ: D1
  スキャン実装前に位置インデックスを導入

第4バッチ: C1 → C2 → C3
  ドメイン / プレゼンテーションの非対称を解消（第3レビューゲート）

随時: D2 → D3 → D4 → D5
  R7 と並行可能
```

R7 の着手条件は「第2バッチ完了」とする。C フェーズは R7-2 / R7-3 の直前で構わない。

## 6. 各コミットの検証ゲート

`docs/REFACTORING_ROADMAP.md` §7 を継承する。

### 通常コミット

- `npx tsc --noEmit`
- 変更対象のユニットテスト
- `git diff --check`

### 各フェーズ完了

- ユニットテスト全件（基準: 41 スイート / 514 件以上）
- 本番ビルド
- lint エラーがないこと

### レビューゲート（A3 / B4 / C3 完了時）

- Playwright E2E 5 件
- ゲーム開始、Enemy 表示、移動、フロア遷移の手動確認
- destroy 後のイベント購読、PixiJS オブジェクト、Entity 参照の確認

**A1 完了時の追加確認**: ポータルが実際に生成され、ポータル使用でフロアが遷移し、遷移後にプレイヤーが新フロアの歩行可能タイルへ配置されること。この経路はこれまで実行されていなかったため、必ず手動で確認する。

## 7. 中断・ロールバック方針

- 各フェーズの途中では旧 API を残し、移行先がテストを通ってから削除する
- 旧 API 削除は移行コミットと分離する
- 1 つのコミットで、フロアデータ境界（B）とプレゼンテーション境界（C）を同時に変更しない
- E2E 失敗時は次フェーズへ進まず、最後に成功したフェーズを基準線とする
- A1 は挙動を復旧させる変更であるため、E2E が失敗した場合は原因を切り分けてから進む（revert して先送りにしない）

## 8. スコープ外

- 新しい画像・音声資産の制作
- ゲームバランス調整（C2 は値の置き場所のみを変更し、値は変えない）
- 全 System からの `Engine.instance` 一括排除
- EventSystem の全面的な型付きイベントバス化
- RendererSystem の全面再実装
- R7 の機能実装そのもの（Room ロック、スキャン、敵タイプ拡張）

## 9. 未決事項

実装前またはレビューゲートで確認が必要。

1. **A2**: `viewRadius` と front / side 半径の対応付け（案 1〜3）
2. **B1**: RoomId のスコープ（フロア込み永続 ID / 複合キー / 不透明 ID）— **B フェーズ着手前に決定が必要**
3. **B3**: Doorway 検証の実行方針（常時警告 / 開発時のみ / 生成テストのみ）
4. **B4**: `placedObstacles` / `placedItems` / `placedEnemies` を R7-6 のフロア再訪で使うか
5. **C2**: `attackPower` を CombatSystem へ接続するか、削除するか
6. **C2**: ステータス変更がゲームバランスへ影響しない範囲の確認方法

`decisions` や `spec` へ反映するのは、ユーザー確認後とする。

## 10. 関連文書

- `docs/REFACTORING_ROADMAP.md`
- `docs/TESTING_ROADMAP.md`
- `docs/RENDERING_ENGINE_DESIGN.md`
- `docs/SCAN_FEATURE_SPEC_DRAFT.md`
- AI Cortex: `projects/salvage-mechanoid/context`
- AI Cortex: `projects/salvage-mechanoid/spec`
