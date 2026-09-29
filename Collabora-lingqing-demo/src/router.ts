import type { Component } from 'vue'
import App from './App.vue'
import DocumentsPage from './pages/DocumentsPage.vue'
import ChatboxPage from './pages/ChatboxPage.vue'

interface AppRoute {
  path: string
  component: Component
}

export const AIDOC_PATH = '/aidoc'
export const AIDOC_EDITOR_PATH = '/aidoc/editor'
export const AIDOC_CHATBOX_PATH = '/aidoc/chatbox'

export const routes: AppRoute[] = [
  { path: AIDOC_PATH, component: DocumentsPage },
  { path: '/', component: DocumentsPage },
  { path: AIDOC_EDITOR_PATH, component: App },
  { path: AIDOC_CHATBOX_PATH, component: ChatboxPage },
]

export function resolveRoute(pathname: string): Component {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return routes.find(({ path }) => path === normalizedPath)?.component ?? DocumentsPage
}
