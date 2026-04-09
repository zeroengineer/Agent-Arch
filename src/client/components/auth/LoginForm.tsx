import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  isSignUp: z.boolean()
});

type FormData = z.infer<typeof schema>;

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { isSignUp: false }
  });

  const isSignUp = watch('isSignUp');

  const onSubmit = async (data: FormData) => {
    try {
      const endpoint = data.isSignUp ? 'auth/sign-up/email' : 'auth/sign-in/email';
      await api.post(endpoint, {
        json: {
          email: data.email,
          password: data.password,
          // better-auth requires name for signup
          ...(data.isSignUp ? { name: data.email.split('@')[0] } : {}) 
        }
      }).json();
      
      toast.success(data.isSignUp ? 'Account created successfully' : 'Signed in successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.statusText || 'Authentication failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input 
          {...register('email')} 
          type="email" 
          className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
        />
        {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Password</label>
        <input 
          {...register('password')} 
          type="password" 
          className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" 
        />
        {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Please wait...' : (isSignUp ? 'Sign Up' : 'Sign In')}
      </button>

      <div className="text-center text-sm">
        <button 
          type="button" 
          onClick={() => setValue('isSignUp', !isSignUp)}
          className="text-indigo-600 hover:text-indigo-500 font-medium"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </div>
    </form>
  );
}
