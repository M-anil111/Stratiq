import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme/theme-provider'

const inter = Inter({ subsets: ['latin'] })

// Runs before hydration to set data-theme from localStorage (or the OS
// preference), preventing a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('stratiq-theme');var r=(t==='light'||t==='dark')?t:(t==='system'||!t?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):'dark');document.documentElement.setAttribute('data-theme',r);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`

export const metadata: Metadata = {
  title: 'Stratiq — Digital Marketing Management',
  description: 'Agency management platform for digital marketing teams',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
