import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import * as React from 'react'
import * as THREE from 'three'

import { parseHole, type Hole, type NodeId, type PlacedPart } from '@/board/model'
import {
  columnX,
  Jumper,
  Lead,
  lowerZ,
  RAIL_LOWER_Z,
  RAIL_UPPER_Z,
  Slab,
  StudioLights,
  SURFACE_Y,
  upperZ,
  HOLE_PROUD,
} from '@/components/board/board-3d'
import { COLUMNS, ROWS } from '@/components/board/geometry'
import { useTokenColors, type TokenColors } from '@/components/board/use-token-colors'

import { bandsFor } from './part-art'

/**
 * The student's own circuit, in three dimensions — the same slab, units and
 * lighting as the landing hero, now rendering whatever was actually built.
 *
 * Read-only by design. Placement stays on the flat board, where a click means
 * one hole and a screen reader gets the same handles; this view exists to turn
 * the board around in your hands the way you would in a lab. It loads through
 * `React.lazy` like every other three.js consumer, so the entry bundle still
 * carries no 3D engine.
 *
 * Part bodies use the same literal paint as `part-art.tsx`, and for the same
 * reason: a resistor is tan in dark mode too. Everything structural — slab,
 * holes, powered-net glow, wire insulation — speaks tokens.
 */

const PAINT = {
  lead: '#b9c0c8',
  resistor: '#d8b98c',
  gold: '#caa64b',
  led: '#e5484d',
  can: '#3a414c',
  canTop: '#aab2bd',
  disc: '#c8742a',
  epoxy: '#33383f',
  band: '#c6ccd4',
}

/** Where a hole is in scene units. The same mapping the hero's circuit uses. */
function holeVec(holeId: string, y = SURFACE_Y - 0.2): THREE.Vector3 | null {
  const hole = parseHole(holeId)
  if (hole === null) return null
  return new THREE.Vector3(columnX(hole.column), y, zOf(hole))
}

function zOf(hole: Hole): number {
  switch (hole.kind) {
    case 'upper':
      return upperZ(hole.row)
    case 'lower':
      return lowerZ(hole.row)
    case 'railTop':
      return RAIL_UPPER_Z
    case 'railBottom':
      return RAIL_LOWER_Z
  }
}

/* -------------------------------------------------------------------------- */
/* Holes, with the powered nets lit                                           */
/* -------------------------------------------------------------------------- */

const HOLE = 0.34

function Holes({
  colors,
  netOfNode,
  powered,
}: {
  colors: TokenColors
  netOfNode: Map<NodeId, string>
  powered: Set<string>
}) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null)

  const holes = React.useMemo(() => {
    const list: { x: number; z: number; node: NodeId }[] = []
    for (let column = 0; column < COLUMNS; column += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        list.push({ x: columnX(column), z: upperZ(row), node: `u${column}` })
        list.push({ x: columnX(column), z: lowerZ(row), node: `l${column}` })
      }
      if (column % 6 !== 5) {
        list.push({ x: columnX(column), z: RAIL_UPPER_Z, node: 'vcc' })
        list.push({ x: columnX(column), z: RAIL_LOWER_Z, node: 'gnd' })
      }
    }
    return list
  }, [])

  React.useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const matrix = new THREE.Matrix4()
    const idle = new THREE.Color(colors['text-tertiary'])
    const accent = new THREE.Color(colors.accent)

    holes.forEach((hole, index) => {
      matrix.setPosition(hole.x, SURFACE_Y - HOLE / 2 + HOLE_PROUD, hole.z)
      mesh.setMatrixAt(index, matrix)

      const net = netOfNode.get(hole.node)
      mesh.setColorAt(index, net !== undefined && powered.has(net) ? accent : idle)
    })

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [holes, colors, netOfNode, powered])

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, holes.length]}>
      <boxGeometry args={[HOLE, HOLE, HOLE]} />
      <meshStandardMaterial roughness={0.85} metalness={0.05} />
    </instancedMesh>
  )
}

/* -------------------------------------------------------------------------- */
/* Parts                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A two-lead body along the line between its holes: legs rise from the holes,
 * a lead runs across, and the body sits at the midpoint, yawed to the axis.
 */
