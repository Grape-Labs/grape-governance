import type {AppProps} from 'next/app';
import '../index.css';
import '../Governance/Demo/governance-demo.css';
import 'highlight.js/styles/base16/tomorrow-night.css';

export default function NextApp({Component, pageProps}: AppProps) {
  return <Component {...pageProps} />;
}
