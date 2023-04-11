import { IconGripVertical, IconX } from '@tabler/icons-react'
import { Reorder, useDragControls } from 'framer-motion'

import { TodoItem, usePatch } from '@/realtime.config'

interface ItemProps {
  item: TodoItem
}

export const Item = ({ item }: ItemProps) => {
  const patch = usePatch()
  const controls = useDragControls()

  const onClickCheck = () => {
    patch((root) => {
      if (!root?.todos) {
        return
      }

      const items = root.todos
      const foundItem = items.find((it: TodoItem) => it.id === item.id)

      if (foundItem) {
        foundItem.isCompleted = !foundItem.isCompleted
      }
    })
  }

  const onClickRemove = () => {
    patch((root) => {
      if (!root?.todos) {
        return
      }

      const items = root.todos
      const foundIndex = items.map((it: TodoItem) => it.id).indexOf(item.id)
      items.splice(foundIndex, 1)
    })
  }

  return (
    <Reorder.Item id={item.id} value={item} dragListener={false} dragControls={controls}>
      <div
        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded bg-neutral-100 border border-neutral-300 transition-opacity select-none ${
          item.isCompleted && 'opacity-60'
        }`}
      >
        <div
          className='reorder-handle group cursor-grab -ml-2 -mr-1 py-2 px-1 rounded bg-neutral-200/0 hover:bg-neutral-200/100 transition-colors touch-none'
          onPointerDown={(e) => controls.start(e)}
        >
          <IconGripVertical
            size={16}
            className='text-neutral-500 group-hover:text-neutral-700 transition-colors touch-none'
          />
        </div>

        <input
          id='isCompleted'
          className='checkbox shrink-0'
          type='checkbox'
          checked={item.isCompleted}
          onChange={onClickCheck}
        />

        <div
          className={`flex items-center text-left grow font-medium text-base select-none ${
            item.isCompleted && 'line-through'
          }`}
        >
          {item.label}
        </div>

        <button className='icon-btn shrink-0' onClick={onClickRemove} type='button'>
          <IconX size={16} />
        </button>
      </div>
    </Reorder.Item>
  )
}
