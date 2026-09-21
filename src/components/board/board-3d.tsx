import { RoundedBox } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import * as React from 'react'
import * as THREE from 'three'

import { BUILD_AT, BUILD_TOTAL, COLUMNS, NETS, ROWS, type NetId } from './geometry'
import { useReducedMotion } from './use-board-sequence'
import { useTokenColors, type TokenColors } from './use-token-colors'

/**
 * The breadboard in three dimensions.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A SEPARATE, LAZILY LOADED MODULE
 *
 * `three` plus the two React wrappers are roughly the size of everything else on
 * this page put together. Bundling them into the entry chunk would mean every
 * visitor — including one who lands on `/login`, signs in, and never sees the
 * landing page — downloads a 3D engine to read a form.
 *
 * So nothing imports this file directly. `board-stage.tsx` reaches it through
 * `React.lazy`, and the SVG board renders as the Suspense fallback: the visual
 * is correct and interactive from first paint, and the 3D scene replaces it when
 * and only when it has arrived.
 * ---------------------------------------------------------------------------
 *
 * The geometry is shared with the SVG — same column count, same rows, same
 * circuit — so the two are the same board seen two ways rather than two drawings
 * that happen to look alike.
 */

/* -------------------------------------------------------------------------- */
/* Scene units                                                                */
/* -------------------------------------------------------------------------- */

/** One hole to the next. Every other measurement is expressed in these. */
const PITCH = 1
const HOLE = 0.34
const BOARD_THICKNESS = 0.55
const CHANNEL_WIDTH = 1.6

const BANK_DEPTH = (ROWS - 1) * PITCH
const BOARD_W = (COLUMNS - 1) * PITCH + 3
const BOARD_D = BANK_DEPTH * 2 + CHANNEL_WIDTH + 6

/**
 * Exported (with the shapes below) for `src/features/lab/circuit-3d.tsx`,
 * which renders a student's own build with the same board and the same units.
 * Both live behind the same lazy boundary, so sharing costs the entry nothing.
 */
export const columnX = (column: number) => (column - (COLUMNS - 1) / 2) * PITCH
export const upperZ = (row: number) => -(CHANNEL_WIDTH / 2) - BANK_DEPTH + row * PITCH
export const lowerZ = (row: number) => CHANNEL_WIDTH / 2 + row * PITCH
export const RAIL_UPPER_Z = upperZ(0) - 2.1
export const RAIL_LOWER_Z = lowerZ(ROWS - 1) + 2.1

export const SURFACE_Y = BOARD_THICKNESS / 2

/**
 * How far anything painted on the board's face is lifted clear of it.
 *
 * Every surface that sits *on* the slab — the tie-point holes, the rail
 * silkscreen — has to be offset, or it shares a plane with the slab's top face
 * and z-fights. Small enough to be invisible at any camera distance this scene
 * uses; large enough to survive the depth buffer's precision at this scale.
 */
export const HOLE_PROUD = 0.006

/* -------------------------------------------------------------------------- */
/* Holes                                                                      */
/* -------------------------------------------------------------------------- */

interface HolePlacement {
  x: number
  z: number
  net: NetId | null
}

function buildHoles(): HolePlacement[] {
  const netOfUpper = new Map<number, NetId>()
  const netOfLower = new Map<number, NetId>()
  for (const net of NETS) {
    for (const column of net.upperColumns) netOfUpper.set(column, net.id)
    for (const column of net.lowerColumns) netOfLower.set(column, net.id)
  }

  const holes: HolePlacement[] = []
  for (let column = 0; column < COLUMNS; column += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      holes.push({ x: columnX(column), z: upperZ(row), net: netOfUpper.get(column) ?? null })
      holes.push({ x: columnX(column), z: lowerZ(row), net: netOfLower.get(column) ?? null })
    }
    // The two power rails, skipping every sixth hole as a real board does.
    if (column % 6 !== 5) {
      holes.push({ x: columnX(column), z: RAIL_UPPER_Z, net: null })
      holes.push({ x: columnX(column), z: RAIL_LOWER_Z, net: null })
    }
  }
  return holes
}

