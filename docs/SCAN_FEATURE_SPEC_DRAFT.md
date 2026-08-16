# スキャン機能 仕様案（ドラフト）

最終更新: 2026-08-15

> **位置づけ**: この文書は仕様案（ドラフト）です。ユーザー確認後に確定分を spec へ反映し、本ドキュメントは decisions/ へ移行または破棄します。

## 1. 目的

R6 で整備した FOV / 可視性 / Room データ境界を活用し、HEAD パーツによる索敵・分析機能を実装する。

プレイヤーが装備した HEAD パーツの `scanPower` に応じて、視界内の敵の情報量が距離に応じて段階的に開示される。スキャンスキル使用時は視界半径と scanPower を一時的に拡張する。

## 2. 前提となる既存境界

| 境界 | 整備フェーズ | 本機能が利用する箇所 |
| --- | --- | --- |
| FOVSystem | R6 | `viewRadius`、`isTileVisible`、`entity_visibility_changed` |
| VisibilityRule | R6 | Entity 可視性判定、差分計算 |
| RoomId / Room / Doorway | R5 | `tile_visibility_changed` の `roomId`、`getRoomAtPosition` |
| PartsSystem | 既存 | `getLoadout().head`、`getAvailableSkills()` |
| EnemyPresentation | R2 | `entity_visibility_changed` 購読、表示制御 |

## 3. 確定仕様

### 3.1 発動方法

- **パッシブ常時効果**: HEAD パーツ装備中、常にスキャン効果が有効。視界内の敵に対して `scanPower` に応じた情報が開示される。
- **スキル拡張**: HEAD パーツの「スキャン」スキル使用時、視界半径 +2 マス、scanPower +2（一時的）。効果はスキル使用ターン中のみ。

### 3.2 scanPower 定義

- HEAD パーツ固有のステータス項目 `scanPower: number` を `RobotPart` へ追加。
- HEAD 以外のスロットでは `scanPower` を使用しない（0 扱い）。
- パーツごとに固定値。スキル使用で一時的に +2。
- HEAD 未装備時の scanPower は 0（スキャン機能無効、現状の FOV 挙動を維持）。

#### 初期値案（ユーザー確認対象）

| パーツ | rarity | scanPower | 備考 |
| --- | --- | --- | --- |
| 標準センサー | COMMON | 1 | 初期装備 |
| 強化センサー | UNCOMMON | 2 | 中盤 |
| 広域センサー | RARE | 3 | 終盤 |
| 分析ユニット | EPIC | 4 | ボス戦向け |

### 3.3 スキャン範囲

- 現在の FOV 形状（方向依存の視野）を維持。
- スキャンスキル使用時のみ視界半径を +2 マス。
- パッシブ効果のみでは視界半径は拡張しない（情報開示のみ）。

### 3.4 距離による情報段階

プレイヤーと敵のタイル距離（マンハッタン距離）と `scanPower` により、開示情報を 4 段階で判定する。

| 条件 | 開示情報 |
| --- | --- |
| `scanPower >= 距離` かつ 距離 <= 1 | 全情報（種別 / HP / 最大HP / 攻撃力 / 防御力 / 行動 / レベル） |
| `scanPower >= 距離` かつ 距離 <= 2 | HP / 最大HP / 種別 / 攻撃力 / レベル |
| `scanPower >= 距離` かつ 距離 <= 4 | HP / 最大HP / 種別 / レベル |
| `scanPower >= 距離` かつ 距離 <= 6 | 種別 / レベルのみ |
| `scanPower < 距離` | シルエットのみ（種別も非表示） |

> **判定の意味**: scanPower が高いほど、遠距離でもより詳細な情報が見える。scanPower=4 なら距離4まで全情報、距離5-6は HP+種別、距離7+はシルエット。

### 3.5 スキャン範囲外の敵表示

- FOV 内だが scanPower 不足の敵はシルエットのみ表示。
- 種別、HP、その他ステータスは非表示。
- 現状の `entity_visibility_changed` による表示/非表示制御を維持しつつ、スキャン情報レベルを追加で制御する。

### 3.6 Room 種別表示

- スキャン範囲内（FOV 内）のタイルについて、所属 Room の種別（NORMAL / BOSS / TREASURE / EVENT / SHOP / ENTRANCE / EXIT）を表示。
- `tile_visibility_changed` イベントの `roomId` と `WorldSystem.getRoomById` を活用。
- Room に属さない廊下タイルは「廊下」と表示。

### 3.7 スキャンスキル仕様

仕様書 `ROBOT_PARTS_SYSTEM_SPECIFICATION.md` に準拠。

| 項目 | 値 |
| --- | --- |
| スキル名 | スキャン |
| エネルギーコスト | 3 |
| クールダウン | 2 ターン |
| 効果 | 視界 +2 マス、scanPower +2（敵情報表示強化） |
| ターン消費 | あり |
| 持続 | スキル使用ターン中のみ |

### 3.8 UI 表示

