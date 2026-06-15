import type {ComponentChildren} from "preact";

type PolarisElementProps = {
  children?: ComponentChildren;
  [key: string]: unknown;
};

declare module "preact" {
  namespace JSX {
    interface IntrinsicElements {
      "s-page": PolarisElementProps;
      "s-section": PolarisElementProps;
      "s-stack": PolarisElementProps;
      "s-box": PolarisElementProps;
      "s-badge": PolarisElementProps;
      "s-button": PolarisElementProps;
      "s-text": PolarisElementProps;
    }
  }
}
