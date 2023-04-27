import '@/styles/globals.css'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { AppProps } from 'next/app'
import Head from 'next/head'

import { RealtimeProvider } from '@/realtime.config'
import { useMemo, useState } from 'react'
import { useAutosave } from '@inrealtime/react'

dayjs.extend(utc)

export default function App({ Component, pageProps }: AppProps) {
  const [startOfHour, setStartOfHour] = useState('3294')
  //const startOfHour = '3294' //useMemo(() => dayjs().utc().format('YYMMDDHH').toString(), [])
  const { createNewDocument } = useAutosave({ disableWarning: true, storeNamePostfix: 'test' })
  return (
    <>
      <Head>
        <title>Realtime Example | Todo</title>
      </Head>
      <RealtimeProvider
        documentId={startOfHour}
        publicAuthKey={process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY}
        throttle={20}
        autosave={{ disableWarning: true, storeNamePostfix: 'test' }}
        _package={{
          environment: 'development',
          logging: {
            socketStatus: true,
          },
        }}
      >
        <button
          onClick={() => {
            const id = Math.floor(Math.random() * 5000 + 1)
            createNewDocument({
              documentId: `${id}`,
              document: {
                todos: [
                  {
                    id: '1',
                    label: 'Test',
                    isCompleted: false,
                  },
                ],
              },
            })
              .catch((err) => {
                console.log(err)
              })
              .then(() => {
                console.log('Created ids ', id)
                setStartOfHour(`${id}`)
              })
          }}
        >
          Test
        </button>
        <Component {...pageProps} />
      </RealtimeProvider>
    </>
  )
}
