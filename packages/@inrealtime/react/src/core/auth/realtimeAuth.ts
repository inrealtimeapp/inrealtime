import { RealtimeConfig } from '../../config'

export type GetAuthToken = ({ documentId }: { documentId: string }) => string | Promise<string>

export class RealtimeAuth {
  private readonly _config: RealtimeConfig
  private readonly _getAuthToken?: GetAuthToken
  private readonly _publicAuthKey?: string
  constructor({
    config,
    getAuthToken,
    publicAuthKey,
  }: {
    config: RealtimeConfig
    getAuthToken?: GetAuthToken
    publicAuthKey?: string
  }) {
    this._config = config
    this._getAuthToken = getAuthToken
    this._publicAuthKey = publicAuthKey
  }

  async auth({ documentId }: { documentId: string }): Promise<{
    socketUrl: string
    projectId: string
    documentId: string
    authExpiryTime: number
    token: string
  }> {
    let token: string
    if (this._getAuthToken) {
      token = await this._getAuthToken({ documentId })

      if (this._publicAuthKey) {
        console.warn(
          "Both 'getAuthToken' and 'publicAuthKey' were provided. 'getAuthToken' will be used.",
        )
      }
    } else if (this._publicAuthKey) {
      if (!this._publicAuthKey.startsWith('public_')) {
        throw new Error(`Invalid 'publicAuthKey'. It should start with 'public_'.`)
      }

      const response = await fetch(this._config.authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          authKey: this._publicAuthKey,
        }),
        credentials: 'include',
      })
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `Either a wrong 'publicAuthKey' was provided or 'publicAuthKey' is not enabled.`,
        )
      }

      token = (await response.json()).token
    } else {
      throw new Error(`Either 'getAuthToken' or 'publicAuthKey' must be provided.`)
    }

    const tokenPayload = JSON.parse(atob(token.split('.')[1]))
    const projectId = tokenPayload.projectId

    return {
      socketUrl: `${this._config.webSocketUrl}/projects/${projectId}/documents/${documentId}`,
      projectId,
      documentId,
      authExpiryTime: tokenPayload.exp,
      token,
    }
  }
}
