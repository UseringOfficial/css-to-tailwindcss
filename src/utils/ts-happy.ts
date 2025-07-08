type Falsy = false | 0 | '' | null | undefined;

export function truthy<T>(value: T): value is Exclude<T, Falsy> {
  return !!value;
}
