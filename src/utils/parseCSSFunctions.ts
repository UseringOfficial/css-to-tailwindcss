const cssFunctionRegexp = /(?<name>[\w-]+)\((?<value>.*?)\)/;
export function parseCSSFunction(string: string) {
  const { name, value } = string.match(cssFunctionRegexp)?.groups || {};

  return { name: name || null, value: value || null };
}

const cssFunctionsRegexp = /(?<name>[\w-]+)\((?<value>.*?)\)/gm;
export function parseCSSFunctions(value: string) {
  return (
    value
      .trim()
      .match(cssFunctionsRegexp)
      ?.map((cssFunction: string) => {
        return parseCSSFunction(cssFunction);
      }) || []
  );
}
