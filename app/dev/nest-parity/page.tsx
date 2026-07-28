import { NestParityClient } from "./nest-parity-client";

export const metadata = { title: "Nest parity · dev", robots: { index: false, follow: false } };

export default function NestParityPage() {
  return <NestParityClient />;
}
