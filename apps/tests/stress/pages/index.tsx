import { useRealtime } from '@inrealtime/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { shallow } from 'zustand/shallow'

type Root = {
  nodes: { n: string; position: { x: number; y: number } }[]
}

function randomIntFromInterval(min: number, max: number) {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min)
}

export default function Home() {
  const [documentId, setDocumentId] = useState<string>('test_document')
  const randomEnabledRef = useRef(false)
  const [fakeState, setFakeState] = useState(0)

  const { status, useStore, patch, useMe, useCollaborators } = useRealtime<Root, any>({
    documentId,
    publicAuthKey: process.env.NEXT_PUBLIC_REALTIME_PUBLIC_AUTH_KEY,
    _package: {
      environment: process.env.NEXT_PUBLIC_REALTIME_DEVELOPMENT_ENVIRONMENT as any,
      logging: {
        conflicts: true,
      },
    },
    throttle: 15,
  })

  const doRandom = useCallback(() => {
    if (!randomEnabledRef.current) {
      return
    }

    patch((root) => {
      if (!root.nodes || root.nodes.length > 35) {
        root.nodes = [
          {
            n: `node-${randomIntFromInterval(0, 300)}`,
            position: { x: randomIntFromInterval(50, 200), y: randomIntFromInterval(50, 200) },
          },
          {
            n: `node-${randomIntFromInterval(0, 300)}`,
            position: { x: randomIntFromInterval(50, 200), y: randomIntFromInterval(50, 200) },
          },
        ] as any
      }

      const getRandomIndex = () => randomIntFromInterval(0, root.nodes.length - 1)

      const ids = [0, 1, 2, 3, 4, 5]
      const ranIndex = randomIntFromInterval(0, ids.length - 1)
      const ran: number = ids[ranIndex]
      switch (ran) {
        case 0:
          {
            const index = getRandomIndex()
            // console.log('Removed node from list from index ' + index)
            if (root.nodes.length <= 10) {
              return
            }
            // Remove random node
            root.nodes.splice(index, 1)
          }
          break
        case 1:
          {
            if (root.nodes.length >= 30) {
              return
            }
            // Insert random node at a random index
            const index = getRandomIndex()
            // console.log('Added node to list at index ' + index)

            root.nodes.splice(index, 0, {
              n: `node-${randomIntFromInterval(0, 300)}`,
              position: { x: randomIntFromInterval(50, 200), y: randomIntFromInterval(50, 200) },
            } as any)
          }
          break
        case 2:
          {
            if (root.nodes.length <= 0) {
              return
            }
            // Move random node
            const oldIndex = getRandomIndex()
            const newIndex = getRandomIndex()
            // console.log(`Moved index ${oldIndex} -> ${newIndex}`)
            root.nodes.splice(newIndex, 0, root.nodes.splice(oldIndex, 1)[0])
          }
          break
        case 3:
          {
            if (root.nodes.length <= 0) {
              return
            }
            const index = getRandomIndex()
            // console.log(`Updated position on node at index ${index}`)
            // Set random node's position
            root.nodes[index].position = {
              x: randomIntFromInterval(50, 200),
              y: randomIntFromInterval(50, 200),
            }
          }
          break
        case 4:
          {
            // Replace a random node
            if (root.nodes.length <= 0) {
              return
            }
            const index = getRandomIndex()
            // console.log(`Updated position on node at index ${index}`)
            // Set random node's position
            root.nodes[index] = {
              n: `node-${randomIntFromInterval(0, 300)}`,
              position: { x: randomIntFromInterval(50, 200), y: randomIntFromInterval(50, 200) },
            } as any
          }
          break
        case 5:
          {
            // Replace a random node's x and y
            if (root.nodes.length <= 0) {
              return
            }
            const index = getRandomIndex()

            // Set random node's position
            root.nodes[index].position.x = randomIntFromInterval(50, 200)
            root.nodes[index].position.y = randomIntFromInterval(50, 200)
          }
          break
      }
    })
  }, [])

  const randomInterval = useRef<NodeJS.Timer>()
  useEffect(() => {
    randomInterval.current = setInterval(() => {
      doRandom()
    }, 15)

    return () => {
      clearInterval(randomInterval.current!)
    }
  }, [])

  const randomDocumentId = () => {
    setDocumentId(`doc-${randomIntFromInterval(0, 10000)}`)
  }

  const nodes = useStore((root) => {
    return root?.nodes?.map((n) => ({
      n: n.n,
      x: n.position.x,
      y: n.position.y,
    }))
  }, shallow)

  const me = useMe()
  const collaborators = useCollaborators()

  return (
    <div>
      <div
        onClick={() => {
          randomEnabledRef.current = !randomEnabledRef.current
          setFakeState(fakeState + 1)
        }}
      >
        Random enabled? {randomEnabledRef?.current ? 'yes' : 'no'}
      </div>
      <div>Status: {status}</div>
      <div>Document id: {documentId}</div>
      <button onClick={randomDocumentId}>Set random documentId</button>
      <div>Me: {me && JSON.stringify(me)}</div>
      <div>Collaborators: {collaborators && JSON.stringify(collaborators)}</div>
      <div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(JSON.stringify(nodes))
          }}
        >
          Copy to clipboard
        </button>
      </div>
      <div>{JSON.stringify(nodes)}</div>
      <div>{nodes?.length}</div>
    </div>
  )
}
