const allowedEnvironments = ['local', 'development', 'production']

const webSocketUrls = {
  local: 'ws://127.0.0.1:8787',
  development: 'wss://worker.inrealtime.love',
  production: 'wss://worker.inrealtime.app',
}

const authUrls = {
  local: 'http://127.0.0.1:8787/auth',
  development: 'https://worker.inrealtime.love/auth',
  production: 'https://worker.inrealtime.app/auth',
}

export type RealtimeConfig = {
  environment: 'local' | 'development' | 'production'
  authUrl: string
  webSocketUrl: string
  debug: {
    conflicts: boolean
  }
  autosave: boolean
}

export const getRealtimeConfig = ({
  environment,
  debug,
  autosave,
}: {
  environment?: 'local' | 'development' | 'production'
  debug?: { conflicts?: boolean }
  autosave?: boolean
}): RealtimeConfig => {
  if (!environment || !allowedEnvironments.includes(environment)) {
    environment = 'production'
  }
  const authUrl = authUrls[environment]
  const webSocketUrl = webSocketUrls[environment]

  return {
    environment,
    authUrl,
    webSocketUrl,
    debug: {
      conflicts: debug?.conflicts ?? false,
    },
    autosave: !!autosave,
  }
}
