import { userClient } from './client';

/**
 * 换绑手机号（`/api/user/phone/change/**`，对齐 Java `UserPhoneController`）。
 *
 * <p>四步且**有状态**：验证旧号得到一个一次性 `token`，后两步都要带上它。
 * 不是四个独立调用——`token` 串起整个流程，中途刷新页面等于重来。
 *
 * <ol>
 *   <li>{@link sendOldCode}：给当前手机号发码
 *   <li>{@link verifyOld}：校验旧号验证码 → 返回 token
 *   <li>{@link sendNewCode}：带 token 给新号发码
 *   <li>{@link verifyNew}：带 token + 新号验证码 → 换绑生效
 * </ol>
 */

/** 第 1 步：给当前绑定的手机号发验证码（频控由后端强制）。 */
export function sendOldCode(): Promise<void> {
  return userClient.post<unknown, void>('/user/phone/change/send-old-code', {});
}

/** 第 2 步：校验旧号验证码，拿到贯穿后续两步的一次性 token。 */
export function verifyOld(code: string): Promise<{ token: string }> {
  return userClient.post<{ token: string }, { token: string }>(
    '/user/phone/change/verify-old',
    { code },
  );
}

/** 第 3 步：给新手机号发验证码。 */
export function sendNewCode(newPhone: string, token: string): Promise<void> {
  return userClient.post<unknown, void>('/user/phone/change/send-new-code', {
    newPhone,
    token,
  });
}

/** 第 4 步：校验新号验证码，换绑生效。 */
export function verifyNew(newPhone: string, code: string, token: string): Promise<void> {
  return userClient.post<unknown, void>('/user/phone/change/verify-new', {
    newPhone,
    code,
    token,
  });
}
