import { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  children: ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100/60 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link to="/" className="inline-flex items-center gap-2 group">
          <span className="text-3xl font-extrabold tracking-tight text-indigo-600 group-hover:text-indigo-700 transition-colors">
            SmartSkale
          </span>
        </Link>
        <p className="mt-1 text-sm text-gray-500 font-medium">Candidate Sourcing Platform</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {children}
        <p className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} SmartSkale. All rights reserved.
        </p>
      </div>
    </div>
  )
}