/**
 * Every hole in one instanced draw call.
 *
 * There are ~230 of them. As individual meshes that is 230 draw calls a frame,
 * which is the difference between this being free and this being the reason a
 * lab machine's fan spins up. Colour is per-instance, so lighting a net still
 * costs nothing extra.
 */
function Holes({ colors, lit, faulted }: { colors: TokenColors; lit: Set<NetId>; faulted: NetId | null }) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null)
  const holes = React.useMemo(buildHoles, [])

  React.useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const matrix = new THREE.Matrix4()
    const idle = new THREE.Color(colors['text-tertiary'])
    const accent = new THREE.Color(colors.accent)
    const fault = new THREE.Color(colors.fault)

    holes.forEach((hole, index) => {
      /**
       * `+ HOLE_PROUD` — and this is the whole z-fighting fix.
       *
       * Positioned at `SURFACE_Y - HOLE / 2`, a hole box of side HOLE has its top
       * face at exactly `SURFACE_Y`: the same plane as the slab's top, to the
       * last bit. Two coplanar surfaces mean the depth test cannot separate them,
       * so which one wins is decided per-pixel by floating-point noise. That is
       * the shimmering stipple across the board.
       *
       * Lifting them a few thousandths clear is enough for the depth buffer to
       * order them and far too little to see as a raised lip.
       */
      matrix.setPosition(hole.x, SURFACE_Y - HOLE / 2 + HOLE_PROUD, hole.z)
      mesh.setMatrixAt(index, matrix)

      const isLit = hole.net !== null && lit.has(hole.net)
      const isFault = hole.net !== null && faulted === hole.net && isLit
      mesh.setColorAt(index, isFault ? fault : isLit ? accent : idle)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [holes, colors, lit, faulted])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, holes.length]}>
      <boxGeometry args={[HOLE, HOLE, HOLE]} />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  )
}

/* -------------------------------------------------------------------------- */
/* The board                                                                  */
/* -------------------------------------------------------------------------- */

