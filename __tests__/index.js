import { Scheduler } from '../';

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
});

describe('Timer', () => {
  // TODO: 
});
