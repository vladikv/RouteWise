import { Injectable, signal } from '@angular/core';

export type ToastKind = 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastRequest {
  message: string;
  kind: ToastKind;
  action?: ToastAction;
  /** How long it stays when nobody hovers or focuses it; defaults to {@link TOAST_DURATION_MS}. */
  durationMs?: number;
  /** Move keyboard focus to the action button when the toast appears (for a time-limited Undo). */
  focus?: boolean;
}

export interface Toast extends ToastRequest {
  id: number;
}

/** How long a toast stays when nobody hovers or focuses it. */
export const TOAST_DURATION_MS = 5000;

interface Timer {
  handle: ReturnType<typeof setTimeout> | null;
  remaining: number;
  startedAt: number;
}

/** Short messages that dismiss themselves; shown by `<app-toast-outlet>`, which sits once in the shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly list = signal<Toast[]>([]);
  readonly toasts = this.list.asReadonly();

  private readonly timers = new Map<number, Timer>();
  private nextId = 0;

  show(request: ToastRequest): number {
    const id = this.nextId++;
    this.list.update((current) => [...current, { ...request, id }]);
    this.timers.set(id, {
      handle: null,
      remaining: request.durationMs ?? TOAST_DURATION_MS,
      startedAt: 0,
    });
    this.resume(id);
    return id;
  }

  dismiss(id: number): void {
    this.pause(id);
    this.timers.delete(id);
    this.list.update((current) => current.filter((toast) => toast.id !== id));
  }

  /** Stops the countdown (pointer over or focus inside the toast) and keeps the time left. */
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle == null) {
      return;
    }
    clearTimeout(timer.handle);
    timer.handle = null;
    timer.remaining = Math.max(timer.remaining - (Date.now() - timer.startedAt), 0);
  }

  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer || timer.handle !== null) {
      return;
    }
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }
}