export function Slab({ colors }: { colors: TokenColors }) {
  return (
    <group>
      <RoundedBox
        args={[BOARD_W, BOARD_THICKNESS, BOARD_D]}
        radius={0.18}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={colors['bg-800']} roughness={0.72} metalness={0.02} />
      </RoundedBox>

      {/* The centre channel — a genuine recess, which is the one feature of a
          breadboard that a flat drawing can only imply. */}
      <mesh position={[0, SURFACE_Y - 0.12, 0]} receiveShadow>
        <boxGeometry args={[BOARD_W - 1.2, 0.24, CHANNEL_WIDTH]} />
        <meshStandardMaterial color={colors['bg-700']} roughness={0.9} />
      </mesh>

      {/* Rail stripes, painted on the surface as silkscreen. */}
      {(
        [
          { z: RAIL_UPPER_Z - 0.85, color: colors.fault },
          { z: RAIL_LOWER_Z + 0.85, color: colors.info },
        ] as const
      ).map((rail) => (
        <mesh key={rail.z} position={[0, SURFACE_Y + HOLE_PROUD, rail.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[BOARD_W - 1.4, 0.22]} />
          <meshBasicMaterial color={rail.color} toneMapped={false} opacity={0.75} transparent />
        </mesh>
      ))}
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

/** A leg, bent down into the board. Cheap: one thin cylinder. */
export function Lead({ from, to, color }: { from: THREE.Vector3; to: THREE.Vector3; color: string }) {
  const { position, quaternion, length } = React.useMemo(() => {
    const direction = new THREE.Vector3().subVectors(to, from)
    const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    )
    return { position: midpoint, quaternion: rotation, length: direction.length() }
  }, [from, to])

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <cylinderGeometry args={[0.055, 0.055, length, 6]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.7} />
    </mesh>
  )
}

function Resistor({ colors }: { colors: TokenColors }) {
  const a = columnX(2)
  const b = columnX(7)
  const y = SURFACE_Y + 0.42
  const lead = colors['text-tertiary']

  return (
    <group>
      <Lead
        from={new THREE.Vector3(a, SURFACE_Y - 0.2, upperZ(1))}
        to={new THREE.Vector3(a, y, upperZ(1))}
        color={lead}
      />
      <Lead
        from={new THREE.Vector3(b, SURFACE_Y - 0.2, upperZ(1))}
        to={new THREE.Vector3(b, y, upperZ(1))}
        color={lead}
      />
      <Lead from={new THREE.Vector3(a, y, upperZ(1))} to={new THREE.Vector3(b, y, upperZ(1))} color={lead} />

      <mesh position={[(a + b) / 2, y, upperZ(1)]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.3, 2.1, 4, 12]} />
        <meshStandardMaterial color={colors['warn-surface']} roughness={0.55} />
      </mesh>

      {/* 220Ω: red, red, brown. The bands are what make it a resistor rather
          than a beige pill. */}
      {[-0.7, -0.3, 0.55].map((offset, index) => (
        <mesh key={offset} position={[(a + b) / 2 + offset, y, upperZ(1)]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.315, 0.315, 0.18, 12]} />
          <meshStandardMaterial color={index === 2 ? colors['warn-ink'] : colors.fault} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function Led({ colors, lit }: { colors: TokenColors; lit: boolean }) {
  const x = columnX(12)
  const y = SURFACE_Y + 0.75

  /**
   * The legs straddle the centre channel — one row either side of it — which is
   * how a two-lead component is actually seated on a breadboard.
   *
   * They were previously at `upperZ(3)` and `lowerZ(1)`, 1.8 units either side of
   * a body whose radius is 0.36. The result was a floating red bead with two
   * disconnected grey sticks lying near it: the "stray stick" in the bug report.
   * The body sits over the channel, so the legs have to land on the rows nearest
   * it and splay outward from the body rather than dropping straight down.
   */
  const anodeZ = upperZ(ROWS - 1)
  const cathodeZ = lowerZ(0)
  const bodyZ = (anodeZ + cathodeZ) / 2
  // The point both legs emerge from, just inside the underside of the body.
  const bodyBase = new THREE.Vector3(x, y - 0.3, bodyZ)

  return (
    <group>
      <Lead
        from={new THREE.Vector3(x, SURFACE_Y - 0.2, anodeZ)}
        to={bodyBase}
        color={colors['text-tertiary']}
      />
      <Lead
        from={new THREE.Vector3(x, SURFACE_Y - 0.2, cathodeZ)}
        to={bodyBase}
        color={colors['text-tertiary']}
      />

      <mesh position={[x, y, bodyZ]} castShadow>
        <capsuleGeometry args={[0.36, 0.42, 6, 14]} />
        {/*
          Emissive only when the circuit is whole. On the landing page the ground
          jumper is in the wrong bank, so this stays dark — which is the entire
          point being made, rendered rather than captioned.
        */}
        <meshStandardMaterial
          color={colors.fault}
          emissive={colors.fault}
          emissiveIntensity={lit ? 1.6 : 0}
          roughness={0.28}
          transparent
          opacity={0.92}
        />
      </mesh>

      {lit ? <pointLight position={[x, y + 0.6, 0]} distance={7} intensity={9} color={colors.fault} /> : null}
    </group>
  )
}

/** A jumper, as a tube following a slack curve rather than a straight line. */
export function Jumper({
  from,
  to,
  color,
  lift = 1.5,
}: {
  from: [number, number, number]
  to: [number, number, number]
  color: string
  lift?: number
}) {
  const geometry = React.useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    mid.y += lift

    const curve = new THREE.CatmullRomCurve3([start, mid, end])
    return new THREE.TubeGeometry(curve, 28, 0.075, 7, false)
  }, [from, to, lift])

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Scene                                                                      */
/* -------------------------------------------------------------------------- */

function Scene({
  colors,
  lit,
  faulted,
  fault,
  still,
  placed,
}: {
  colors: TokenColors
  lit: Set<NetId>
  faulted: NetId | null
  fault: boolean
  still: boolean
  placed: number
}) {
  const group = React.useRef<THREE.Group>(null)

  /**
   * A slow drift rather than a spin.
   *
   * It rocks about 12° either side of centre and never completes a rotation:
   * a continuously spinning object in the corner of a page is the thing that
   * makes people scroll past it. Frozen entirely under reduced motion.
   */
  useFrame(({ clock }) => {
    if (still || !group.current) return
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.22) * 0.21
  })

  const groundEnd: [number, number, number] = fault
    ? [columnX(12), SURFACE_Y - 0.1, upperZ(ROWS - 1)]
    : [columnX(12), SURFACE_Y - 0.1, lowerZ(ROWS - 1)]

  return (
    <group ref={group} rotation={[0, -0.2, 0]}>
      <Slab colors={colors} />
      <Holes colors={colors} lit={lit} faulted={faulted} />

      {/*
        The parts appear one at a time, in assembly order.

        This scene used to draw the finished circuit unconditionally and ignore
        the build count entirely — so the hero, which shows the 3D board, went
        straight to a completed board and the "building" stage was three seconds
        of nothing happening. Gating on the same BUILD_AT the flat drawing uses
        is what makes the two agree.
      */}
      {placed >= BUILD_AT.supplyJumper ? (
        <Jumper
          from={[columnX(2), SURFACE_Y - 0.1, RAIL_UPPER_Z]}
          to={[columnX(2), SURFACE_Y - 0.1, upperZ(0)]}
          color={colors.fault}
          lift={0.9}
        />
      ) : null}

      {placed >= BUILD_AT.resistor ? <Resistor colors={colors} /> : null}

      {placed >= BUILD_AT.led ? <Led colors={colors} lit={lit.has('n3') && !fault} /> : null}

      {placed >= BUILD_AT.groundJumper ? (
        <Jumper
          from={[columnX(16), SURFACE_Y - 0.1, RAIL_LOWER_Z]}
          to={groundEnd}
          color={colors.info}
          lift={1.7}
        />
      ) : null}
    </group>
  )
}

/**
 * The lighting rig, shared with the workspace's circuit view.
 *
 * The key light's shadow settings are the part that must not drift. Three.js
 * gives a directional light an orthographic shadow camera of `(-5, 5, 5, -5)`
 * — a 10 x 10 box. This board is 22 x 15.6, so with the defaults roughly two
 * thirds of it fell outside the shadow map entirely and the part inside
 * self-shadowed at the resolution limit: pale grey smearing, plus a hard edge
 * where the frustum ran out. The frustum is sized to the board with a margin,
 * and both biases are set — `normalBias` is the one that matters for the
 * tie-point holes, thin boxes lying almost flat, precisely the geometry that
 * shadow-acnes worst.
 */
export function StudioLights() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[9, 16, 11]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={48}
        shadow-bias={-0.0006}
        shadow-normalBias={0.045}
      />
      <directionalLight position={[-8, 7, -6]} intensity={0.55} />
      <directionalLight position={[0, -6, 4]} intensity={0.18} />
    </>
  )
}

