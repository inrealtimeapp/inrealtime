import { RealtimePresenceStatus } from '@inrealtime/react'
import { IconPointer } from '@tabler/icons-react'
import { motion, useWillChange } from 'framer-motion'
import { useEffect, useRef } from 'react'

import { useCollaborators, useMe, usePatchMe, usePresenceStatus } from '../../realtime.config'
import { formatEmoji } from '../utils/formatEmoji'

interface CursorProps {
  x: number
  y: number
  emoji: string
  active: boolean
}

const Cursor = ({ x = 0, y = 0, emoji, active = false }: CursorProps) => {
  const willChange = useWillChange()

  return (
    <motion.div
      className='absolute'
      animate={{ x, y }}
      style={{ willChange }}
      transition={{ ease: 'easeOut', duration: 0.2 }}
    >
      <div className={`relative ${active ? 'opacity-100' : 'opacity-0'}`}>
        <IconPointer size={12} className='absolute text-pink-500/20 fill-pink-500/80' />
        <div className='absolute text-sm font-semibold top-1 left-3.5'>{formatEmoji(emoji)}</div>
      </div>
    </motion.div>
  )
}

export const Cursors = () => {
  const collaborators = useCollaborators()
  const status = usePresenceStatus()
  const cursorActive = useMe((root) => root?.data?.cursorActive)
  const cursorActiveRef = useRef(false)
  const patchMe = usePatchMe()

  const onCursorMoveRef = useRef<EventListener>()
  const onCursorLeaveRef = useRef<EventListener>()
  const onCursorEnterRef = useRef<EventListener>()
  const moveRef = useRef((e: Event) => onCursorMoveRef.current?.(e))
  const leaveRef = useRef((e: Event) => onCursorLeaveRef.current?.(e))
  const enterRef = useRef((e: Event) => onCursorEnterRef.current?.(e))

  useEffect(() => {
    if (status !== RealtimePresenceStatus.Ready) {
      return
    }

    onCursorMoveRef.current = (e: Event) => {
      if (!cursorActiveRef.current) {
        return
      }

      patchMe({
        cursor: {
          x: (e as any).x,
          y: (e as any).y,
        },
      })
    }

    onCursorEnterRef.current = () => {
      patchMe(
        {
          cursorActive: true,
        },
        { replace: false },
      )
    }

    onCursorLeaveRef.current = () => {
      patchMe(
        {
          cursorActive: false,
        },
        { replace: false },
      )
    }
  }, [status])

  useEffect(() => {
    const elem = document.querySelector('#canvas-wrapper')

    if (elem) {
      elem.addEventListener('mousemove', moveRef.current)
      elem.addEventListener('mouseleave', leaveRef.current)
      elem.addEventListener('mouseenter', enterRef.current)
    }

    return () => {
      if (elem) {
        elem.removeEventListener('mousemove', moveRef.current)
        elem.removeEventListener('mouseleave', leaveRef.current)
        elem.removeEventListener('mouseenter', enterRef.current)
      }
    }
  }, [])

  useEffect(() => {
    cursorActiveRef.current = !!cursorActive
  }, [cursorActive])

  return (
    <div className='absolute top-0 bottom-0 left-0 right-0 bg-transparent z-10 pointer-events-none'>
      {(collaborators as any)
        ?.filter((collaborator: any) => !!collaborator.data?.cursor)
        ?.map((collaborator: any) => {
          return (
            <Cursor
              key={collaborator.clientId}
              x={collaborator.data?.cursor?.x}
              y={collaborator.data?.cursor?.y}
              emoji={collaborator.data?.emoji}
              active={collaborator.data?.cursorActive}
            />
          )
        })}
    </div>
  )
}
