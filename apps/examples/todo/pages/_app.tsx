import '@/styles/globals.css'

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import type { AppProps } from 'next/app'
import Head from 'next/head'

import { RealtimeProvider } from '@/realtime.config'
import { useState } from 'react'
import { useAutosave } from '@inrealtime/react'

dayjs.extend(utc)

export default function App({ Component, pageProps }: AppProps) {
  const [startOfHour, setStartOfHour] = useState('123')
  //const startOfHour = useMemo(() => dayjs().utc().format('YYMMDDHH').toString(), [])
  const { createNewDocument } = useAutosave({ storeNamePostfix: 'test', disableWarning: true })

  return (
    <>
      <Head>
        <title>Realtime Example | Todo</title>
      </Head>
      <button
        onClick={() => {
          const id = `${Math.floor(Math.random() * 5000) + 10000}`
          createNewDocument({
            documentId: id,
            document: {
              todos: [
                {
                  id: '1',
                  label: 'test',
                  isCompleted: false,
                },
                {
                  id: '2',
                  label: 'test2',
                  isCompleted: true,
                },
              ],
            },
          }).then(() => {
            setStartOfHour(id)
            console.log('Id is set', id)
          })
        }}
      >
        Test
      </button>
      <RealtimeProvider
        documentId={startOfHour}
        publicAuthKey={process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY}
        throttle={20}
        _package={{ environment: 'local' }}
        //autosave={{ storeNamePostfix: 'test', disableWarning: true }}
      >
        <Component {...pageProps} />
      </RealtimeProvider>
    </>
  )
}
