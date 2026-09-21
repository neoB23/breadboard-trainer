# Pivot Plan — From Breadboard to Lighting Circuits

**Status:** proposal, for the team to accept or reject before any code moves
**Replaces:** the domain half of [`build-plan.md`](build-plan.md). Parts A and C of that plan stand as written.
**Date:** 18 September 2026

---

## 1. The topic we should take

> **Install lighting fixtures and switch controls**
> TESDA EIM NC II · *Install Electrical Protective Devices for Distribution, Power, Lighting,
> Auxiliary, Lightning Protection and Grounding Systems* · **Learning Outcome 3**

One learning outcome, three exercises, one competency. Not the whole module.

| # | Exercise | Source in their material | Devices |
|---|---|---|---|
| 1 | One lamp on a single-pole switch | Information Sheet 2.3-1 | breaker, switch, lamp |
| 2 | Two lamps on a duplex switch | **Job Sheet 2.3-1** | breaker, 2-gang switch, 2 lamps |
| 3 | One lamp on two three-way switches | Information Sheet 2.3-1, pp. on 3-way | breaker, 2× 3-way switch, lamp |

Exercise 2 is their own culminating assessment for this outcome. Exercise 3 is the one students
cannot debug without help, which is the entire reason our system exists.

---

## 2. Why this topic and not another

We looked at every practical sheet in the module. This one is the closest structural match to what
we have already built, on five counts.

**It is the same size.** Three to eight components per exercise, exactly like a breadboard circuit.
Grounding systems and lightning protection are whole-building problems with no natural boundary;
a lighting circuit has a beginning and an end.

**It is the same mechanic.** The student joins terminals with conductors. We already know how to
model "a thing pushed into a connection point" and turn it into a graph.

**It is the same mathematics.** Netlist extraction and graph comparison carry over untouched. This
is Phases 11, 12 and 14 of the existing plan, surviving the pivot with no algorithmic change.

**The faults are localizable.** Every fault lands on a named terminal in a named box, the way
breadboard faults landed on a row. "The traveler is on the common terminal of switch B2" is exactly
as pointable as "row 14 never reaches row 15".

**It preserves our headline metric, and improves it.** See section 6.

By contrast: circuit breakers and panel boards (LO1, LO2) are mostly identification and selection
knowledge, which is a quiz, not a diagnostic engine. Grounding and lightning protection (LO2) have
too few discrete, student-committed faults to build a 150-case corpus from.

---

## 3. What replaces the breadboard

The material names it for us. Under **Conditions** for LO3 it lists *"Wiring booth / Simulated
workplace"*. A TESDA wiring booth is a standard frame with fixed mounting positions. That fixed,
known layout is what made the breadboard tractable, and it is what makes this tractable.

**Assumed scope — wiring only.** Boxes, conduit and fixture positions are placed by the exercise.
The student pulls conductors and lands them on terminals. Every fault in section 5 is a wiring
fault, so this targets all of the pedagogy without taking on box mounting and conduit bending.
*Flag this if the team disagrees — it is the one assumption that changes the schedule.*

### Addressing

| Breadboard | Lighting booth |
|---|---|
| `{ col: 1-63, row: 'A'-'J', half }` | `{ boxId, deviceId, terminalId }` |
| Hole | Terminal, and terminals are **named**, not spatial |
| 5-hole strip collapses to one node | Wire nut collapses its conductors to one node |
| Component spans two holes | Conductor spans two terminals |

Named terminals are strictly easier than a coordinate grid. There is no raycasting, no
nearest-hole maths, and no span validation. Phase 10 gets simpler.

### Device model

Each device declares its terminals and its internal connectivity, which may depend on state.

