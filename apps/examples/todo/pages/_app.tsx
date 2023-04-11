import '@/styles/globals.css'

import dayjs from 'dayjs'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { useMemo } from 'react'

import { RealtimeProvider } from '@/realtime.config'

export default function App({ Component, pageProps }: AppProps) {
  const startOfHour = useMemo(() => dayjs().utc().format('YYMMDDHH').toString(), [])
  return (
    <>
      <Head>
        <title>Realtime Example | Todo</title>
      </Head>

      <RealtimeProvider
        documentId={startOfHour}
        publicAuthKey={process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY}
        throttle={50}
      >
        <Component {...pageProps} />
      </RealtimeProvider>
    </>
  )
}
