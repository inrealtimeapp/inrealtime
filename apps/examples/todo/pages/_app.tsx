import '@/styles/globals.css'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { AppProps } from 'next/app'
import Head from 'next/head'

import { RealtimeGroupProvider } from '@/realtime.config'

dayjs.extend(utc)

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Realtime Example | Todo</title>
      </Head>
      <RealtimeGroupProvider
        groupId={'group'}
        publicAuthKey={process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY}
        throttle={20}
        _package={{ environment: 'local' }}
        //autosave={{ storeNamePostfix: 'test', disableWarning: true }}
      >
        <Component {...pageProps} />
      </RealtimeGroupProvider>
    </>
  )
}
