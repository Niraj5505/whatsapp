import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { MessageSquare, ArrowRight } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  workspaceName: z.string().min(2, 'Workspace name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const Register = () => {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data) => {
    try {
      await registerUser(data.name, data.email, data.password, data.workspaceName);
      toast.success('Workspace created successfully! Welcome to NexaFlow.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800/90 rounded-xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="space-y-1.5 text-center">
          <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-emerald-500 mb-3 shadow-xs">
            <MessageSquare size={16} />
          </div>
          <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Create NexaFlow Workspace</h2>
          <p className="text-xs text-zinc-400">Scale WhatsApp messaging with Meta Cloud API</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Your Full Name</label>
            <input
              type="text"
              {...register('name')}
              placeholder="Jane Doe"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {errors.name && <p className="text-[11px] text-rose-400">{errors.name.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Workspace Name</label>
            <input
              type="text"
              {...register('workspaceName')}
              placeholder="Acme Global Inc"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {errors.workspaceName && <p className="text-[11px] text-rose-400">{errors.workspaceName.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Work Email</label>
            <input
              type="email"
              {...register('email')}
              placeholder="name@company.com"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {errors.email && <p className="text-[11px] text-rose-400">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Password</label>
            <input
              type="password"
              {...register('password')}
              placeholder="Minimum 6 characters"
              className="w-full bg-zinc-950 text-zinc-100 text-xs px-3 py-2 rounded-md border border-zinc-800 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            {errors.password && <p className="text-[11px] text-rose-400">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 rounded-md bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 mt-2"
          >
            <span>{isSubmitting ? 'Creating Workspace...' : 'Get Started Free'}</span>
            <ArrowRight size={13} />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-zinc-500 border-t border-zinc-800/80">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-300 hover:text-white font-medium underline underline-offset-4">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
