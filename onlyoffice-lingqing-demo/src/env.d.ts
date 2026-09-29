/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PORT?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ONLYOFFICE_SERVER_URL?: string
  readonly VITE_DEMO_DOCUMENT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (
        containerId: string,
        config: Record<string, unknown>,
      ) => {
        destroyEditor?: () => void
      }
    }
  }
}

export {}
