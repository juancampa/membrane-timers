const { DateTime, Duration } = require('luxon');
const _ZERO = '0'.charCodeAt(0);
const _NINE = '9'.charCodeAt(0);

// Helper function that finds the last number in a string
function findLastNumber(str) {
  for (let i = str.length - 1; i >= 0; --i) {
    const code = str.charCodeAt(i);
    if (code >= _ZERO && code <= _NINE) {
      return i;
    }
  }
  return -1;
}

// Taken from https://stackoverflow.com/a/1830632/653799
function isNumber(str) {
  return !isNaN(parseFloat(str)) && isFinite(str);
}

// Possible week days representations
const weekdays = {
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
  sunday: 7, sun: 7,
};

// Possible month representations
const months = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const durationUnits = {
  millisecond: 'milliseconds',
  msec: 'milliseconds', ms: 'milliseconds',
  second: 'seconds', seconds: 'seconds', sec: 'seconds', secs: 'seconds', s: 'seconds',
  min: 'minute', mins: 'minutes', minute: 'minutes', minutes: 'minutes', m: 'minutes',
  hour: 'hours', hours: 'hours', h: 'hour',
  day: 'days', days: 'days', d: 'days',
  week: 'weeks', weeks: 'weeks', w: 'weeks',
  mo: 'months', mon: 'months', month: 'months', months: 'months',
  quarters: 'quarters', quarter: 'quarters', q: 'quarters',
  years: 'years', year: 'years', y: 'years',
};

const hms = (hour, minute, second) => ({ hour, minute, second, millisecond: 0 });
const ymd = (year, month, day) => ({ year, month, day });
const outOfRange = () => { throw new Error('Time out of rage'); };

// Order that determines significance of units
const keyOrder = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond'];

// Give a DateTime spec object, generates an object that matches the spec but
// bound to the future  by increasing the element one greater than the greater
// specified. If the spec specifies a day, but that the is in the pass, increase
// the month by one from the current time.
const inTheFuture = (spec) => {
  const now = DateTime.local();
  const date = DateTime.fromObject(spec);
  if (date < now && spec.year === undefined) {
    for (let i = 0; i < keyOrder.length; ++i) {
      const key = keyOrder[i];
      if (spec[key] !== undefined) {
        return {
          ...spec,
          [keyOrder[i - 1]]: now[keyOrder[i - 1]] + 1,
        };
      }

      // Weekdays are handled differently
      if (key === 'day') {
        if (spec['weekday']) {
          return {
            ...spec,
            weekday: undefined,
            day: date.day + 7,
          };
        }
      }
    }
  }
  return spec;
};

function parseTimeOfDay(str) {
  const matches = str.match(/^(\d{1,2})(?::?(\d{1,2}))?(?::?(\d{1,2}))?(am|pm)?$/);
  if (!matches) {
    return null;
  }
  let [, h, m, s, p] = matches;
  h = h && parseInt(h, 10);
  m = m ? parseInt(m, 10) : 0;
  s = s ? parseInt(s, 10) : 0;
  if (m < 0 || m > 59) {
    outOfRange();
  }
  if (s < 0 || s > 59) {
    outOfRange();
  }

  // am/pm
  if (p) {
    if (h < 1 || h > 12) {
      outOfRange();
    }
    if (h === 12) {
      h = (p === 'am' ? 0 : 12);
    } else if (p === 'pm') {
      h += 12;
    }
    return hms(h, m, s);
  }

  // 24h
  if (h > 23 || h < 0) {
    outOfRange();
  }
  return hms(h, m, s);
}

function toDateTimeSpec(str) {
  if (typeof str === 'object') {
    return str;
  }
  if (typeof str !== 'string') {
    throw new Error('Expected an object or string');
  }

  str = str.toLowerCase().trim();
  const weekday = weekdays[str];
  if (weekday) {
    return { weekday };
  }

  const yearMatch = str.match(/^\d{4}$/);
  if (yearMatch) {
    return { year: parseInt(str, 10) };
  }

  // Parse year/month/day (e.g. 5/20, May/20, may/20, may-20, 2010-5/20)
  const ymdMatch = str.match(/^(?:(\d{4})[-/])?([a-zA-Z0-9]{1,9})[-/](\d{1,2})$/);
  if (ymdMatch) {
    let [, y, m, d] = ymdMatch;
    const isNumMonth = /^\d{1,2}$/.test(m);
    if (isNumMonth) {
      m = parseInt(m, 10);
      if (m < 1 || m > 12) {
        throw new Error('Month out of range');
      }
    } else if (months[m]) {
      m = months[m];
    } else {
      throw new Error('Invalid month');
    }
    d = parseInt(d, 10);
    y = y ? parseInt(y, 10) : undefined;
    return ymd(y, m, d);
  }

  const month = months[str];
  if (month) {
    return { month };
  }

  const timeOfDay = parseTimeOfDay(str);
  if (timeOfDay) {
    return timeOfDay;
  }

  return DateTime.fromISO(str).toObject();
}

