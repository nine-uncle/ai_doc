import type { FlatTocNode } from '@/types/document'

export const MOCK_TOC: FlatTocNode[] = [
  { id: 'doc-title', title: '产品技术白皮书', parentId: null },
  { id: 'ch1', title: '一、文档基本信息', parentId: 'doc-title' },
  { id: 'ch1-1', title: '1.1 产品与批次信息', parentId: 'ch1' },
  { id: 'ch1-2', title: '1.2 文档修订记录', parentId: 'ch1' },
  { id: 'ch2', title: '二、项目背景', parentId: 'doc-title' },
  { id: 'ch2-1', title: '2.1 行业现状', parentId: 'ch2' },
  { id: 'ch2-2', title: '2.2 用户痛点', parentId: 'ch2' },
  { id: 'ch2-3', title: '2.3 建设必要性', parentId: 'ch2' },
  { id: 'ch3', title: '三、建设目标', parentId: 'doc-title' },
  { id: 'ch3-1', title: '3.1 总体目标', parentId: 'ch3' },
  { id: 'ch3-2', title: '3.2 阶段目标', parentId: 'ch3' },
  { id: 'ch4', title: '四、功能需求', parentId: 'doc-title' },
  { id: 'ch4-1', title: '4.1 文档编辑能力', parentId: 'ch4' },
  { id: 'ch4-2', title: '4.2 目录联动能力', parentId: 'ch4' },
  { id: 'ch4-3', title: '4.3 AI 助手能力', parentId: 'ch4' },
  { id: 'ch4-4', title: '4.4 批注与审阅', parentId: 'ch4' },
  { id: 'ch5', title: '五、技术架构', parentId: 'doc-title' },
  { id: 'ch5-1', title: '5.1 前端架构', parentId: 'ch5' },
  { id: 'ch5-2', title: '5.2 数据流设计', parentId: 'ch5' },
  { id: 'ch5-3', title: '5.3 接口规划', parentId: 'ch5' },
  { id: 'ch6', title: '六、实施计划', parentId: 'doc-title' },
  { id: 'ch6-1', title: '6.1 里程碑计划', parentId: 'ch6' },
  { id: 'ch6-2', title: '6.2 资源与分工', parentId: 'ch6' },
  { id: 'ch7', title: '七、风险与展望', parentId: 'doc-title' },
  { id: 'ch7-1', title: '7.1 主要风险', parentId: 'ch7' },
  { id: 'ch7-2', title: '7.2 后续规划', parentId: 'ch7' },
]

export interface MockHtmlSection {
  heading?: { level: 1 | 2 | 3; id: string; text: string }
  paragraphs?: string[]
  listItems?: string[]
}

