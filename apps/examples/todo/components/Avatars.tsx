import { useCollaborators, useMe, usePatchMe, usePresenceStatus } from '@/realtime.config'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect } from 'react'
import { shallow } from 'zustand/shallow'
import { RealtimePresenceStatus } from '@inrealtime/react'

const emojis = [
  '🥰',
  '🔥',
  '😶',
  '🏎️',
  '🧠',
  '😶‍🌫️',
  '👀',
  '🤙',
  '🍺',
  '🫖',
  '☕️',
  '🚀',
  '😅',
  '😇',
  '🥸',
  '🥳',
]

const encodeEmoji = (emoji: string) => {
  return emoji?.codePointAt(0)?.toString(16) ?? ''
}

const decodeEmoji = (hex: any) => {
  if (hex === undefined) {
    return ''
  }

  return String.fromCodePoint(parseInt(`${hex}`, 16))
}

const formatEmojio = (emoji: string) => {
  return decodeEmoji(encodeEmoji(emoji))
}

export const Avatars = () => {
  const presenceStatus = usePresenceStatus()

  const patchMe = usePatchMe()

  const collaboratorData = useCollaborators(
    (collaborators) =>
      collaborators.map((c) => ({
        clientId: c.clientId,
        emoji: c.data?.emoji ?? '☺️',
      })),
    shallow,
  )
  const myEmoji = useMe((me) => me.data?.emoji)

  const updateMyEmoji = useCallback(() => {
    const emoji = formatEmojio(emojis[Math.floor(Math.random() * emojis.length)])

    patchMe({
      emoji,
    })
  }, [patchMe])

  useEffect(() => {
    if (presenceStatus === RealtimePresenceStatus.Ready && !myEmoji) {
      updateMyEmoji()
    }
  }, [presenceStatus])

  const avatarClassName =
    'h-8 w-8 bg-neutral-100 border border-neutral-200 rounded-full flex items-center justify-center -ml-1 shadow-md cursor-default'

  const connected = collaboratorData?.length + 1

  return (
    <div className='my-3 flex flex-col gap-3'>
      <div className='mx-2 flex items-center'>
        {!!myEmoji && (
          <div
            role='img'
            className={`${avatarClassName} bg-pink-500/20 ring-2 ring-pink-500/50 ring-offset-2 ring-offset-neutral-50`}
          >
            {formatEmojio(myEmoji)}
          </div>
        )}
        <AnimatePresence>
          {collaboratorData?.map(({ clientId, emoji }) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              key={clientId}
              role='img'
              className={`${avatarClassName}`}
            >
              {formatEmojio(emoji)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {presenceStatus === RealtimePresenceStatus.Ready && (
        <div className='text-neutral-500 text-sm'>
          <span className='font-semibold'>{connected}</span> {connected === 1 ? 'user' : 'users'}{' '}
          connected
        </div>
      )}
    </div>
  )
}
