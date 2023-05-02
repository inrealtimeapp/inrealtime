import '@/styles/globals.css'

import type { AppProps } from 'next/app'
import Head from 'next/head'

import { RealtimeDirectoryProvider, RealtimeGroupProvider } from '@/realtime.config'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Realtime Tests | Group Docs</title>
      </Head>

      <RealtimeGroupProvider
        groupId='group-documents'
        publicAuthKey={process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY}
        throttle={60}
        _package={{ environment: process.env.NEXT_PUBLIC_REALTIME_DEVELOPMENT_ENVIRONMENT }}
      >
        <RealtimeDirectoryProvider documentId='folder'>
          <Component {...pageProps} />
        </RealtimeDirectoryProvider>
      </RealtimeGroupProvider>
    </>
  )
}
