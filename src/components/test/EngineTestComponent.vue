<template>
  <div class="engine-test">
    <h2>エンジンテスト</h2>
    <div ref="gameCanvas" width="800" height="600"></div>
  </div>
</template>

<script>
import { Engine } from '@/engine/Engine';
import { RendererSystem } from '@/engine/graphics/RendererSystem';
import { EntitySystem } from '@/engine/entity/EntitySystem';
import { EventSystem } from '@/engine/events/EventSystem';
import { Entity } from '@/engine/entity/Entity';
import { TransformComponent } from '@/engine/entity/components/Transform';
import { SpriteComponent } from '@/engine/entity/components/Sprite';
import * as PIXI from 'pixi.js';

export default {
  name: 'EngineTestComponent',

  data() {
    return {
      engine: null,
    };
  },

  mounted() {
    this.initializeEngine();
  },

  beforeUnmount() {
    if (this.engine) {
      // エンジンを停止
      // engine.stop() メソッドを作成していない場合は実装が必要
      this.engine.stop();
    }
  },

  methods: {
    async initializeEngine() {
      try {
        const canvas = this.$refs.gameCanvas;
        if (!canvas) {
          console.error('Canvas element not found');
          return;
        }

        // エンジンのインスタンスを取得
        this.engine = Engine.instance;

        // システムを登録
        const rendererSystem = new RendererSystem();
        rendererSystem.setCanvas(canvas);
        this.engine.registerSystem('renderer', rendererSystem);

        const entitySystem = new EntitySystem();
        this.engine.registerSystem('entity', entitySystem);

        const eventSystem = new EventSystem();
        this.engine.registerSystem('event', eventSystem);

        // エンジンを初期化
        await this.engine.initialize();

        // テストエンティティを作成
        await this.createTestEntities();

        // エンジンを開始
        this.engine.start();

        console.log('Engine initialized successfully');

        if (rendererSystem && rendererSystem.getApp()) {
          const app = rendererSystem.getApp();

          console.log('PIXI stage children count:', app.stage.children.length);
          for (let i = 0; i < app.stage.children.length; i++) {
            console.log(`Stage child ${i}:`, app.stage.children[i]);
          }
        } else {
          console.log('PIXI stage not found');
        }
      } catch (error) {
        console.error('Failed to initialize engine:', error);
      }

      const rendererSystem = this.engine.getSystem('renderer');
      if (rendererSystem) {
        // すべてのレイヤーが可視であることを確認
        ['background', 'terrain', 'objects', 'characters', 'effects', 'ui'].forEach((layerName) => {
          const layer = rendererSystem.getLayer(layerName);
          if (layer) {
            layer.visible = true;
            console.log(`Layer ${layerName} visibility set to true`);
          } else {
            console.warn(`Layer ${layerName} not found`);
          }
        });
      }
    },

    async createTestEntities() {
      const entitySystem = this.engine.getSystem('entity');
      if (!entitySystem) {
        console.warn('EntitySystem not found');
        return;
      }

      // テスト用のエンティティを作成
      const entity = new Entity('test_entity', 'test');

      // トランスフォームコンポーネントを追加
      const transform = new TransformComponent(5, 3);
      entity.addComponent(transform);

      // スプライトコンポーネントを追加
      const sprite = new SpriteComponent('./robo01bk_r.png');
      entity.addComponent(sprite);

      // エンティティを登録
      entitySystem.registerEntity(entity);
    },
  },
};
</script>

<style scoped>
.engine-test {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

canvas {
  background-color: #202020;
  border: 1px solid #444;
  max-width: 100%;
}
</style>
