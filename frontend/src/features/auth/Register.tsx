import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { authApi } from '../../api/auth'
import { Button, Input, Label, Card, CardBody, CardFooter } from '../../components/ui'

const registerSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(50),
  last_name: z.string().min(1, 'Last name is required').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Za-z]/, 'Password must contain at least one letter').regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type RegisterForm = z.infer<typeof registerSchema>

export function Register() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)

  // OTP Verification States
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const emailValue = watch('email')

  // Cooldown countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  // If candidate modifies email after verifying, reset verification status
  useEffect(() => {
    if (emailVerified && verifiedEmail && emailValue?.trim().toLowerCase() !== verifiedEmail.toLowerCase()) {
      setEmailVerified(false)
      setVerifiedEmail(null)
      setOtpSent(false)
      setOtp('')
      setOtpError('')
    }
  }, [emailValue, emailVerified, verifiedEmail])

  const handleSendOtp = async () => {
    const email = emailValue?.trim()
    if (!email) {
      toast.error('Please enter your email address first.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address.')
      return
    }

    setIsSendingOtp(true)
    setOtpError('')
    try {
      const res = await authApi.sendEmailOtp(email)
      toast.success(res.message || 'Verification code sent to your email!')
      setOtpSent(true)
      setResendCooldown(60)
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err.message ||
        'Failed to send verification code.'
      toast.error(message)
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    const email = emailValue?.trim()
    if (!email) {
      toast.error('Please enter your email address.')
      return
    }
    if (!otp || otp.trim().length !== 6) {
      setOtpError('Please enter the complete 6-digit verification code.')
      return
    }

    setIsVerifyingOtp(true)
    setOtpError('')
    try {
      const res = await authApi.verifyEmailOtp(email, otp.trim())
      if (res.verified) {
        setEmailVerified(true)
        setVerifiedEmail(email)
        setOtpSent(false)
        toast.success('Email verified successfully!')
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err.message ||
        'Invalid verification code. Please try again.'
      setOtpError(message)
      toast.error(message)
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const onSubmit = async (data: RegisterForm) => {
    if (!emailVerified) {
      toast.error('Please verify your email address before creating your account.')
      return
    }

    setIsLoading(true)
    try {
      await registerUser(data.first_name, data.last_name, data.email, data.password, data.confirm_password)
      toast.success('Account created successfully!')
      navigate('/candidate/dashboard')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
        <p className="mt-2 text-gray-600">Start your job search journey</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="first_name">First Name *</Label>
                <Input
                  id="first_name"
                  type="text"
                  autoComplete="given-name"
                  placeholder="John"
                  error={errors.first_name?.message}
                  {...register('first_name')}
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name *</Label>
                <Input
                  id="last_name"
                  type="text"
                  autoComplete="family-name"
                  placeholder="Doe"
                  error={errors.last_name?.message}
                  {...register('last_name')}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="email" className="mb-0">
                  Email *
                </Label>
                {emailVerified && (
                  <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                    <svg className="w-3.5 h-3.5 mr-1 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Email Verified
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    disabled={emailVerified}
                    {...register('email')}
                  />
                </div>
                {!emailVerified && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSendOtp}
                    loading={isSendingOtp}
                    disabled={isSendingOtp || isVerifyingOtp || resendCooldown > 0}
                    className="whitespace-nowrap px-4"
                  >
                    {isSendingOtp ? 'Sending...' : otpSent ? 'Resend' : 'Verify Email'}
                  </Button>
                )}
              </div>
            </div>

            {/* OTP Verification Box */}
            {otpSent && !emailVerified && (
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 space-y-3 animate-fade-in">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900">Email Verification</h4>
                  <p className="text-xs text-gray-600 mt-0.5">
                    A 6-digit verification code has been sent to: <span className="font-semibold text-gray-800">{emailValue}</span>
                  </p>
                </div>

                <div className="flex gap-2">
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value.replace(/\D/g, ''))
                      setOtpError('')
                    }}
                    className="text-center font-mono tracking-widest text-base font-bold"
                  />
                  <Button
                    type="button"
                    onClick={handleVerifyOtp}
                    loading={isVerifyingOtp}
                    disabled={otp.length !== 6 || isVerifyingOtp}
                    className="whitespace-nowrap"
                  >
                    Verify OTP
                  </Button>
                </div>

                {otpError && (
                  <p className="text-xs text-red-600 font-medium">{otpError}</p>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-indigo-100">
                  <span>Didn't receive the code?</span>
                  {resendCooldown > 0 ? (
                    <span className="font-medium text-gray-600">
                      Resend OTP in 00:{resendCooldown.toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={isSendingOtp}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold underline disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}

            {emailVerified && (
              <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                <svg className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Email verified successfully! You may now create your account.</span>
              </div>
            )}

            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={errors.password?.message}
                {...register('password')}
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters with a letter and a number</p>
            </div>

            <div>
              <Label htmlFor="confirm_password">Confirm Password *</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={errors.confirm_password?.message}
                {...register('confirm_password')}
              />
            </div>

            <div>
              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={!emailVerified || isLoading}
              >
                Create account
              </Button>
              {!emailVerified && (
                <p className="text-xs text-amber-700 text-center mt-2 font-medium">
                  Please verify your email address to enable account creation.
                </p>
              )}
            </div>
          </form>
        </CardBody>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}