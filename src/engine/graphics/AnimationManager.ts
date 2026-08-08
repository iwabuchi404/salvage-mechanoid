export type EasingFn = (t: number) => number;

export const Easing = {
  linear: (t: number): number => t,
  easeIn: (t: number): number => t * t,
  easeOut: (t: number): number => 1 - (1 - t) * (1 - t),
  easeInOut: (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

export interface AnimationTrack {
  id: string;
  duration: number;
  easing: EasingFn;
  onUpdate: (progress: number) => void;
  onComplete?: () => void;
}

interface ActiveTrack extends AnimationTrack {
  elapsed: number;
}

export class AnimationManager {
  private tracks: Map<string, ActiveTrack> = new Map();

  animate(track: AnimationTrack): void {
    if (this.tracks.has(track.id)) {
      this.tracks.delete(track.id);
    }
    this.tracks.set(track.id, { ...track, elapsed: 0 });
  }

  cancel(id: string): void {
    this.tracks.delete(id);
  }

  update(deltaTime: number): void {
    if (this.tracks.size === 0) return;

    const completed: string[] = [];

    for (const [id, track] of this.tracks) {
      track.elapsed += deltaTime;

      const rawProgress = Math.min(track.elapsed / track.duration, 1);
      const easedProgress = track.easing(rawProgress);

      track.onUpdate(easedProgress);

      if (rawProgress >= 1) {
        track.onComplete?.();
        completed.push(id);
      }
    }

    for (const id of completed) {
      this.tracks.delete(id);
    }
  }

  isAnimating(id: string): boolean {
    return this.tracks.has(id);
  }

  getActiveCount(): number {
    return this.tracks.size;
  }

  clear(): void {
    this.tracks.clear();
  }

  destroy(): void {
    this.tracks.clear();
  }
}
