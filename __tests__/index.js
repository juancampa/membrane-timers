import { Scheduler } from '../';
import { Settings, DateTime } from 'luxon';

// Freeze time for testing
Settings.now = () => DateTime.fromJSDate(new Date('1987-10-16T00:00:00.000Z'));

const makeScheduler = () => {
  const cb = jest.fn();
  const scheduler = new Scheduler(cb);
  return { scheduler, cb };
}

describe('Scheduler', () => {
  it('Generates timers that call the provided function on .call()', () => {
    const { cb, scheduler } = makeScheduler();
    scheduler.now().call();

    expect(cb).toHaveBeenCalledTimes(1);
  });

  describe('after', () => {
    it('After generates a timer offset from now', () => {
      const { cb, scheduler } = makeScheduler();
      const t1 = scheduler.after('10m');
      expect(t1.triggerTime).toBe('1987-10-16T00:10:00.000Z');
    });
  });
});

describe('Timer/RepeatTimer', () => {
  describe('call', () => {
    it('Passes the key, if any', () => {
      const { cb, scheduler } = makeScheduler();
      scheduler.after('1m').withKey('timer-key-0').call('handler');
      scheduler.every('1m').withKey('timer-key-1').call('handler');
      scheduler.after('1m').call('handler');
      scheduler.every('1m').call('handler');
      expect(cb.mock.calls[0][0]).toMatchObject({ key: 'timer-key-0' });
      expect(cb.mock.calls[1][0]).toMatchObject({ key: 'timer-key-1' });
      expect(cb.mock.calls[2][0]).toMatchObject({ key: undefined });
      expect(cb.mock.calls[3][0]).toMatchObject({ key: undefined });
    });

    it('Passes delay in seconds', () => {
      const { cb, scheduler } = makeScheduler();
      scheduler.after('5m').call('handler');
      scheduler.after('2d').call('handler');
      scheduler.every('5m').call('handler');
      scheduler.every('2d').call('handler');
      expect(cb.mock.calls[0][0]).toMatchObject({ delay: 5 * 60 });
      expect(cb.mock.calls[1][0]).toMatchObject({ delay: 2 * 24 * 60 * 60 });
      expect(cb.mock.calls[2][0]).toMatchObject({ delay: 5 * 60 });
      expect(cb.mock.calls[3][0]).toMatchObject({ delay: 2 * 24 * 60 * 60 });
    });
  });

  describe('Durations (.plus and .minus)', () => {
    it('Throws on unknown units', () => {
      const { cb, scheduler } = makeScheduler();
      expect(() => scheduler.now().plus('10blips').call()).toThrow('Invalid unit');
    });

    it('Accepts all minute variation', () => {
      const { cb, scheduler } = makeScheduler();
      const t1 = scheduler.now().plus('10m');
      const t2 = scheduler.now().plus('10min');
      const t3 = scheduler.now().plus('10mins');
      const t4 = scheduler.now().plus('10minute');
      const t5 = scheduler.now().plus('10minutes');

      expect(t1.triggerTime).toBe('1987-10-16T00:10:00.000Z');
      expect(t2.triggerTime).toBe('1987-10-16T00:10:00.000Z');
      expect(t3.triggerTime).toBe('1987-10-16T00:10:00.000Z');
      expect(t4.triggerTime).toBe('1987-10-16T00:10:00.000Z');
      expect(t5.triggerTime).toBe('1987-10-16T00:10:00.000Z');
    });

    it('Accepts all hour variations', () => {
      const { cb, scheduler } = makeScheduler();
      const t1 = scheduler.now().plus('10h');
      const t2 = scheduler.now().plus('10hours');

      expect(t1.triggerTime).toBe('1987-10-16T10:00:00.000Z');
      expect(t2.triggerTime).toBe('1987-10-16T10:00:00.000Z');
    });

    it('Months use calendar math', () => {
      const { cb, scheduler } = makeScheduler();
      const t1 = scheduler.now().plus('1mon');
      const t2 = scheduler.now().plus('2mon');
      const t3 = scheduler.now().plus('10mon');

      expect(t1.triggerTime).toBe('1987-11-16T01:00:00.000Z'); // DST
      expect(t2.triggerTime).toBe('1987-12-16T01:00:00.000Z'); // DST
      expect(t3.triggerTime).toBe('1988-08-16T00:00:00.000Z');
    });

    it('Accepts whitespace between value and unit', () => {
      const { cb, scheduler } = makeScheduler();
      const t1 = scheduler.now().plus('10 m');

      expect(t1.triggerTime).toBe('1987-10-16T00:10:00.000Z');
    });
  });
});

