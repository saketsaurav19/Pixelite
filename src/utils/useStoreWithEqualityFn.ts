/**
 * Local replacement for `useStoreWithEqualityFn` from `zustand/traditional`.
 *
 * Why this exists: `zustand/traditional` imports
 * `use-sync-external-store/shim/with-selector`, which zustand declares only as
 * a *peer* dependency. It is missing from package-lock.json, so clean installs
 * (`npm ci`, as used by CI and the deploy pipeline) produce a bundle containing
 * `throw new Error('Could not resolve "use-sync-external-store/shim/with-selector.js" imported by "zustand".')`
 * The app then crashes on load and shows a black blank screen.
 *
 * The selector/equality logic below is a faithful ESM port of
 * `useSyncExternalStoreWithSelector` from `use-sync-external-store`
 * (MIT License, Copyright (c) Meta Platforms, Inc. and affiliates).
 * React 18+ ships `useSyncExternalStore` natively, so the shim package — and
 * the extra dependency — is not needed at all.
 */
import {
  useRef,
  useEffect,
  useMemo,
  useDebugValue,
  useSyncExternalStore,
} from 'react';

function is(x: unknown, y: unknown): boolean {
  return (
    (x === y && (x !== 0 || 1 / (x as number) === 1 / (y as number))) ||
    (x !== x && y !== y)
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const objectIs: (x: any, y: any) => boolean =
  typeof Object.is === 'function' ? Object.is : is;

interface StoreApi<TState> {
  subscribe: (listener: () => void) => () => void;
  getState: () => TState;
  getInitialState: () => TState;
}

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: (() => Snapshot) | undefined,
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  const instRef = useRef<{ hasValue: boolean; value: Selection | null } | null>(null);
  let inst: { hasValue: boolean; value: Selection | null };
  if (instRef.current === null) {
    inst = { hasValue: false, value: null };
    instRef.current = inst;
  } else {
    inst = instRef.current;
  }

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;

    function memoizedSelector(nextSnapshot: Snapshot): Selection {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value as Selection;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      const currentSelection = memoizedSelection;
      if (objectIs(memoizedSnapshot, nextSnapshot)) {
        return currentSelection;
      }
      const nextSelection = selector(nextSnapshot);
      if (isEqual !== undefined && isEqual(currentSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return currentSelection;
      }
      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    }

    const maybeGetServerSnapshot =
      getServerSnapshot === undefined ? null : getServerSnapshot;
    return [
      () => memoizedSelector(getSnapshot()),
      maybeGetServerSnapshot === null
        ? undefined
        : () => memoizedSelector((maybeGetServerSnapshot as () => Snapshot)()),
    ];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection);

  useEffect(() => {
    inst.hasValue = true;
    inst.value = value;
  }, [value]);

  useDebugValue(value);
  return value;
}

const identity = <T,>(arg: T): T => arg;

/**
 * Drop-in replacement for zustand/traditional's `useStoreWithEqualityFn`.
 * Re-renders only when the selected slice changes per `equalityFn`.
 */
export function useStoreWithEqualityFn<TState, Selection>(
  api: StoreApi<TState>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selector: (state: TState) => Selection = identity as any,
  equalityFn?: (a: Selection, b: Selection) => boolean,
): Selection {
  const slice = useSyncExternalStoreWithSelector(
    api.subscribe,
    api.getState,
    api.getInitialState,
    selector,
    equalityFn,
  );
  useDebugValue(slice);
  return slice;
}
