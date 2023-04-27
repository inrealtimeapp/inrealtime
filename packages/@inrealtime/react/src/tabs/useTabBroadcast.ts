import { useCallback, useEffect, useRef } from 'react'

const useTabBroadcast = (channelName, onMessage: (data: any) => void) => {
  const channelRef = useRef<BroadcastChannel>()

  const postTabMessage = useCallback((data: any) => {
    channelRef.current?.postMessage(data)
  }, [])

  useEffect(() => {
    const channel = new BroadcastChannel(channelName)
    channelRef.current = channel

    const handleMessage = (event: MessageEvent) => {
      onMessage(event.data)
    }

    channel.addEventListener('message', handleMessage)

    return () => {
      channel.removeEventListener('message', handleMessage)
      channel.close()
    }
  }, [channelName, onMessage])

  return { postTabMessage }
}

export default useTabBroadcast
