import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { sendNewCode, sendOldCode, verifyNew, verifyOld } from '../api/phone';

/**
 * 换绑手机号弹窗——四步有状态流程（`/api/user/phone/change/**`）。
 *
 * <p>关键约束：第 2 步校验旧号后拿到的一次性 `token` 要贯穿第 3、4 步，
 * 所以它必须留在组件状态里；中途关弹窗即作废，重开要从第 1 步来。
 *
 * <p>视觉沿用原型的弹窗规格（`rounded-soft`、`shadow-modal`、`animate-slideup`、
 * 半透明遮罩 `rgba(35,35,31,0.45)` = `paper-ink/45`）。
 */
type Step = 'old' | 'new';

export default function PhoneChangeDialog({
  currentPhone,
  onClose,
  onDone,
}: {
  currentPhone: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('old');
  const [token, setToken] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const fail = (fallback: string) => (e: unknown) => setError(getBizMessage(e, fallback));

  const sendOldMut = useMutation({
    mutationFn: sendOldCode,
    onSuccess: () => {
      setError(null);
      setNotice(`验证码已发往 ${maskPhone(currentPhone)}`);
    },
    onError: fail('验证码发送失败'),
  });

  const verifyOldMut = useMutation({
    mutationFn: () => verifyOld(oldCode.trim()),
    onSuccess: (r) => {
      setError(null);
      setToken(r.token);
      setNotice('旧手机号已验证，请填写新号码');
      setStep('new');
    },
    onError: fail('旧手机号验证失败'),
  });

  const sendNewMut = useMutation({
    mutationFn: () => sendNewCode(newPhone.trim(), token),
    onSuccess: () => {
      setError(null);
      setNotice(`验证码已发往 ${newPhone.trim()}`);
    },
    onError: fail('验证码发送失败'),
  });

  const verifyNewMut = useMutation({
    mutationFn: () => verifyNew(newPhone.trim(), newCode.trim(), token),
    onSuccess: () => {
      setError(null);
      onDone();
    },
    onError: fail('换绑失败'),
  });

  const newPhoneValid = /^1\d{10}$/.test(newPhone.trim());
  const busy =
    sendOldMut.isPending || verifyOldMut.isPending || sendNewMut.isPending || verifyNewMut.isPending;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="换绑手机号"
      className="fixed inset-0 z-50 flex items-center justify-center bg-paper-ink/45"
    >
      <div className="w-[480px] animate-slideup rounded-soft bg-paper-card px-7 py-[26px] shadow-modal">
        <div className="mb-2 text-meta font-bold tracking-wide text-paper-primary">换绑手机号</div>

        {step === 'old' ? (
          <>
            <p className="mb-4 text-caption leading-normal text-paper-muted">
              第 1 步 / 2：先验证当前号码 {maskPhone(currentPhone)}，确认是你本人操作。
            </p>
            <div className="flex gap-2.5">
              <input
                value={oldCode}
                onChange={(e) => setOldCode(e.target.value)}
                placeholder="当前号码收到的验证码"
                inputMode="numeric"
                className="flex-1 rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body outline-none focus:border-paper-primary"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => sendOldMut.mutate()}
                className="whitespace-nowrap rounded-card border border-paper-lineStrong px-3.5 py-2.5 text-caption text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:opacity-45"
              >
                {sendOldMut.isPending ? '发送中…' : '发送验证码'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 text-caption leading-normal text-paper-muted">
              第 2 步 / 2：填写新号码并验证。完成后下次登录请用新号码。
            </p>
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="新手机号"
              inputMode="numeric"
              className="mb-2.5 w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body outline-none focus:border-paper-primary"
            />
            <div className="flex gap-2.5">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="新号码收到的验证码"
                inputMode="numeric"
                className="flex-1 rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body outline-none focus:border-paper-primary"
              />
              <button
                type="button"
                disabled={busy || !newPhoneValid}
                onClick={() => sendNewMut.mutate()}
                className="whitespace-nowrap rounded-card border border-paper-lineStrong px-3.5 py-2.5 text-caption text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:opacity-45"
              >
                {sendNewMut.isPending ? '发送中…' : '发送验证码'}
              </button>
            </div>
          </>
        )}

        {notice && !error && (
          <p className="mt-2.5 text-meta text-paper-success">{notice}</p>
        )}
        {error && (
          <p role="alert" className="mt-2.5 text-meta text-paper-danger">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
          >
            取消
          </button>
          {step === 'old' ? (
            <button
              type="button"
              disabled={busy || !oldCode.trim()}
              onClick={() => verifyOldMut.mutate()}
              className="rounded-card bg-paper-primary px-5 py-2.5 text-body font-bold text-white hover:bg-paper-primaryHover disabled:opacity-45"
            >
              {verifyOldMut.isPending ? '验证中…' : '下一步'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !newPhoneValid || !newCode.trim()}
              onClick={() => verifyNewMut.mutate()}
              className="rounded-card bg-paper-primary px-5 py-2.5 text-body font-bold text-white hover:bg-paper-primaryHover disabled:opacity-45"
            >
              {verifyNewMut.isPending ? '换绑中…' : '确认换绑'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** 手机号中间四位打码，与原型「138****6621」一致。 */
export function maskPhone(phone: string): string {
  return /^\d{11}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(7)}` : phone;
}
