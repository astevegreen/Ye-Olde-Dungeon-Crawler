export type Predicate =
  | { type: 'hasFlag'; flag: string; value?: boolean }
  | { type: 'minCounter'; counter: string; value: number }
  | { type: 'maxCounter'; counter: string; value: number }
  | { type: 'minFaction'; faction: string; value: number }
  | { type: 'maxFaction'; faction: string; value: number }
  | { type: 'and'; predicates: Predicate[] }
  | { type: 'or'; predicates: Predicate[] }
  | { type: 'not'; predicate: Predicate };
