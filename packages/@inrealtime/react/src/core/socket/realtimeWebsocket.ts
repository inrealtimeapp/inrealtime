import { RealtimeConfig } from '../../config'
import { RealtimeMessage } from '../types/realtimeMessage'

type onHook = (() => void) | (() => Promise<void>)
type onMessageHook =
  | ((channel: string, message: RealtimeMessage) => void)
  | ((channel: string, message: RealtimeMessage) => Promise<void>)

const socketTimeout = 15000

export class RealtimeWebSocket {
  private _webSocket?: WebSocket
  private _socketUrl?: string
  private readonly _onOpen?: onHook
  private readonly _onConnecting?: onHook
  private readonly _onClose?: onHook
  private readonly _onMessage?: onMessageHook
  private readonly _config?: RealtimeConfig
  private _lastReceivedMessage?: Date
  private _timeoutTimer?: any
  constructor({
    onOpen,
    onConnecting,
    onClose,
    onMessage,
    config,
  }: {
    onOpen?: onHook
    onConnecting?: onHook
    onClose?: onHook
    onMessage?: onMessageHook
    config?: RealtimeConfig
  }) {
    this._onOpen = onOpen
    this._onConnecting = onConnecting
    this._onClose = onClose
    this._onMessage = onMessage
    this._config = config
  }

  setSocketUrl({ socketUrl }: { socketUrl: string }) {
    this._socketUrl = socketUrl
  }

  _jsonStringifyReplacer(k: string, v: any) {
    return v === undefined ? null : v
  }

  sendMessage(channel: string, message: RealtimeMessage) {
    if (this._webSocket?.readyState !== WebSocket.OPEN) {
      return
    }

    // console.log(`Sending message on channel '${channel}' with type '${message.type}'.`)
    this._webSocket?.send(`${channel}:${JSON.stringify(message, this._jsonStringifyReplacer)}`)
  }

  close() {
    this._close(this._webSocket)
  }

  _close(webSocket?: WebSocket) {
    if (this._timeoutTimer !== undefined) {
      clearInterval(this._timeoutTimer)
    }

    if (!webSocket) {
      return
    }

    // We need to do this automatically to avoid for waiting for close of websocket below
    if (this._onClose) {
      this._onClose()
    }

    try {
      webSocket.close(1000, 'Closing socket manually')
    } catch (e) {
      console.error(e)
    }
  }

  connect() {
    if (!this._socketUrl) {
      throw new Error('Missing socket url.')
    }

    const webSocket = new WebSocket(this._socketUrl)
    this._webSocket = webSocket

    this._lastReceivedMessage = new Date()
    this._timeoutTimer = setInterval(() => {
      const now = new Date()
      if (now.getTime() - this._lastReceivedMessage!.getTime() > socketTimeout) {
        if (this._config?.logging.socketStatus) console.log(`Closing socket in timeout timer`)
        this._close(webSocket)
      }
    }, socketTimeout / 2)

    webSocket.onopen = () => {
      if (this._onOpen) {
        this._onOpen()
      }
    }

    webSocket.onclose = (e) => {
      if (this._onClose) {
        this._onClose()
      }
      if (e && e.code === 3000) {
        console.warn(
          `Socket closed with code '${e.code}', type '${e.type}' and reason '${e.reason}'.`,
        )
      } else if (this._config?.logging.socketStatus) {
        console.log(
          `Socket closed with code '${e.code}', type '${e.type}' and reason '${e.reason}'.`,
        )
      }
    }

    webSocket.onerror = () => {
      if (this._config?.logging.socketStatus) console.log(`Closing socket in onError`)
      this._close(webSocket)
    }

    webSocket.onmessage = (e) => {
      if (!this._onMessage) {
        console.log(`Ignored message '${e.data}' as no onMessage hook was found.`)
        return
      }

      this._lastReceivedMessage = new Date()

      const unparsedMessage = e?.data
      if (!unparsedMessage) {
        return
      }

      const indexOfColon = unparsedMessage.indexOf(':')

      if (indexOfColon < 0) {
        console.error('Invalid formatted message from server.')
        return
      }

      const channel = unparsedMessage.substring(0, indexOfColon)
      const messageStr = unparsedMessage.substring(indexOfColon + 1)

      let message: RealtimeMessage

      try {
        message = JSON.parse(messageStr)
      } catch (e) {
        console.error('Invalid JSON in message from server.')
        return
      }

      //console.log(`Received message on channel '${channel}' and type '${message.type}'`)
      this._onMessage(channel, message)
    }

    if (this._onConnecting) {
      this._onConnecting()
    }
  }
}
