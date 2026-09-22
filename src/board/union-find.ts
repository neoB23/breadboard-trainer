import type { NodeId } from './model.ts'

/**
 * Union-find over structural nodes — the "which holes are bonded by wire"
 * question that both the live net readout (`nets.ts`) and the canonical
 * netlist (`netlist.ts`) start from.
 *
 * Path compression without ranks: a 20-column board has at most 42 nodes, so
 * the balancing that ranks buy is not worth the extra state.
 */
export class UnionFind {
  private parent = new Map<NodeId, NodeId>()

  find(node: NodeId): NodeId {
    const parent = this.parent.get(node)
    if (parent === undefined || parent === node) {
      this.parent.set(node, node)
      return node
    }
    const root = this.find(parent)
    this.parent.set(node, root)
    return root
  }

  union(a: NodeId, b: NodeId): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootA, rootB)
  }

  joined(a: NodeId, b: NodeId): boolean {
    return this.find(a) === this.find(b)
  }
}
