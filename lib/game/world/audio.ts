/**
 * BGM・効果音の再生口。
 * 音源ファイルを置けば鳴る設計で、ファイルが無い・自動再生がブロックされた場合は黙って無視する。
 *   BGM: public/audio/bgm/<id>.mp3   （ループ再生）
 *   SE : public/audio/se/<id>.wav
 */
export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private bgmId: string | null = null;

  playBgm(id: string | null): void {
    if (id === this.bgmId) return;
    this.stopBgm();
    this.bgmId = id;
    if (!id) return;
    const audio = new Audio(`/audio/bgm/${id}.mp3`);
    audio.loop = true;
    audio.volume = 0.5;
    audio.play().catch(() => undefined);
    this.bgm = audio;
  }

  stopBgm(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
    this.bgmId = null;
  }

  playSe(id: string): void {
    const audio = new Audio(`/audio/se/${id}.wav`);
    audio.volume = 0.6;
    audio.play().catch(() => undefined);
  }
}
