import { IndexedAutosave } from './channels/document/autosave/indexeddb_autosave'
import { isMap } from './core'

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
  autosave: VerboseAutosave
}

type VerboseAutosave = {
  enabled: boolean
  storeNamePostfix: string
  disableWarning: boolean
}
type VerboseAutosaveOption = Partial<VerboseAutosave>

export type AutosaveOption = boolean | VerboseAutosaveOption

/**
 * Get realtime config
 */
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
  autosave?: AutosaveOption
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
    autosave: getAutosaveConfig(autosave),
  }
}

/**
 * Get autosave config
 */
export const getAutosaveConfig = (autosave?: AutosaveOption | VerboseAutosaveOption) => {
  let autosaveObj: VerboseAutosave = {
    enabled: false,
    storeNamePostfix: 'default',
    disableWarning: false,
  }
  if (autosave && isMap(autosave)) {
    const verboseAutosave = autosave as VerboseAutosaveOption
    autosaveObj = {
      enabled: verboseAutosave.enabled === undefined || verboseAutosave.enabled, // Default if autosave={} then it is enabled
      storeNamePostfix: verboseAutosave.storeNamePostfix ?? autosaveObj.storeNamePostfix,
      disableWarning: !!verboseAutosave?.disableWarning,
    }
  } else if (autosave) {
    autosaveObj.enabled = true
  }
  return autosaveObj
}

/**
 * IndexedAutosave instances are cached here
 */
const indexedAutosaveMap: { [key: string]: IndexedAutosave } = {}
export const getIndexedAutosaveInstance = ({
  storeNamePostfix,
  disableWarning,
}: {
  storeNamePostfix: string
  disableWarning: boolean
}) => {
  if (!indexedAutosaveMap[storeNamePostfix]) {
    indexedAutosaveMap[storeNamePostfix] = new IndexedAutosave({ storeNamePostfix, disableWarning })
  }
  return indexedAutosaveMap[storeNamePostfix]
}
