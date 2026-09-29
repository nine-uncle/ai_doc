import { createApp, h } from 'vue'
import NDesign, { ConfigProvider } from 'n-designv3'
import zhCN from 'n-designv3/es/locale/zh_CN'
import { resolveRoute } from './router'
import 'n-designv3/dist/nancal.variable.min.css'
import './styles/global.css'

const Page = resolveRoute(window.location.pathname)

createApp({
  render: () =>
    h(
      ConfigProvider,
      {
        locale: zhCN,
        class: 'app-locale',
      },
      { default: () => h(Page) },
    ),
})
  .use(NDesign)
  .mount('#app')
