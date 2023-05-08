import { RealtimePresenceStatus } from '@inrealtime/react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect } from 'react'
import { shallow } from 'zustand/shallow'

import { useCollaborators, useMe, usePatchMe, usePresenceStatus } from '../../realtime.config'
import { formatEmoji } from '../utils/formatEmoji'

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

export const Avatars = () => {
  const presenceStatus = usePresenceStatus()
  const patchMe = usePatchMe()

  const collaboratorData = useCollaborators(
    (collaborators) =>
      collaborators.map((c) => ({
        clientId: c.clientId,
        emoji: c.data?.emoji ?? '💀',
      })),
    shallow,
  )
  const myEmoji = useMe((me) => me.data?.emoji)

  const updateMyEmoji = useCallback(() => {
    const emoji = formatEmoji(emojis[Math.floor(Math.random() * emojis.length)])

    patchMe({
      emoji,
    })
  }, [])

  useEffect(() => {
    if (presenceStatus === RealtimePresenceStatus.Ready && !myEmoji) {
      updateMyEmoji()
    }
  }, [presenceStatus, myEmoji, updateMyEmoji])

  const avatarClassName =
    'h-8 w-8 bg-neutral-900 border border-pink-500 rounded-full flex items-center justify-center -ml-1 shadow-md cursor-default'

  const connected = collaboratorData?.length + 1

  return (
    <div className='flex flex-col gap-1.5'>
      <div className='mx-2 flex flex-row-reverse items-center'>
        {presenceStatus === RealtimePresenceStatus.Ready && (
          <div
            role='img'
            className={`${avatarClassName} bg-pink-500/20 ring-2 ring-pink-500/50 ring-offset-2 ring-offset-neutral-950`}
          >
            {formatEmoji(myEmoji ?? '💀')}
          </div>
        )}
        <AnimatePresence>
          {collaboratorData?.map(({ clientId, emoji }) => (
            <motion.div
              key={clientId}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              role='img'
              className={`${avatarClassName}`}
            >
              {formatEmoji(emoji)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {presenceStatus === RealtimePresenceStatus.Ready && (
        <div className='text-slate-500 text-xs'>
          <span className='font-semibold'>{connected}</span> {connected === 1 ? 'user' : 'users'}{' '}
          connected
        </div>
      )}
    </div>
  )
}
