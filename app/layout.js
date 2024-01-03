import { Inter } from 'next/font/google';
import './globals.css';
import NextAuthProvider from '@/components/NextAuthProvider';
import '@/db';

export const metadata = {
  title: '랜덤타자연습',
  description: '추억의 타자연습 게임',
};
// <meta name="google-signin-client_id" content="383578851033-0c7215q3in0pdk6k3rlcllr179bl56cu.apps.googleusercontent.com" />

const RootLayout = ({ children }) => (
  <html lang="ko">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
    </head>
    <body>
      <NextAuthProvider>{children}</NextAuthProvider>
    </body>
  </html>
);

export default RootLayout;