export const MOCK_HTML_SECTIONS: MockHtmlSection[] = [
  {
    heading: { level: 1, id: 'doc-title', text: '产品技术白皮书' },
    paragraphs: [
      '本文档由 AI 根据上传材料自动生成，用于演示长文档场景下的目录锚点跳转、流式输出与双向联动能力。',
      '文档内容涵盖项目背景、功能需求、技术架构与实施计划，适合用于验证编辑器在长文模式下的交互体验。',
    ],
  },
  {
    heading: { level: 2, id: 'ch1', text: '一、文档基本信息' },
    paragraphs: [
      '本章说明文档所对应的产品信息、版本批次以及修订记录，便于读者快速了解文档上下文。',
    ],
  },
  {
    heading: { level: 3, id: 'ch1-1', text: '1.1 产品与批次信息' },
    paragraphs: [
      '产品名称：灵清文档助手。当前演示版本：v1.0.0-demo。适用场景：企业知识库、方案撰写、AI 辅助审阅。',
      '本批次文档由前端 Demo 工程生成，重点验证 SuperDoc 编辑器与目录树的协同能力，而非完整业务闭环。',
    ],
  },
  {
    heading: { level: 3, id: 'ch1-2', text: '1.2 文档修订记录' },
    listItems: [
      '2026-08-18：初始化 Demo，支持三栏布局与流式 mock',
      '2026-08-18：新增目录编辑、批注联动、选区 AI 工具栏',
      '2026-08-18：扩展长文档 mock，优化目录锚点测试数据',
    ],
  },
  {
    heading: { level: 2, id: 'ch2', text: '二、项目背景' },
    paragraphs: [
      '随着企业文档数量持续增长，传统编辑器在「理解、导航、协同」三个维度上的体验已难以满足用户需求。',
    ],
  },
  {
    heading: { level: 3, id: 'ch2-1', text: '2.1 行业现状' },
    paragraphs: [
      '市场上已有大量文档与知识管理产品，但多数产品仍将 AI 能力作为独立对话框存在，与文档正文之间缺少深度耦合。',
      '用户在长文档中频繁滚动查找章节，效率较低；审阅意见与正文之间也往往缺乏直观的视觉关联。',
    ],
  },
  {
    heading: { level: 3, id: 'ch2-2', text: '2.2 用户痛点' },
    paragraphs: [
      '典型痛点包括：目录与正文不同步、批注定位困难、AI 生成结果难以逐段确认、长文编辑时上下文丢失。',
      '在方案撰写与合规审查场景中，<span data-annotation-id="ann-1">用户在阅读长文档时难以快速定位重点</span>，审阅周期因此被拉长。',
    ],
  },
  {
    heading: { level: 3, id: 'ch2-3', text: '2.3 建设必要性' },
    paragraphs: [
      '有必要构建一个「以文档为中心」的工作台，将目录导航、正文编辑、AI 助手与批注审阅统一到同一界面中。',
      '通过流式生成与即时预览，用户可以更早介入编辑与校对，减少一次性长文交付后的返工成本。',
    ],
  },
  {
    heading: { level: 2, id: 'ch3', text: '三、建设目标' },
  },
  {
    heading: { level: 3, id: 'ch3-1', text: '3.1 总体目标' },
    paragraphs: [
      '打造可扩展的 AI 文档工作台 Demo，验证流式目录、流式正文、目录锚点、批注联动与选区 AI 等关键交互。',
    ],
    listItems: [
      '支持 AI 流式生成目录与正文',
      '目录与文档标题双向同步',
      '长文档下目录跳转稳定可用',
      '为后续真实 API 接入预留统一事件通道',
    ],
  },
  {
    heading: { level: 3, id: 'ch3-2', text: '3.2 阶段目标' },
    paragraphs: [
      '第一阶段聚焦前端交互验证；第二阶段接入真实 AI 服务；第三阶段补充协同、版本对比与权限能力。',
    ],
  },
  {
    heading: { level: 2, id: 'ch4', text: '四、功能需求' },
    paragraphs: [
      '本章描述 Demo 已覆盖与规划中的核心功能模块，便于产品与技术对齐迭代范围。',
    ],
  },
  {
    heading: { level: 3, id: 'ch4-1', text: '4.1 文档编辑能力' },
    paragraphs: [
      '正文区基于 SuperDoc 实现，支持标题、加粗、列表、引用等基础格式，编辑体验贴近常规文档产品。',
      '文档页采用固定视口高度与内部滚动，避免长文编辑时整体布局跳动，提升阅读稳定性。',
    ],
  },
  {
    heading: { level: 3, id: 'ch4-2', text: '4.2 目录联动能力' },
    paragraphs: [
      '左侧目录树与正文标题通过 id 绑定，点击目录项可平滑滚动至对应章节。',
      '目录支持编辑模式，修改目录名称会同步更新正文标题；在正文中修改标题也会反向更新目录。',
    ],
  },
  {
    heading: { level: 3, id: 'ch4-3', text: '4.3 AI 助手能力' },
    paragraphs: [
      '右侧 AI 助手区用于承接文档处理状态与后续对话能力。当前版本通过 mock 按钮模拟上传解析流程。',
      '选区浮层提供扩写、润色、生成图片等入口，点击后通过统一 API 层调用 AI 服务（当前为 mock 回退）。',
    ],
  },
  {
    heading: { level: 3, id: 'ch4-4', text: '4.4 批注与审阅' },
    paragraphs: [
      '正文中带有下划线标记的文本表示已被批注。点击后文档区收窄并展示批注详情，便于对照阅读。',
      '批注能力可与 AI 审阅结果联动，为后续「建议修改 → 一键采纳」类功能奠定基础。',
    ],
  },
  {
    heading: { level: 2, id: 'ch5', text: '五、技术架构' },
  },
  {
    heading: { level: 3, id: 'ch5-1', text: '5.1 前端架构' },
    paragraphs: [
      '<span data-annotation-id="ann-2">Vue 3 + SuperDoc 负责文档展示</span>，组件层拆分为目录树、文档工作区与 AI 助手区。',
      '样式上目录与正文共用灰色画布，正文以白色纸页形式居中呈现，贴近常见文档产品视觉。',
    ],
  },
  {
    heading: { level: 3, id: 'ch5-2', text: '5.2 数据流设计' },
    paragraphs: [
      '流式事件统一抽象为 status / phase / toc / html / done 等类型，便于后续替换为 SSE 或 WebSocket。',
      '目录采用扁平节点增量写入树结构；正文采用 HTML 分片 append，模拟 AI 逐段输出效果。',
    ],
  },
  {
    heading: { level: 3, id: 'ch5-3', text: '5.3 接口规划' },
    paragraphs: [
      '文档处理、选区 AI、批注详情等能力均通过 /api 前缀访问，开发阶段由 Vite 代理至后端服务。',
      '接口返回结构与前端 mock 保持一致，降低联调成本。',
    ],
  },
  {
    heading: { level: 2, id: 'ch6', text: '六、实施计划' },
  },
  {
    heading: { level: 3, id: 'ch6-1', text: '6.1 里程碑计划' },
    listItems: [
      'M1：完成三栏布局、流式 mock、目录跳转',
      'M2：完成批注联动、选区 AI、目录双向同步',
      'M3：接入真实 AI 与文档上传',
      'M4：协同编辑与版本管理',
    ],
  },
  {
    heading: { level: 3, id: 'ch6-2', text: '6.2 资源与分工' },
    paragraphs: [
      '前端负责编辑器与交互；后端负责文档解析、AI 编排与持久化；产品设计负责信息架构与审阅流程定义。',
      'Demo 阶段以快速验证为主，优先保证链路完整与体验可感知。',
    ],
  },
  {
    heading: { level: 2, id: 'ch7', text: '七、风险与展望' },
  },
  {
    heading: { level: 3, id: 'ch7-1', text: '7.1 主要风险' },
    paragraphs: [
      '长文档下频繁 HTML 增量写入可能带来性能压力；标题级别变更、删除等边界场景仍需补充规则。',
      'AI 输出质量与延迟会直接影响流式体验，需要loading 状态与中断重试机制。',
    ],
  },
  {
    heading: { level: 3, id: 'ch7-2', text: '7.2 后续规划' },
    paragraphs: [
      '当前版本聚焦基础能力验证，<span data-annotation-id="ann-3">后续可迭代编辑、对话、上传等高级功能</span>。',
      '在锚点跳转体验稳定后，将继续优化滚动容器、高亮当前章节、滚动同步目录等增强能力。',
    ],
  },
]