function TwoLeadFrame({
  part,
  height,
  children,
}: {
  part: PlacedPart
  height: number
  children: (length: number) => React.ReactNode
}) {
  const [aId, bId] = part.holes
  const a = aId !== undefined ? holeVec(aId) : null
  const b = bId !== undefined ? holeVec(bId) : null
  if (a === null || b === null) return null

  const mx = (a.x + b.x) / 2
  const mz = (a.z + b.z) / 2
  const length = Math.hypot(b.x - a.x, b.z - a.z)
  const yaw = -Math.atan2(b.z - a.z, b.x - a.x)
  const y = SURFACE_Y + height

  return (
    <group>
      <Lead from={a} to={new THREE.Vector3(a.x, y, a.z)} color={PAINT.lead} />
      <Lead from={b} to={new THREE.Vector3(b.x, y, b.z)} color={PAINT.lead} />
      <Lead from={new THREE.Vector3(a.x, y, a.z)} to={new THREE.Vector3(b.x, y, b.z)} color={PAINT.lead} />
      <group position={[mx, y, mz]} rotation={[0, yaw, 0]}>
        {children(length)}
      </group>
    </group>
  )
}

function Resistor3D({ part }: { part: PlacedPart }) {
  const bands = bandsFor(part.value)

  return (
    <TwoLeadFrame part={part} height={0.42}>
      {(length) => {
        const bodyLength = Math.min(2.1, Math.max(1.1, length * 0.45))
        return (
          <>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.3, bodyLength, 4, 12]} />
              <meshStandardMaterial color={PAINT.resistor} roughness={0.55} />
            </mesh>
            {[...bands, PAINT.gold].map((colour, index) => (
              <mesh
                key={index}
                position={[-bodyLength / 2 + 0.3 + index * (bodyLength / 4.4), 0, 0]}
                rotation={[0, 0, Math.PI / 2]}
              >
                <cylinderGeometry args={[0.315, 0.315, 0.16, 12]} />
                <meshStandardMaterial color={colour} roughness={0.5} />
              </mesh>
            ))}
          </>
        )
      }}
    </TwoLeadFrame>
  )
}

function Diode3D({ part }: { part: PlacedPart }) {
  return (
    <TwoLeadFrame part={part} height={0.34}>
      {(length) => {
        const bodyLength = Math.min(1.3, Math.max(0.8, length * 0.35))
        return (
          <>
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <capsuleGeometry args={[0.22, bodyLength, 4, 12]} />
              <meshStandardMaterial color={PAINT.epoxy} roughness={0.45} />
            </mesh>
            <mesh position={[bodyLength / 2 - 0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.23, 0.23, 0.12, 12]} />
              <meshStandardMaterial color={PAINT.band} roughness={0.4} />
            </mesh>
          </>
        )
      }}
    </TwoLeadFrame>
  )
}

/** Legs splay from the holes into the underside of a standing body. */
function StandingFrame({
  part,
  baseHeight,
  children,
}: {
  part: PlacedPart
  baseHeight: number
  children: React.ReactNode
}) {
  const [aId, bId] = part.holes
  const a = aId !== undefined ? holeVec(aId) : null
  const b = bId !== undefined ? holeVec(bId) : null
  if (a === null || b === null) return null

  const mx = (a.x + b.x) / 2
  const mz = (a.z + b.z) / 2
  const base = new THREE.Vector3(mx, SURFACE_Y + baseHeight, mz)

  return (
    <group>
      <Lead from={a} to={base} color={PAINT.lead} />
      <Lead from={b} to={base} color={PAINT.lead} />
      <group position={[mx, 0, mz]}>{children}</group>
    </group>
  )
}

function Led3D({ part, lit, colors }: { part: PlacedPart; lit: boolean; colors: TokenColors }) {
  return (
    <StandingFrame part={part} baseHeight={0.45}>
      <mesh position={[0, SURFACE_Y + 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.36, 0.42, 6, 14]} />
        <meshStandardMaterial
          color={PAINT.led}
          emissive={PAINT.led}
          emissiveIntensity={lit ? 1.6 : 0}
          roughness={0.28}
          transparent
          opacity={0.92}
        />
      </mesh>
      {lit ? (
        <pointLight position={[0, SURFACE_Y + 1.4, 0]} distance={7} intensity={9} color={colors.fault} />
      ) : null}
    </StandingFrame>
  )
}

