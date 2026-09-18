import Queue from 'queue-promise';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { releaseQueueSlotAfter } from './useQuery';

describe('releaseQueueSlotAfter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves as soon as the request resolves', async () => {
    const settled = vi.fn();
    releaseQueueSlotAfter(Promise.resolve('data'), 1000).then(settled);

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalled();
  });

  it('resolves when the request rejects, so a failed request does not hold the slot', async () => {
    const settled = vi.fn();
    releaseQueueSlotAfter(Promise.reject(new Error('network')), 1000).then(settled);

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toHaveBeenCalled();
  });

  it('resolves after the timeout when the request never settles', async () => {
    const settled = vi.fn();
    releaseQueueSlotAfter(new Promise(() => {}), 1000).then(settled);

    await vi.advanceTimersByTimeAsync(999);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toHaveBeenCalled();
  });

  it('lets a serial queue continue after a request that never settles', async () => {
    // This is the dashboard setup: one request at a time, shared by every chart on the
    // page. Without the timeout the second chart never gets to run its query - it just
    // keeps showing its loader.
    const queue = new Queue({ concurrent: 1, interval: 0, start: true });
    const started: string[] = [];

    queue.enqueue(() => {
      started.push('stalled');
      return releaseQueueSlotAfter(new Promise(() => {}), 1000);
    });
    queue.enqueue(() => {
      started.push('next');
      return releaseQueueSlotAfter(Promise.resolve(), 1000);
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(started).toEqual(['stalled']);

    // the timeout releases the slot, then the queue needs its own ticks to dequeue
    await vi.advanceTimersByTimeAsync(1000);
    await vi.runOnlyPendingTimersAsync();
    expect(started).toEqual(['stalled', 'next']);
  });
});
