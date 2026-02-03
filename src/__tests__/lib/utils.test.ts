import { cn, formatDate, formatNumber, debounce, throttle, generateId, clamp, slugify, formatFileSize } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('formatDate', () => {
  it('formats a date object', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toMatch(/Jan 15, 2024/);
  });

  it('formats a date string', () => {
    expect(formatDate('2024-01-15')).toMatch(/Jan 15, 2024/);
  });
});

describe('formatNumber', () => {
  it('formats small numbers', () => {
    expect(formatNumber(123)).toBe('123');
  });

  it('formats thousands', () => {
    expect(formatNumber(1234)).toBe('1.2K');
  });

  it('formats millions', () => {
    expect(formatNumber(1234567)).toBe('1.2M');
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  it('delays function execution', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels previous calls', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  jest.useFakeTimers();

  it('limits function calls', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    throttledFn();
    throttledFn();

    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(100);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('generateId', () => {
  it('generates a string of default length', () => {
    expect(generateId()).toHaveLength(12);
  });

  it('generates a string of specified length', () => {
    expect(generateId(8)).toHaveLength(8);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('clamp', () => {
  it('clamps value to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps value to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('returns value if within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('slugify', () => {
  it('converts text to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! @World#')).toBe('hello-world');
  });

  it('handles multiple spaces', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 Bytes');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
  });

  it('handles zero', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });
});