export interface Board3DProps {
  litNets?: readonly NetId[]
  faultedNet?: NetId | null
  fault?: boolean
  /** How many parts are in. See BUILD_STEPS. */
  placed?: number
  className?: string
}

export default function Board3D({
  litNets = [],
  faultedNet = null,
  fault = false,
  placed = BUILD_TOTAL,
  className,
}: Board3DProps) {
  const colors = useTokenColors()
  const still = useReducedMotion()
  const lit = React.useMemo(() => new Set(litNets), [litNets])

  // Nothing is drawn against a guessed palette — the tokens are read on the
  // first effect, which is one frame away.
  if (!colors) return null

  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 21, 19], fov: 30 }}
      // The board sits on the page's own ground rather than a scene background,
      // so the card behind it shows through and the theme keeps working.
      gl={{ antialias: true, alpha: true }}
    >
      {/*
        Lit by hand, with no environment map.

        drei's `<Environment preset>` was the obvious way to make the plastic read
        as plastic, and it is the wrong tool here: it fetches an HDR from a CDN at
        runtime. That is a third-party request in the render path of an app that
        is otherwise entirely self-hosted, it fails on a campus network that
        blocks it — and because it suspends *inside* the canvas, a fetch that
        never resolves leaves the scene blank rather than merely unlit. It did
        exactly that the first time this was rendered.

        Three lights get most of the way there for nothing: a key, a fill from the
        opposite side so the shadowed faces do not go flat, and a dim up-light
        standing in for bounce off the white page underneath.
      */}
      <StudioLights />

      <Scene colors={colors} lit={lit} faulted={faultedNet} fault={fault} still={still} placed={placed} />
    </Canvas>
  )
}
