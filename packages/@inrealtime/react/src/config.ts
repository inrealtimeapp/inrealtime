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
  logging: {
    conflicts: boolean
    socketStatus: boolean
    listFragmentIndexes: boolean
    localOperations: boolean
    remoteOperations: boolean
  }
  autosave: boolean
}

export const getRealtimeConfig = ({
  environment,
  logging,
  autosave,
}: {
  environment?: 'local' | 'development' | 'production'
  logging?: {
    conflicts?: boolean
    socketStatus?: boolean
    listFragmentIndexes?: boolean
    localOperations?: boolean
    remoteOperations?: boolean
  }
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
    logging: {
      conflicts: logging?.conflicts ?? false,
      socketStatus: logging?.socketStatus ?? false,
      listFragmentIndexes: logging?.listFragmentIndexes ?? false,
      localOperations: logging?.localOperations ?? false,
      remoteOperations: logging?.remoteOperations ?? false,
    },
    autosave: !!autosave,
  }
}
