import {Html, Head, Main, NextScript} from 'next/document';
export default function Document() {
  return <Html lang="en"><Head>
    <meta name="theme-color" content="#180A1E" />
    <link rel="icon" type="image/png" sizes="32x32" href="/assets/AppIcons/favicon-32x32.png" />
    <link rel="apple-touch-icon" href="/assets/touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="preconnect" href="https://fonts.gstatic.com" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.1/css/all.min.css" crossOrigin="anonymous" />
  </Head><body><Main /><NextScript /></body></Html>;
}