function toDuration(str) {
  if (typeof str === 'object') {
    return Duration.fromObject(str);
  }
  if (typeof str !== 'string') {
    throw new Error('Expected an object or string');
  }

  // Try to parse <value><unit>
  const lastNumber = findLastNumber(str);
  let value = 1;
  if (lastNumber >= 0) {
    value = str.substr(0, lastNumber + 1);
    if (isNumber(value)) {
      let key = str.substr(lastNumber + 1).trim();
      if (/^[a-z]+$/.test(key)) {
        // Allow abbreviations
        const unit = durationUnits[key];
        if (!unit) {
          throw new Error(`Invalid unit "${key}"`);
        }

        return Duration.fromObject({ [unit]: parseFloat(value) });
      }
    }
  }
  return Duration.fromISO(str);
}

// Used to create timers
class Scheduler {
  constructor(setTimer) {
    this.DateTime = DateTime;
    this.Duration = Duration;
    this.setTimer = setTimer;
  }

  on(datetime) {
    const spec = toDateTimeSpec(datetime);
    return new Timer(spec, [], this.setTimer);
  }

  at(datetime) {
    const spec = toDateTimeSpec(datetime);
    return new Timer(spec, [], this.setTimer);
  }

  now() {
    return new Timer(DateTime.local().toObject(), [], this.setTimer);
  }

  after(duration) {
    return this.now().plus(duration);
  }

  every(duration) {
    return this.after(duration).every(duration);
  }
}

// Merges two DateTime specs and makes sure they don't contradict each other
const merge = (a, b) => {
  if (!a) {
    return { ... b };
  }
  for (let k of Object.keys(b)) {
    if (a[k] && a[k] !== b[k]) {
      throw new Error(`More than one value specified for timer's ${k}`);
    }
  }
  return { ...a, ...b };
};

// Timer without a repeat interval
class Timer {
  constructor(time, offsets = [], setTimer) {
    this.time = time;
    this.offsets = offsets;
    this.setTimer = setTimer;
  }

  get triggerTime() {
    return this._collapseTime().toUTC().toISO();
  }

  clone(change) {
    return Object.assign(new Timer(), this, change);
  }

  on(datetime) {
    return this.clone({ time: merge(this.time, toDateTimeSpec(datetime)) });
  }

  at(datetime) {
    return this.clone({ time: merge(this.time, toDateTimeSpec(datetime)) });
  }

  plus(duration) {
    return this.clone({ offsets: [...this.offsets, toDuration(duration)] });
  }

  minus(duration) {
    return this.clone({ offsets: [...this.offsets, toDuration(duration).negate()] });
  }

  every(duration) {
    return new RepeatTimer(this._collapseTime(), [toDuration(duration)], this.setTimer, this.key);
  }

  _collapseTime() {
    let time = this.time ? DateTime.fromObject(inTheFuture(this.time)) : DateTime.local();
    for (let offset of this.offsets) {
      time = time.plus(offset);
    }
    if (time.invalid !== null) {
      throw new Error('Invalid time: ' + time.invalid);
    }
    return time;
  }

  withKey(key) {
    return this.clone({ key });
  }

  call(handlerName, context) {
    return this.setTimer({
      key: this.key,
      delay: (this._collapseTime().toMillis() - DateTime.local().toMillis()) / 1000,
      handlerName,
      context,
    });
  }
}

// Timer with a repreat interval. Intervals are stored as a list of durations
// which are meant to be evaluated every time the timer fires to calculate the
// next occurrance. This allows us to use calendar math (e.g. every week, every
// month, every month minus one day, etc);
class RepeatTimer {
  constructor(time, offsets, setTimer, key) {
    this.time = time;
    this.offsets = offsets;
    this.setTimer = setTimer;
    this.key = key;
  }

  clone(change) {
    return Object.assign(new RepeatTimer(), this, change);
  }

  plus(duration) {
    return this.clone({ offsets: [...this.offsets, toDuration(duration)] });
  }

  minus(duration) {
    return this.clone({ offsets: [...this.offsets, toDuration(duration).negate()] });
  }

  withKey(key) {
    return this.clone({ key });
  }

  call(handlerName, context) {
    return this.setTimer({
      key: this.key,
      delay: (this.time.toMillis() - DateTime.local().toMillis()) / 1000,
      intervalOffsets: this.offsets.map((i) => i.toObject()),
      handlerName,
      context,
    });
  }
}

exports.Scheduler = Scheduler;