| Device | Terminals | Internal connection |
|---|---|---|
| Breaker | `bus`, `load` | closed when on |
| Single-pole switch | `line`, `load` | closed when up |
| Three-way switch | `common`, `traveler1`, `traveler2` | `common` to exactly one traveler |
| Duplex switch | two independent single-pole sets | per gang |
| Receptacle | `line`, `neutral`, `ground` | always, to its blades |
| GFCI | `line-in`, `load-out`, `neutral-in`, `neutral-out`, `ground` | trips on imbalance |
| Lamp | `t1`, `t2` | through the filament, a load |

This is a small table and it is the whole domain. Adding a device later is one row.

---

## 4. The verdict is three checks, not one

The breadboard had one verdict: does the netlist match. A lighting circuit gives us three, and they
cross-check each other.

**Check 1 — Behaviour, by truth table.** Evaluate connectivity in every switch state and compare
against the reference behaviour. For exercise 3 that is four states:

| SW1 | SW2 | Lamp |
|---|---|---|
| up | up | **on** |
| up | down | off |
| down | up | off |
| down | down | **on** |

**Check 2 — Safety.** Independent of whether the lamp lights: is the switch in the ungrounded
conductor, is the equipment ground continuous end to end, is there any hot-to-neutral or
hot-to-ground short, is the breaker rating within the conductor's ampacity.

**Check 3 — Match.** Does the student's netlist match the instructor's captured reference, up to
isomorphism.

**Why three is better than one.** A circuit can pass Check 1 and fail Check 3, which means the
student found a different but working wiring. That combination is our false-positive guard: when it
fires, the comparator is wrong, not the student. The breadboard had no such independent signal.

It also kills Phase 16. We do not need modified nodal analysis. We need graph reachability per
switch state plus short detection, which is a morning's work rather than four days.

---

## 5. Fault taxonomy

**Tier 1 — intrinsic, needs no answer key, runs in the browser.** These are the proactive warnings.

| Fault | Why it matters | Authority |
|---|---|---|
| Switched neutral | Fixture stays live when off. Kills people changing bulbs | PEC / NEC 404.2(B) |
| Hot and neutral reversed | Shell of the lampholder is live | NEC 200.11 |
| Equipment ground missing or broken | No fault path, breaker never trips | NEC 250.4 |
| Hot-to-neutral short | Dead short across the branch | — |
| Hot-to-ground short | Same, through the ground path | — |
| Unterminated conductor | Live copper loose in a box | — |
| Double-tapped breaker | Two conductors on a one-conductor lug | NEC 110.14 |
| Breaker rating over conductor ampacity | Conductor cooks before the breaker opens | NEC 240.4 |
| Wire below 2.0 mm² TW on a lighting circuit | Their own stated minimum | Info Sheet 2.3-1 §G |
| Switch not at 1.5 m | Their own stated mounting height | Info Sheet 2.3-1 §F |

**Tier 2 — needs the reference, runs on the API.**

| Fault | Notes |
|---|---|
| Hot feed landed on a traveler instead of the common | Lamp works in one position of the first switch, dead in the other. The classic three-way failure |
| Switch leg landed on a traveler instead of the common | Same symptom, other end of the run |
| Both travelers landed on one terminal | Second traveler does nothing; lamp dead in one position |
| Lamp on the wrong gang of the duplex switch | Both lamps work, wrong switch controls each |
| Fixture fed from the wrong switch leg | Works, but not as specified |
| Device on the wrong branch circuit | Load schedule violation |

Ten Tier 1 rules and five Tier 2 classes. The existing plan budgeted for eight Tier 1 rules, so
Phase 13 is the same size. Every one of these cites a code article or their own material, which is
a stronger footing than the breadboard taxonomy ever had.

---

## 6. The headline metric survives, and gets sharper

The existing plan's most important number is: **a correct circuit built differently must produce
zero faults.** On a breadboard that meant the same circuit built on different rows.

Here it means something better, because lighting circuits contain a genuine, non-trivial
isomorphism that students hit constantly:

> **The two travelers are interchangeable.** It does not matter which traveler terminal on the
> first switch connects to which on the second. Both wirings are electrically identical, both work,
> and students produce both.

