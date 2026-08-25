import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { Button, Input, Label, Card, CardBody, CardFooter } from '../../components/ui'

const resetSchema = z.object({
  new_password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Za-z]/, 'Password must contain at least one letter').regex(/[0-9]/, 'Password must contain at least one number'),
  confirm_password: z.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type ResetForm = z.infer<typeof resetSchema>

export function ResetPassword() {
  const { resetPassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  })

  const onSubmit = async (data: ResetForm) => {
    if (!token) {
      toast.error('Invalid or missing reset token')
      return
    }

    setIsLoading(true)
    try {
      await resetPassword(token, data.new_password, data.confirm_password)
      toast.success('Password has been reset successfully')
      navigate('/login')
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reset password'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="w-full">
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-gray-600">Invalid or missing reset token</p>
            <Link to="/forgot-password" className="text-indigo-600 hover:text-indigo-500 mt-4 inline-block">
              Request a new reset link
            </Link>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Reset your password</h2>
        <p className="mt-2 text-gray-600">Enter your new password below</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={errors.new_password?.message}
                {...register('new_password')}
              />
              <p className="mt-1 text-xs text-gray-500">At least 8 characters with a letter and a number</p>
            </div>

            <div>
              <Label htmlFor="confirm_password">Confirm New Password</Label>
              <Input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                error={errors.confirm_password?.message}
                {...register('confirm_password')}
              />
            </div>

            <Button type="submit" className="w-full" loading={isLoading}>
              Reset password
            </Button>
          </form>
        </CardBody>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-600">
            <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}