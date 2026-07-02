export interface FixtureFactory<T> {
  readonly make: (overrides?: Partial<T>) => T;
}

export * from './lib/den-fixtures';
