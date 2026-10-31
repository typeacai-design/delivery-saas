'use client'

export default function GoogleSignInButton({ referralCode = '' }: { referralCode?: string }) {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== 'true') return null
  return <div className="mb-5">
    <a href={'/auth/google' + (referralCode ? '?ref=' + encodeURIComponent(referralCode) : '')}
      className="flex items-center justify-center gap-3 w-full rounded-xl bg-white border border-gray-300 px-4 py-3 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50">
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
        <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.8 6-15.1Z"/>
        <path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.7-5.2c-1.8 1.2-4 1.9-6.5 1.9-5.2 0-9.6-3.5-11.2-8.2H5.9v5.3A20 20 0 0 0 24 44Z"/>
        <path fill="#FBBC05" d="M12.8 27.7a12 12 0 0 1 0-7.4V15H5.9a20 20 0 0 0 0 18l6.9-5.3Z"/>
        <path fill="#EA4335" d="M24 12.1c2.9 0 5.4 1 7.4 2.9l5.5-5.5A18.5 18.5 0 0 0 24 4 20 20 0 0 0 5.9 15l6.9 5.3C14.4 15.6 18.8 12.1 24 12.1Z"/>
      </svg>
      Continuar com Google
    </a>
    <p className="hint text-center mt-3">ou use seu e-mail e senha</p>
  </div>
}

