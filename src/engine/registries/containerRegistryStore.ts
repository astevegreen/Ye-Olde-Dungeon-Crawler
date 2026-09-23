import { RegistryStore } from './registryStore';

/**
 * One engine's container registry (ARCHITECTURE.md §3, §5; docs/architecture/content-extensibility.md).
 *
 * Holds runtime container instances keyed by scalar string ID.
 * Does NOT hold content data — this is live game state, so instances
 * are never seeded from a process default.
 */
export class ContainerRegistryStore extends RegistryStore<string, any> {
  constructor() {
    super((c) => c?.id);
  }
}

const fallbackContainerStore = new ContainerRegistryStore();
let activeStore: ContainerRegistryStore = fallbackContainerStore;

export function activeContainerStore(): ContainerRegistryStore {
  return activeStore;
}

export function processDefaultContainerStore(): ContainerRegistryStore {
  return fallbackContainerStore;
}

export function setActiveContainerStore(store: ContainerRegistryStore | null): void {
  activeStore = store ?? fallbackContainerStore;
}
