import {useMemo} from "preact/hooks";
import {
  retailPosHost,
  type RuntimeEnvironment,
} from "@alo-retail-pos-service/pos-domain";

const runtimeEnvironment = (import.meta.env.VITE_APP_ENV ?? "dev") as RuntimeEnvironment;

export function App() {
  const retailHost = useMemo(() => retailPosHost(runtimeEnvironment), []);

  return (
    <s-page heading="Alo Retail POS">
      <s-section heading="Runtime">
        <s-stack gap="base">
          <s-box>
            <s-badge tone="success">Polaris web components</s-badge>
          </s-box>
          <s-box>
            <s-text>Host: {retailHost}</s-text>
          </s-box>
          <s-box>
            <s-text>Employee source: HRIS</s-text>
          </s-box>
        </s-stack>
      </s-section>

      <s-section heading="Store Pilot">
        <s-box>
          <s-text>
            Store cohorts, extension rollout, HRIS source selection, and employee-order worker cutoff are driven by runtime config.
          </s-text>
        </s-box>
      </s-section>
    </s-page>
  );
}
