export type DebouncedCallback<TArgs extends unknown[]> = {
  run: (...args: TArgs) => void;
  cancel: () => void;
};

export function createDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delayMs: number,
): DebouncedCallback<TArgs> {
  let timer: number | undefined;

  const cancel = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    run: (...args: TArgs) => {
      cancel();
      timer = window.setTimeout(() => {
        timer = undefined;
        callback(...args);
      }, delayMs);
    },
    cancel,
  };
}
