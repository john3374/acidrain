import NextAuthProvider from '@/components/NextAuthProvider';
import '@/db';
import './globals.css';

export const metadata = {
  title: '타자연습',
  description: '추억의 산성비 타자연습 놀이',
};
// <meta name="google-signin-client_id" content="383578851033-0c7215q3in0pdk6k3rlcllr179bl56cu.apps.googleusercontent.com" />

const RootLayout = ({ children }) => (
  <html lang="ko">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
      <link rel="icon" href="/favicon.png" sizes="any" />
    </head>
    <body>
      <NextAuthProvider>{children}</NextAuthProvider>
    </body>
  </html>
);

export default RootLayout;
