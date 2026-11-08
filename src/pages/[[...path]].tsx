import dynamic from 'next/dynamic';
import Head from 'next/head';
import type {GetServerSideProps} from 'next';

const ClientApp = dynamic(() => import('../next/ClientApp'), {
  ssr: false, loading: () => <main role="status" style={{padding: 24, color: '#edf2fa'}}>Loading governance…</main>,
});
export default function GovernancePage({preview, origin}: {preview: any; origin: string}) {
  const title = preview ? `${preview.title} | ${preview.dao}` : 'Governance | Powered by Grape';
  const description = preview
    ? preview.available ? `${preview.state} proposal in ${preview.dao}. Review and participate on Governance by Grape.` : 'Review this proposal on Governance by Grape.'
    : 'Governance | Discover & Participate in DAOs on Solana | Powered by Grape';
  const canonical = preview ? `${origin}/proposal/${preview.realm}/${preview.proposal}` : origin;
  const image = preview ? `${origin}/api/proposal-image?realm=${preview.realm}&proposal=${preview.proposal}&v=2` : `${origin}/assets/governancesocialsplashv2.png`;
  return <>
    <Head>
      <title>{title}</title><meta name="description" content={description} key="description" />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" /><meta property="og:site_name" content="Governance by Grape" />
      <meta property="og:url" content={canonical} /><meta property="og:title" content={title} />
      <meta property="og:description" content={description} /><meta property="og:image" content={image} />
      <meta property="og:image:type" content="image/png" /><meta property="og:image:alt" content={title} />
      <meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />
      <meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} /><meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={title} />
    </Head>
    <ClientApp />
  </>;
}
export const getServerSideProps: GetServerSideProps = async ({params, res}) => {
  const origin = process.env.SITE_ORIGIN || 'https://governance.so';
  const segments = params?.path as string[] || [];
  if (segments.length === 3 && ['proposal', 'embedproposal'].includes(segments[0])) {
    const {parseProposalRequest, loadProposalPreview, cacheControl} = await import('../server/social/proposal.js');
    let context;
    try {context = parseProposalRequest({url: '/' + segments.join('/')});}
    catch {return {notFound: true};}
    const preview = await loadProposalPreview(context);
    res.setHeader('Cache-Control', cacheControl(preview));
    return {props: {preview, origin}};
  }
  if (['api', '_vercel', 'assets', 'icons', 'locales'].includes(segments[0]) ||
      /\.(js|css|png|svg|jpe?g|webp|ico|woff2?|ttf|webmanifest)$/.test(segments.at(-1) || '')) return {notFound: true};
  return {props: {preview: null, origin}};
};
