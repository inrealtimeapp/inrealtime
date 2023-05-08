import { RealtimeDocumentStatus } from '@inrealtime/react'
import { useWindowSize } from '@react-hookz/web'
import { KonvaEventObject } from 'konva/lib/Node'
import { useCallback } from 'react'
import { Layer, Rect, Stage } from 'react-konva'

import { useDocumentStatus, usePatch, usePatchMe, useStore } from '../../realtime.config'
import { Avatars } from './Avatars'
import { Cursors } from './Cursors'

const colorMap: { [key: string]: string } = {
  red: '#ef4444',
  green: '#10b981',
  blue: '#06b6d4',
  purple: '#8b5cf6',
}

export const Canvas = () => {
  const { width, height } = useWindowSize()
  const patch = usePatch()
  const patchMe = usePatchMe()
  const status = useDocumentStatus()
  const boxes = useStore((root) => root.boxes)

  const onBoxMoveStart = useCallback((id: string) => {
    patch((root) => {
      root.boxes[id].active = true
    })
    patchMe(
      {
        cursorActive: false,
      },
      { replace: false },
    )
  }, [])

  const onBoxMove = useCallback((id: string, evt: KonvaEventObject<DragEvent>) => {
    patch((root) => {
      root.boxes[id].x = evt.target.x()
      root.boxes[id].y = evt.target.y()
    })
  }, [])

  const onBoxMoveEnd = useCallback((id: string) => {
    patch((root) => {
      root.boxes[id].active = false
    })
    patchMe(
      {
        cursorActive: true,
      },
      { replace: false },
    )
  }, [])

  if (status !== RealtimeDocumentStatus.Ready) {
    return <div />
  }

  return (
    <div id='canvas-wrapper' className='relative'>
      <Cursors />

      <div className='fixed top-3 right-3'>
        <Avatars />
      </div>

      <Stage width={width} height={height}>
        <Layer>
          {Object.keys(boxes).map((boxId) => {
            const box = boxes[boxId]
            return (
              <Rect
                id={boxId}
                key={boxId}
                x={box.x}
                y={box.y}
                width={50}
                height={50}
                draggable
                cornerRadius={5}
                fill={colorMap[box.color]}
                stroke={`${colorMap[box.color]}80`}
                strokeWidth={box.active ? 8 : 0}
                onDragMove={(e) => {
                  onBoxMove(boxId, e)
                }}
                onMouseDown={() => onBoxMoveStart(boxId)}
                onMouseUp={() => onBoxMoveEnd(boxId)}
              />
            )
          })}
        </Layer>
      </Stage>
    </div>
  )
}
