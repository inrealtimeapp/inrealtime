import { RealtimeMessage } from '../types/realtimeMessage'

type onHook = (() => void) | (() => Promise<void>)
type onMessageHook =
  | ((channel: string, message: RealtimeMessage) => void)
  | ((channel: string, message: RealtimeMessage) => Promise<void>)

export class RealtimeWebSocket {
  private _webSocket?: WebSocket
  private _socketUrl?: string
  private readonly _onOpen?: onHook
  private readonly _onConnecting?: onHook
  private readonly _onClose?: onHook
  private readonly _onMessage?: onMessageHook
  constructor({
    onOpen,
    onConnecting,
    onClose,
    onMessage,
  }: {
    onOpen?: onHook
    onConnecting?: onHook
    onClose?: onHook
    onMessage?: onMessageHook
  }) {
    this._onOpen = onOpen
    this._onConnecting = onConnecting
    this._onClose = onClose
    this._onMessage = onMessage
  }

  setSocketUrl({ socketUrl }: { socketUrl: string }) {
    this._socketUrl = socketUrl
  }

  _jsonStringifyReplacer(k: string, v: any) {
    return v === undefined ? null : v
  }

  sendMessage(channel: string, message: RealtimeMessage) {
    // console.log(`Sending message on channel '${channel}' with type '${message.type}'.`)
    this._webSocket?.send(`${channel}:${JSON.stringify(message, this._jsonStringifyReplacer)}`)
  }

  close() {
    this._close(this._webSocket)
  }

  _close(webSocket?: WebSocket) {
    if (!webSocket) {
      return
    }
    try {
      webSocket.close()
    } catch (e) {
      console.error(e)
    }
  }

  connect() {
    if (!this._socketUrl) {
      throw new Error('Missing socket url.')
    }

    this._close(this._webSocket)
    const webSocket = new WebSocket(this._socketUrl)

    webSocket.onopen = () => {
      if (this._onOpen) {
        this._onOpen()
      }
    }

    webSocket.onclose = (e) => {
      if (this._onClose) {
        this._onClose()
      }
      console.log(`Socket closed with code '${e.code}', type '${e.type}' and reason '${e.reason}'.`)
    }

    webSocket.onerror = () => {
      this._close(webSocket)
    }

    webSocket.onmessage = (e) => {
      if (!this._onMessage) {
        console.log(`Ignored message '${e.data}' as no onMessage hook was found.`)
        return
      }

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

      //console.log(`Received message on channel '${channel}' and type '${message.type}'`);
      this._onMessage(channel, message)
    }

    this._webSocket = webSocket

    if (this._onConnecting) {
      this._onConnecting()
    }
  }
}
