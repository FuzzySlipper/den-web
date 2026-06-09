import { describe, expect, it } from 'vitest';
import { asRecord, firstString, parseJsonRecord, stringFromUnknown } from './jsonRecord';

describe('asRecord', () => {
  it('returns plain objects', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
  });

  it('rejects arrays, primitives, and null', () => {
    expect(asRecord([1, 2])).toBeNull();
    expect(asRecord('str')).toBeNull();
    expect(asRecord(5)).toBeNull();
    expect(asRecord(null)).toBeNull();
  });
});

describe('stringFromUnknown', () => {
  it('trims and returns non-empty strings', () => {
    expect(stringFromUnknown('  hello  ')).toBe('hello');
  });

  it('returns null for empty/whitespace strings and non-strings', () => {
    expect(stringFromUnknown('   ')).toBeNull();
    expect(stringFromUnknown(42)).toBeNull();
    expect(stringFromUnknown(null)).toBeNull();
  });
});

describe('firstString', () => {
  it('returns the first non-empty string scanning records then keys in order', () => {
    const records = [{ a: '', b: 'second' }, { a: 'third' }];
    expect(firstString(records, ['a', 'b'])).toBe('second');
  });

  it('skips null records', () => {
    expect(firstString([null, { x: 'found' }], ['x'])).toBe('found');
  });

  it('returns null when no key yields a string', () => {
    expect(firstString([{ a: 1 }], ['a', 'b'])).toBeNull();
  });
});

describe('parseJsonRecord', () => {
  it('parses JSON objects', () => {
    expect(parseJsonRecord('{"k":"v"}')).toEqual({ k: 'v' });
  });

  it('returns null for non-object JSON, malformed JSON, and empty input', () => {
    expect(parseJsonRecord('[1,2]')).toBeNull();
    expect(parseJsonRecord('"str"')).toBeNull();
    expect(parseJsonRecord('{bad')).toBeNull();
    expect(parseJsonRecord(null)).toBeNull();
  });
});
