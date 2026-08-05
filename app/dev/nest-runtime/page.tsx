import { NestRuntimeBench } from "./nest-runtime-bench";

export const metadata = { title: "Nest runtime · dev", robots: { index: false, follow: false } };

export default function NestRuntimeDevPage() {
  return <NestRuntimeBench />;
}
