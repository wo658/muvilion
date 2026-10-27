"use client";

import { useEffect, useRef } from "react";
import { Brand, GoogleMark, Icon } from "./primitives";

/** Google is the primary account entry. No mock session or fake cloud-save state. */
export function AccountDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="ws-dialog" onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="account-title">
    <button className="ws-icon-button ws-dialog-close" onClick={onClose} aria-label="닫기"><Icon name="close" /></button>
    <Brand />
    <h2 id="account-title">어디서든 이어서 계획하세요.</h2>
    <p>Google 계정으로 프로젝트를 보관하고,<br />다른 기기에서도 작업을 이어가는 공간입니다.</p>
    <div className="ws-account-benefits"><span><Icon name="cloud" /> 계정에 프로젝트 보관</span><span><Icon name="file" /> 도면과 행사 조건을 함께 관리</span><span><Icon name="clock" /> 최근 작업부터 이어서 시작</span></div>
    <button className="ws-button ws-google" disabled><GoogleMark /> Google로 계속하기</button>
    <p className="ws-integration-note">Google 로그인은 아직 연결되지 않았습니다.<br />지금은 게스트로 모든 입력 단계를 이용할 수 있어요.</p>
    <button className="ws-button ws-primary w-full" onClick={onClose}>게스트로 계속하기 <Icon name="arrow" /></button>
    <p className="ws-footnote">게스트 작업은 이 브라우저에 저장됩니다.<br />브라우저 데이터를 지우기 전에 백업을 내려받으세요.</p>
  </dialog>;
}
