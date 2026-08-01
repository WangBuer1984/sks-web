import { userClient } from './client';

/** C 端 `/me` 返回体（对齐 Java `UserService.MeResponse`）。`balance` 来自额度账本。 */
export interface MeResponse {
  userId: number;
  phone: string;
  nickname: string | null;
  gender: string | null;
  age: number | null;
  city: string | null;
  industry: string | null;
  identity: string | null;
  style: string | null;
  weeklyGoal: number | null;
  defaultPlatform: string | null;
  completeness: number;
  balance: number;
  /** 历史入账总额（credit+refund 之和），侧边栏进度条分母。后端 totalCredited。 */
  totalQuota: number;
}

/** C 端登录返回体：user JWT + 用户 id + 是否首次注册。 */
export interface LoginResult {
  token: string;
  userId: number;
  isNew: boolean;
}

/** 发送验证码（1/1min、5/1h、10/24h 频控由后端强制）。 */
export function sendCode(phone: string): Promise<void> {
  return userClient.post<unknown, void>('/auth/send-code', { phone });
}

/** 登录（即注册）：校验验证码 → upsert app_user → 签发 user JWT。 */
export function login(phone: string, code: string): Promise<LoginResult> {
  return userClient.post<LoginResult, LoginResult>('/auth/login', { phone, code });
}

/** 拉取当前登录用户资料 + 余额。 */
export function fetchMe(): Promise<MeResponse> {
  return userClient.get<MeResponse, MeResponse>('/user/me');
}

/**
 * 更新资料（对齐 Java `UpdateMe` record 的 9 个字段，全部可选/可为 null）。
 *
 * <p>后端会重算 `completeness`，口径是**只按创作资料 5 字段**算：
 * nickname/industry/identity/style/weeklyGoal 已填数 ÷ 5 × 100 取整。
 * gender/age/city/defaultPlatform 影响生成质量但不计入分母——所以填了基础资料完善度不动是正常的。
 */
export interface UpdateMePayload {
  nickname?: string | null;
  gender?: string | null;
  age?: number | null;
  city?: string | null;
  industry?: string | null;
  identity?: string | null;
  style?: string | null;
  weeklyGoal?: number | null;
  defaultPlatform?: string | null;
}

/** 保存资料，返回更新后的 me（含重算过的 completeness）。 */
export function updateMe(payload: UpdateMePayload): Promise<MeResponse> {
  return userClient.put<MeResponse, MeResponse>('/user/me', payload);
}
