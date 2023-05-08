import { useMemo } from 'react'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { RealtimeProvider } from '../realtime.config'
import { Canvas } from './components/canvas'

dayjs.extend(utc)

function App() {
  const startOfHour = useMemo(() => dayjs().utc().format('YYMMDDHH').toString(), [])

  return (
    <RealtimeProvider
      documentId={startOfHour}
      publicAuthKey={import.meta.env.VITE_REALTIME_PUBLIC_AUTH_KEY}
      throttle={50}
    >
      <Canvas />
    </RealtimeProvider>
  )
}

export default App
