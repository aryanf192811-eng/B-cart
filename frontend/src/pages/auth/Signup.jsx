import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../store/auth';

const IMAGES = [
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2000&auto=format&fit=crop"
];

const schema = z.object({
  login_id: z.string().min(6, 'Must be at least 6 characters'),
  email: z.string().email('Invalid email'),
  full_name: z.string().min(1, 'Required'),
  password: z.string().min(6, 'Must be at least 6 characters'),
  confirm_password: z.string()
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

export default function Signup() {
  const [error, setError] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const signup = useAuth((s) => s.signup);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex(i => (i + 1) % IMAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      login_id: 'demo_user',
      email: 'demo@example.com',
      full_name: 'Demo Admin',
      password: 'password123',
      confirm_password: 'password123'
    }
  });

  const loginIdValue = watch('login_id', '');

  const onSubmit = async (data) => {
    try {
      setError('');
      await signup(data);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left 40% */}
      <div className="hidden w-[40%] bg-ink flex-col justify-between p-12 lg:flex relative overflow-hidden">
        {/* Background Images - Preloaded and crossfaded */}
        {IMAGES.map((img, index) => (
          <div 
            key={img}
            className={`absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === bgIndex ? 'opacity-100' : 'opacity-0'}`} 
            style={{ backgroundImage: `url('${img}')` }}
          />
        ))}
        
        {/* Gradient Overlay for Text Visibility */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-rust/90 via-ink/50 to-ink/20"></div>

        <div className="relative z-20">
          <h1 className="font-mono text-4xl text-white tracking-widest font-bold drop-shadow-lg">B-cart</h1>
          <p className="text-white/90 text-[15px] mt-2 font-medium drop-shadow-md">B-cart · Operations Floor</p>
        </div>
        <div className="relative z-20 border-l-4 border-rust pl-5 text-white text-[15px] leading-relaxed font-medium max-w-sm drop-shadow-md">
          Join the floor. Manage inventory, orchestrate manufacturing, and handle procurement.
        </div>
      </div>

      {/* Right 60% */}
      <div className="flex w-full lg:w-[60%] bg-paper items-center justify-center p-8">
        <div className="w-full max-w-[340px]">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rust to-info mb-2 drop-shadow-sm" style={{ fontFamily: 'Roboto, sans-serif' }}>
            Register Access
          </h1>
          <p className="text-[15px] text-steel font-medium mb-8">Join the B-cart operations floor</p>
          
          <form onSubmit={handleSubmit(onSubmit)} className={`space-y-4 ${error ? 'border-l-[0.5px] border-danger pl-4 -ml-[16.5px]' : ''}`}>
            {error && <div className="text-danger text-sm mb-4">{error}</div>}
            
            <div>
              <label className="field-label flex justify-between">
                <span>Login ID</span>
                {loginIdValue.length >= 6 && (
                  <span className="text-steel2 lowercase">checking...</span>
                )}
              </label>
              <input {...register('login_id')} className="field w-full" />
              {errors.login_id && <p className="field-error">{errors.login_id.message}</p>}
            </div>

            <div>
              <label className="field-label">Email</label>
              <input {...register('email')} className="field w-full" type="email" />
              {errors.email && <p className="field-error">{errors.email.message}</p>}
            </div>

            <div>
              <label className="field-label">Full Name</label>
              <input {...register('full_name')} className="field w-full" />
              {errors.full_name && <p className="field-error">{errors.full_name.message}</p>}
            </div>
            
            <div>
              <label className="field-label">Password</label>
              <input {...register('password')} type="password" className="field w-full" />
              {errors.password && <p className="field-error">{errors.password.message}</p>}
            </div>

            <div>
              <label className="field-label">Confirm Password</label>
              <input {...register('confirm_password')} type="password" className="field w-full" />
              {errors.confirm_password && <p className="field-error">{errors.confirm_password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="btn btn-rust w-full justify-center mt-2">
              {isSubmitting ? 'Creating...' : 'Create account'}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-center gap-3 text-[12px] text-steel">
            <Link to="/login" className="hover:text-ink transition-colors">Back to sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
