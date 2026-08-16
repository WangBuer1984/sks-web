/**
 * @deprecated 旧 A/B/C 卡片知识库 API（`/api/kb/cards`）。
 *
 * 知识库已重定义为「内容底仓」（spec 2026-08-15-kb-content-library-design D1/D5）：库里只有一种对象
 * ——一篇内容。新契约见 {@link ./content}，端点实现落在后续任务。本模块<b>保留一个兼容周期</b>，
 * 期间不再新增能力，也不要在新页面里引用；存量 B 卡不迁移（D5）。
 */

import { userClient } from './client';

/** KB 卡片列表项（对齐 Java CardSummary）。embedding 不返回（太大）。 */
export interface CardSummary {
  id: number;
  layer: string;
  cardType: string;
  title: string;
  content: string;
  updatedAt: string;
}

export type CardLayer = 'A' | 'B' | 'C';

/** 列出当前用户的未删卡片（可选 layer=A/B/C 过滤）。 */
export function listCards(layer?: CardLayer): Promise<CardSummary[]> {
  return userClient.get<CardSummary[], CardSummary[]>('/kb/cards', {
    params: layer ? { layer } : {},
  });
}

/** 新建卡片。content 为 JSON 文本（存 JSONB）。返回新 id。 */
export function createCard(
  layer: CardLayer,
  cardType: string,
  title: string,
  content: string,
): Promise<number> {
  return userClient.post<number, number>('/kb/cards', { layer, cardType, title, content });
}

/** 编辑卡片（改 title + content）。B 层会重算向量 + 归档旧值。 */
export function updateCard(id: number, title: string, content: string): Promise<void> {
  return userClient.put<void, void>(`/kb/cards/${id}`, { title, content });
}

/** 删除卡片。有引用且非 force 时后端返回 code=4006（BizError.message 含引用数）。 */
export function deleteCard(id: number, force = false): Promise<void> {
  return userClient.delete<void, void>(`/kb/cards/${id}`, { params: { force } });
}
