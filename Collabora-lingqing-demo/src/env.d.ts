/// <reference types="vite/client" />
/// <reference types="n-designv3/typings/global" />

interface ImportMetaEnv {
  readonly VITE_PORT?: string
  readonly VITE_COLLABORA_URL?: string
  readonly VITE_WOPI_PUBLIC_ORIGIN?: string
  readonly VITE_CHATBOX_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
