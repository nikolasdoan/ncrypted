import { RandomForestClassifier } from "ml-random-forest"

/** Swipes each person must enrol before they can be checked or used as a stranger. */
export const MIN_SWIPES = 10

// person -> swipe vectors. Kept on globalThis so a dev-server reload keeps them.
const store = globalThis as unknown as { swipeProfiles?: Map<string, number[][]> }
export const profiles: Map<string, number[][]> = (store.swipeProfiles ??= new Map())

export function people() {
  return [...profiles.entries()].map(([person, swipes]) => ({ person, swipes: swipes.length }))
}

/**
 * Probability (0-1) that each swipe was made by `person`.
 *
 * A forest is trained on that person's swipes against everyone else's - the
 * model in eval/evaluate_rf.py. A stranger is "not this person", so it needs
 * at least one other enrolled person to learn what that looks like.
 */
export function ownerProbability(person: string, vectors: number[][]): number[] | string {
  const own = profiles.get(person) ?? []
  const others = [...profiles.entries()]
    .filter(([p, swipes]) => p !== person && swipes.length >= MIN_SWIPES)
    .flatMap(([, swipes]) => swipes)
  if (own.length < MIN_SWIPES) return `${person} needs ${MIN_SWIPES} enrolled swipes (has ${own.length})`
  if (others.length === 0) return `Enrol a second person (${MIN_SWIPES}+ swipes) so the model can learn what someone else looks like`

  // Balance the classes by repeating the smaller one, as class_weight="balanced" does in the evaluation.
  const [small, big] = own.length < others.length ? [own, others] : [others, own]
  const repeated = Array.from({ length: big.length }, (_, i) => small[i % small.length])
  const ownRows = small === own ? repeated : own
  const otherRows = small === others ? repeated : others

  const forest = new RandomForestClassifier({
    nEstimators: 100,
    maxFeatures: 0.5,
    replacement: true,
    seed: 7,
    useSampleBagging: true,
    noOOB: true,
  })
  forest.train([...ownRows, ...otherRows], [...ownRows.map(() => 1), ...otherRows.map(() => 0)])
  return forest.predictProbability(vectors, 1)
}
