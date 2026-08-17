import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { MessageSquare, ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    try {
      await login(data.email, data.password);
      toast.success('Welcome back to NexaFlow');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800/90 rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-emerald-500 mb-3 shadow-xs">
            <MessageSquare size={16} />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Sign in to NexaFlow</h2>
          <p className="text-xs text-zinc-400">Enterprise WhatsApp Cloud API Automation</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">Email address</label>
            <input
              type="email"
              {...register('email')}
              placeholder="name@company.com"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">Password</label>
            <input
              type="password"
              {...register('password')}
              placeholder="••••••••"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {errors.password && <p className="text-[11px] text-rose-400">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <span>{isSubmitting ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight size={13} />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-800/80">
          Don't have an account?{' '}
          <Link to="/register" className="text-zinc-300 hover:text-white font-medium underline underline-offset-4">
            Create a workspace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
