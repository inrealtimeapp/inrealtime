import '@/styles/globals.css'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { AppProps } from 'next/app'
import Head from 'next/head'

import { RealtimeProvider } from '@/realtime.config'
import { useMemo } from 'react'

dayjs.extend(utc)

export default function App({ Component, pageProps }: AppProps) {
  const startOfHour = '1' //useMemo(() => dayjs().utc().format('YYMMDDHH').toString(), [])
  return (
    <>
      <Head>
        <title>Realtime Example | Todo</title>
      </Head>

      <RealtimeProvider
        documentId={startOfHour}
        publicAuthKey={process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY}
        throttle={20}
        autosave
      >
        <Component {...pageProps} />
      </RealtimeProvider>
    </>
  )
}
