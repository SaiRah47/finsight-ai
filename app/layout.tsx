import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'FinSight ATLAS | Market Intelligence',description:'Private, research-first investment intelligence workspace.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang='en'><body>{children}</body></html>}