- **選択時ウィンドウ**: 敵タイル選択/クリック時にステータスウィンドウを表示。
- 現在の `setOnEnemySelect` コールバックを拡張し、スキャン情報レベルに応じた情報を渡す。
- スキャン範囲外（シルエットのみ）の敵を選択した場合は「不明」と表示。
- Room 種別はタイル選択時または FOV 更新時に UI へ通知（詳細は実装計画で確定）。

## 4. 未決事項

1. **scanPower 初期値**: 3.2 の初期値案でよいか
2. **Room 種別の UI 表示タイミング**: タイル選択時のみか、FOV 更新時の常時表示か
3. **スキャンスキルの scanPower 増加量**: +2 でよいか
4. **Enemy 表示名**: 現状は EnemyType 文字列のみ。表示名（「偵察型」「兵士型」など）を追加するか
5. **スキャン情報のキャッシュ**: スキャン済みの敵情報を探索状態として保持するか（一度スキャンした敵の情報を記憶するか）

## 5. 影響箇所

### 新規追加

| 対象 | 内容 |
| --- | --- |
| `RobotPart.scanPower` | HEAD パーツ固有ステータスフィールド |
| `ScanInfoLevel` 型 | 情報段階を表す enum（FULL / PARTIAL_A / PARTIAL_B / MINIMAL / UNKNOWN） |
| `ScanResult` 型 | スキャン結果のデータ構造（敵情報 + Room 種別） |
| `ScanSystem` または `ScanService` | スキャン能力判定と情報開示レベル計算 |
| `Enemy.getScannableStats()` | Enemy のステータス公開 API |
| `Enemy.displayName` | （未決）表示名プロパティ |

### 既存改修

| 対象 | 改修内容 |
| --- | --- |
| `FOVSystem` | スキャンスキル使用時の視界半径一時拡張 |
| `PartsSystem` | `getScanPower()` 追加、HEAD パーツの scanPower 集計 |
| `SkillSystem` | スキャンスキルの効果適用（視界拡張 + scanPower 増加） |
| `EnemyPresentation` | スキャン情報レベルに応じた表示制御（シルエット切り替え） |
| `GameScreen.vue` | `setOnEnemySelect` 拡張、スキャン情報ウィンドウ表示 |
| `Game.ts` | スキャン機能の組み立て、イベント配線 |

## 6. 実装計画（案）

リファクタリングロードマップの原則（1 コミット 1 責務境界、新旧併存→旧削除）に準拠。

### S0: 契約テスト追加（先行）

- `Enemy.getScannableStats()` の契約テスト
- `ScanInfoLevel` 判定の純粋関数テスト
- `PartsSystem.getScanPower()` の契約テスト
- 既存テストがすべて通ることを確認

### S1: scanPower データ境界を追加

- `RobotPart.scanPower` フィールド追加（optional、デフォルト 0）
- `PartsSystem.getScanPower()` 追加
- 既存 HEAD パーツ定義へ scanPower を追加
- 型検査・ビルド成功

### S2: Enemy ステータス公開 API を追加

- `Enemy.getScannableStats()` 追加（種別 / HP / 最大HP / 攻撃力 / 防御力 / 行動 / レベル）
- `Enemy.displayName` （未決事項により追加判定）
- 既存の `getEnemyType()` 等に影響なし

### S3: スキャン情報レベル判定を純粋関数で実装

- `ScanInfoLevel` enum と `resolveScanInfoLevel(scanPower, distance)` を実装
- `ScanResult` 型定義
- 純粋関数として単体テスト可能

### S4: ScanSystem（または ScanService）を追加

- スキャン能力判定と情報開示レベル計算を集約
- FOVSystem と連携して視界内の敵のスキャン情報レベルを算出
- Room 種別取得（WorldSystem 経由）
- イベント発行（`scan_result_updated` など）

### S5: スキャンスキル実装

- SkillSystem へスキャンスキル効果を追加
- 視界半径 +2 マス、scanPower +2 の一時適用
- クールダウン管理
- スキル使用後の FOV 再計算トリガー

### S6: Presentation 連携

- `EnemyPresentation` がスキャン情報レベルに応じて表示を切り替え
- シルエット表示の切り替え
- `entity_visibility_changed` にスキャン情報レベルを含めるか、別イベントで通知

### S7: UI 表示

- `GameScreen.vue` の `setOnEnemySelect` 拡張
- スキャン情報レベルに応じたステータスウィンドウ表示
- Room 種別表示
- 「不明」表示の処理

### S8: 統合テスト・E2E

- スキャン機能の E2E シナリオ追加
- HEAD パーツ装備/未装備での挙動差
- スキャンスキル使用時の視界拡張と情報レベル変化
- ゲーム開始〜敵スキャン〜情報確認の一連フロー

### レビューゲート

S0〜S4 完了時点で第1レビュー（データ境界と判定ロジック）。
S5〜S7 完了時点で第2レビュー（スキルとUI）。
S8 完了時点で最終確認。

## 7. 関連文書

- `docs/REFACTORING_ROADMAP.md` R6 セクション
- `ROBOT_PARTS_SYSTEM_SPECIFICATION.md` HEAD スキル
- `docs/TESTING_ROADMAP.md` P1: FOV / Parts / Skill