function Capacitor3D({ part }: { part: PlacedPart }) {
  const electrolytic = part.value !== null && /[µu]F/i.test(part.value)

  if (electrolytic) {
    return (
      <StandingFrame part={part} baseHeight={0.3}>
        <mesh position={[0, SURFACE_Y + 0.65, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.38, 0.9, 16]} />
          <meshStandardMaterial color={PAINT.can} roughness={0.5} metalness={0.15} />
        </mesh>
        <mesh position={[0, SURFACE_Y + 1.11, 0]}>
          <cylinderGeometry args={[0.34, 0.34, 0.04, 16]} />
          <meshStandardMaterial color={PAINT.canTop} roughness={0.35} metalness={0.5} />
        </mesh>
      </StandingFrame>
    )
  }

  return (
    <StandingFrame part={part} baseHeight={0.35}>
      <mesh position={[0, SURFACE_Y + 0.62, 0]} scale={[1, 0.8, 0.45]} castShadow>
        <sphereGeometry args={[0.42, 16, 12]} />
        <meshStandardMaterial color={PAINT.disc} roughness={0.6} />
      </mesh>
    </StandingFrame>
  )
}

/** TO-92: a small black cylinder with its face milled flat. */
function Transistor3D({ part }: { part: PlacedPart }) {
  const points = part.holes.map((holeId) => holeVec(holeId))
  const base = points[1]
  if (points.some((point) => point === null) || base == null) return null

  const bodyY = SURFACE_Y + 0.62
  const bodyBase = new THREE.Vector3(base.x, bodyY - 0.25, base.z)

  return (
    <group>
      {points.map((point, index) =>
        point ? <Lead key={index} from={point} to={bodyBase} color={PAINT.lead} /> : null,
      )}
      <group position={[base.x, bodyY, base.z]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.55, 0.55, 0.7, 18]} />
          <meshStandardMaterial color={PAINT.epoxy} roughness={0.55} />
        </mesh>
        {/* The flat face every TO-92 is read by. */}
        <mesh position={[0, 0, 0.42]}>
          <boxGeometry args={[1.05, 0.7, 0.2]} />
          <meshStandardMaterial color={PAINT.epoxy} roughness={0.55} />
        </mesh>
      </group>
    </group>
  )
}

/* -------------------------------------------------------------------------- */
/* The scene                                                                  */
/* -------------------------------------------------------------------------- */

export interface Circuit3DProps {
  parts: readonly PlacedPart[]
  netOfNode: Map<NodeId, string>
  powered: Set<string>
  litLeds: Set<string>
  className?: string
}

export default function Circuit3D({ parts, netOfNode, powered, litLeds, className }: Circuit3DProps) {
  const colors = useTokenColors()
  if (!colors) return null

  const jumperColor = (part: PlacedPart): string => {
    const nodes = part.holes.map((holeId) => parseHole(holeId)?.kind)
    if (nodes.includes('railTop')) return colors.fault
    if (nodes.includes('railBottom')) return colors.info
    return colors.accent
  }

  return (
    <Canvas
      className={className}
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 17, 18], fov: 31 }}
      gl={{ antialias: true, alpha: true }}
    >
      <StudioLights />

      <group rotation={[0, -0.15, 0]}>
        <Slab colors={colors} />
        <Holes colors={colors} netOfNode={netOfNode} powered={powered} />

        {parts.map((part) => {
          switch (part.type) {
            case 'jumper': {
              const [aId, bId] = part.holes
              const a = aId !== undefined ? holeVec(aId, SURFACE_Y - 0.1) : null
              const b = bId !== undefined ? holeVec(bId, SURFACE_Y - 0.1) : null
              if (a === null || b === null) return null
              return (
                <Jumper
                  key={part.id}
                  from={[a.x, a.y, a.z]}
                  to={[b.x, b.y, b.z]}
                  color={jumperColor(part)}
                  lift={Math.max(0.9, Math.hypot(b.x - a.x, b.z - a.z) * 0.22)}
                />
              )
            }
            case 'resistor':
              return <Resistor3D key={part.id} part={part} />
            case 'led':
              return <Led3D key={part.id} part={part} lit={litLeds.has(part.id)} colors={colors} />
            case 'capacitor':
              return <Capacitor3D key={part.id} part={part} />
            case 'diode':
              return <Diode3D key={part.id} part={part} />
            case 'transistor':
              return <Transistor3D key={part.id} part={part} />
            case 'ic':
              return null
          }
        })}
      </group>

      {/*
        Turn it in your hands: orbit and zoom, no pan — the board is the world
        here, and losing it off-screen is the only thing pan would add. The
        polar limit keeps the camera above the bench.
      */}
      <OrbitControls
        enablePan={false}
        minDistance={9}
        maxDistance={32}
        maxPolarAngle={Math.PI / 2.1}
        makeDefault
      />
    </Canvas>
  )
}