A comparator that matches conductors by terminal name flags one of those as a fault. It must not.
And it must still catch the neighbouring mistake that looks almost identical on the board: the hot
feed landed on a traveler terminal instead of the common, which leaves the lamp working in one
position of the first switch and dead in the other.

Those two boards differ by one conductor. One is correct and one is broken. Getting that pair right
is worth more to the defence than twenty breadboard row-shifts, because the distinction is real,
subtle, and immediately recognisable to any electrician on the panel.

Other genuine isomorphisms to seed the negative corpus with: which of several neutral conductors
lands on which neutral terminal, splice ordering inside a box, and which physical conduit path a
conductor takes between the same two terminals.

---

## 7. What carries over untouched

| Part | Phases | Carries over |
|---|---|---|
| **A — Student shell** | 0–8 | **Entirely.** Auth, classes, dashboard, settings and the instructor shell do not know what the domain is. Only Phase 7's 3D content changes, not its layout |
| **B — Engine** | 11, 12, 14, 15, 17–20 | Netlist extraction, Learn Mode, the comparator, fault presentation, telemetry, analytics, PWA and the evaluation harness. No algorithmic change |
| **C — Tasks, grading, AI** | 22–25 | **Entirely.** Deadlines, timers, auto-grading, the release gate and the AI Coach are domain-agnostic |

Roughly three quarters of the existing plan is unaffected. The pivot touches four phases.

---

## 8. What changes

| Phase | Was | Becomes | Effort |
|---|---|---|---|
| **9** | Board geometry, 830 holes, union-find over strips | Booth topology, named terminals, union-find over splices | 4d → **3d** |
| **10** | Drag components, raycast to holes, span validation | Pull conductors, land on named terminals, per-device terminal rules | 6d → **5d** |
| **13** | Eight intrinsic breadboard rules | Ten code-based rules from section 5 | 4d → **4d** |
| **16** | Modified nodal analysis, Gaussian elimination | Switch-state reachability and short detection | 4d → **2d** |
| **new** | — | Truth-table verdict and the three-check reconciliation | — → **2d** |

Net: **Part B drops from 50 to 46 days.** The saving is real but small; do not spend it in advance.

### One addition worth making

LO3's Self-Check 2.3-1 is five questions with an answer key, already written. Wiring it in as a
short pre-quiz costs about a day and gives the evaluation chapter a knowledge score to sit beside
the performance score. Optional, and easy to cut.

---

## 9. Timeline

| Part | Phases | Days |
|---|---|---|
| A — Student shell | 0–8 | 35 |
| B — Engine | 9–20 | 46 |
| C — Tasks, grading, AI | 22–25 | 19 |
| Evaluation | 21 | 10 |
| **Total** | | **~110 days (≈22 weeks)** |

Within two days of the breadboard plan. The pivot is not a schedule event.

**Phases 0–4 are already built and are unaffected.** No work is thrown away.

---

## 10. Risks the pivot introduces

| Risk | Mitigation |
|---|---|
| 3D booth is more complex than a flat board — a panel, boxes at height, devices with several terminals | Wiring-only scope; boxes pre-placed; camera snaps to one box at a time rather than free orbit |
| Conductor routing looks like spaghetti in 3D | Route conductors along conduit automatically. The student picks terminals, not paths. The path was never the assessment |
| Team has less domain intuition for wiring faults than for breadboards | Every fault in section 5 cites a code article. Have an electrician review the corpus once, before Phase 20 |
| Panel objects that the truth table alone is enough, making the comparator redundant | It is not: the truth table cannot tell a switched neutral from a correct circuit, since the lamp behaves identically. Lead with that example |

## 11. What we need to decide

1. **Wiring-only scope** — accept, or add box mounting and conduit running.
2. **Three exercises or two** — dropping exercise 1 loses the gentle on-ramp but saves nothing much,
   since it shares all its machinery with exercise 2.
3. **Self-Check quiz in or out.**

Nothing else about the project changes.
