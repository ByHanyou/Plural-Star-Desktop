export interface ImportProgress {
  label: string;
  phase: number;
  phases: number;
  done?: number;
  total?: number;
  stopping?: boolean;
}

export type ProgressSetter = (p: ImportProgress) => void;

export class ImportStopped extends Error {
  constructor() {
    super('import stopped by user');
    this.name = 'ImportStopped';
  }
}

export const isImportStopped = (e: any): boolean => e?.name === 'ImportStopped';

export class ImportControl {
  private cancelled = false;
  private phaseIndex = 0;
  private phaseCount = 0;
  private currentLabel = '';
  readonly completed: string[] = [];

  constructor(private setProgress: ProgressSetter) {}

  plan(phaseCount: number): void {
    this.phaseCount = Math.max(0, phaseCount);
    this.phaseIndex = 0;
  }

  begin(label: string): void {
    if (label && label !== this.currentLabel) {
      if (this.currentLabel) this.end();
      this.currentLabel = label;
      this.emit();
    }
    if (this.cancelled) throw new ImportStopped();
  }

  step(done: number, total: number, label?: string): void {
    if (label) this.currentLabel = label;
    this.emit(done, total);
  }

  end(): void {
    if (this.currentLabel) this.completed.push(this.currentLabel);
    this.phaseIndex = Math.min(this.phaseIndex + 1, this.phaseCount || this.phaseIndex + 1);
    this.emit();
  }

  shouldStop(): boolean {
    return this.cancelled;
  }

  requestStop(): void {
    this.cancelled = true;
    this.emit();
  }

  get stopped(): boolean {
    return this.cancelled;
  }

  private emit(done?: number, total?: number): void {
    this.setProgress({
      label: this.currentLabel,
      phase: this.phaseIndex,
      phases: this.phaseCount,
      done,
      total,
      stopping: this.cancelled,
    });
  }
}

export const progressFraction = (p: ImportProgress | null): number | null => {
  if (!p || p.phases <= 0) return null;
  const inner = p.total && p.total > 0 ? Math.min(1, Math.max(0, (p.done || 0) / p.total)) : 0;
  return Math.min(0.95, Math.max(0, (p.phase + inner) / p.phases));
};
