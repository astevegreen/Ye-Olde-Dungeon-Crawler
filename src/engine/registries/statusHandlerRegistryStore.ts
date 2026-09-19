import type { StatusType } from '../status/types';
import type { StatusHandler } from '../status/statusHandlers';
import { RegistryStore } from './registryStore';

let defaultRegistrar: (() => void) | undefined;

export function setDefaultStatusHandlerRegistrar(registrar: () => void): void {
  defaultRegistrar = registrar;
}

export function getDefaultStatusHandlerRegistrar(): (() => void) | undefined {
  return defaultRegistrar;
}

/**
 * One engine's status effect handlers (ARCHITECTURE.md §3, P-22).
 */
export class StatusHandlerRegistryStore extends RegistryStore<StatusType, StatusHandler> {
  constructor() {
    super();
  }

  public override register(value: StatusHandler): void;
  public override register(key: StatusType, value: StatusHandler): void;
  public override register(keyOrVal: StatusType | StatusHandler, maybeVal?: StatusHandler): void {
    if (maybeVal !== undefined) {
      super.register(keyOrVal as StatusType, maybeVal);
    } else {
      throw new Error('StatusHandlerRegistryStore: statusType key is required when registering a handler');
    }
  }

  public override registerAll(
    handlers: readonly StatusHandler[] | StatusHandler[] | Record<string, StatusHandler> | Map<StatusType, StatusHandler>
  ): void {
    if (Array.isArray(handlers)) {
      throw new Error('StatusHandlerRegistryStore: statusType keys required; array registration not supported');
    }
    const entries = handlers instanceof Map ? handlers.entries() : Object.entries(handlers);
    for (const [statusType, handler] of entries) {
      this.register(statusType, handler);
    }
  }

  public getMap(): ReadonlyMap<StatusType, StatusHandler> {
    return this.entries;
  }
}

const processDefaultStore = new StatusHandlerRegistryStore();
let activeStore: StatusHandlerRegistryStore = processDefaultStore;

export function activeStatusHandlerStore(): StatusHandlerRegistryStore {
  return activeStore;
}

export function processDefaultStatusHandlerStore(): StatusHandlerRegistryStore {
  return processDefaultStore;
}

export function setActiveStatusHandlerStore(store: StatusHandlerRegistryStore | null): void {
  activeStore = store ?? processDefaultStore;
}
