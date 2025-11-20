import './index.css'
import { createRoot } from 'react-dom/client'
import React, { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import studio from '@theatre/studio'
import extension from '@theatre/r3f/dist/extension'
import { SheetProvider, editable as e, PerspectiveCamera } from '@theatre/r3f'
import { getProject } from '@theatre/core'
import demoProjectState from './state.json'

studio.initialize()
studio.extend(extension)

const demoSheet = getProject('Demo Project', { state: demoProjectState }).sheet('Demo Sheet')
//const demoSheet = getProject('Demo Project').sheet('Demo Sheet')
const App = () => {
  useEffect(() => {
    demoSheet.project.ready.then(() => demoSheet.sequence.play({ iterationCount: Infinity, range: [0, 1] }))
  }, [])

  return (
    <Canvas>
      <SheetProvider sheet={demoSheet}>
        <PerspectiveCamera theatreKey="Camera" makeDefault position={[0, 0, 0]} fov={75} />
        <ambientLight />
        <e.pointLight theatreKey="Light" position={[1, 1, 1]} />
        <e.mesh theatreKey="Cube">
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="orange" />
        </e.mesh>
      </SheetProvider>
    </Canvas>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
