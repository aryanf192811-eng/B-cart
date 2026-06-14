import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '../../store/auth';
import { api } from '../../api/client';

const IMAGES = [
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2000&auto=format&fit=crop"
];

const signupSchema = z.object({
  login_id: z.string().min(6, 'Must be at least 6 characters'),
  email: z.string().email('Invalid email'),
  full_name: z.string().min(1, 'Required'),
  mobile: z.string().regex(/^[0-9]{10}$/, 'Must be a 10-digit number'),
  role_id: z.string().min(1, 'Role is required'),
  password: z.string().min(6, 'Must be at least 6 characters'),
  confirm_password: z.string()
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

const otpSchema = z.object({
  otp_code: z.string().length(6, 'Must be 6 digits')
});

export default function Signup() {
  const [error, setError] = useState('');
  const [bgIndex, setBgIndex] = useState(0);
  const [roles, setRoles] = useState([]);
  const [step, setStep] = useState('signup'); // 'signup' | 'otp'
  const [savedLoginId, setSavedLoginId] = useState('');
  const { signup, verifyOtp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch roles
    api.get('/auth/roles').then(res => {
      console.log('Roles response:', res.data);
      setRoles(res.data.roles || []);
    }).catch(err => {
      console.error('Roles fetch error:', err);
    });

    const timer = setInterval(() => {
      setBgIndex(i => (i + 1) % IMAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);
  
  const { register: registerSignup, handleSubmit: handleSignupSubmit, formState: { errors: errorsSignup, isSubmitting: isSubmittingSignup } } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      login_id: '',
      email: '',
      full_name: '',
      mobile: '',
      role_id: '',
      password: '',
      confirm_password: ''
    }
  });

  const { register: registerOtp, handleSubmit: handleOtpSubmit, formState: { errors: errorsOtp, isSubmitting: isSubmittingOtp } } = useForm({
    resolver: zodResolver(otpSchema)
  });

  const onSignup = async (data) => {
    try {
      setError('');
      const res = await signup(data);
      setSavedLoginId(res.login_id || data.login_id);
      setStep('otp');
    } catch (err) {
      const data = err.response?.data;
      if (data?.details && Array.isArray(data.details)) {
        const detailStr = data.details.map(d => `${d.field}: ${d.message}`).join(', ');
        setError(`${data.error} - ${detailStr}`);
      } else {
        setError(data?.error || 'Failed to create account');
      }
    }
  };

  const onVerifyOtp = async (data) => {
    try {
      setError('');
      await verifyOtp(savedLoginId, data.otp_code);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to verify OTP');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left 40% */}
      <div className="hidden w-[40%] bg-ink flex-col justify-between p-12 lg:flex relative overflow-hidden">
        {IMAGES.map((img, index) => (
          <div 
            key={img}
            className={`absolute inset-0 z-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${index === bgIndex ? 'opacity-100' : 'opacity-0'}`} 
            style={{ backgroundImage: `url('${img}')` }}
          />
        ))}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-rust/90 via-ink/50 to-ink/20"></div>
        <div className="relative z-20">
          <h1 className="font-mono text-4xl text-white tracking-widest font-bold drop-shadow-lg">B-cart</h1>
          <p className="text-white/90 text-[15px] mt-2 font-medium drop-shadow-md">Mini ERP · Operations Floor</p>
        </div>
        <div className="relative z-20 border-l-4 border-rust pl-5 text-white text-[15px] leading-relaxed font-medium max-w-sm drop-shadow-md">
          Join the floor. Manage inventory, orchestrate manufacturing, and handle procurement.
        </div>
      </div>

      {/* Right 60% */}
      <div className="flex w-full lg:w-[60%] bg-paper items-center justify-center p-8">
        <div className="w-full max-w-[340px]">
          {step === 'signup' ? (
            <>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rust to-info mb-2 drop-shadow-sm" style={{ fontFamily: 'Roboto, sans-serif' }}>
                Register Access
              </h1>
              <p className="text-[15px] text-steel font-medium mb-8">Join the B-cart operations floor</p>
              
              <form onSubmit={handleSignupSubmit(onSignup)} className={`space-y-4 ${error ? 'border-l-[0.5px] border-danger pl-4 -ml-[16.5px]' : ''}`}>
                {error && <div className="text-danger text-sm mb-4">{error}</div>}
                
                <div>
                  <label htmlFor="login_id" className="field-label">Login ID</label>
                  <input id="login_id" {...registerSignup('login_id')} className="field w-full" />
                  {errorsSignup.login_id && <p className="field-error">{errorsSignup.login_id.message}</p>}
                </div>

                <div>
                  <label htmlFor="full_name" className="field-label">Full Name</label>
                  <input id="full_name" {...registerSignup('full_name')} className="field w-full" />
                  {errorsSignup.full_name && <p className="field-error">{errorsSignup.full_name.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="field-label">Email</label>
                    <input id="email" {...registerSignup('email')} className="field w-full" type="email" />
                    {errorsSignup.email && <p className="field-error">{errorsSignup.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="mobile" className="field-label">Mobile</label>
                    <input id="mobile" {...registerSignup('mobile')} className="field w-full" placeholder="10 digits" />
                    {errorsSignup.mobile && <p className="field-error">{errorsSignup.mobile.message}</p>}
                  </div>
                </div>
                
                <div>
                  <label htmlFor="role_id" className="field-label">Role</label>
                  <select id="role_id" {...registerSignup('role_id')} className="field w-full">
                    <option value="">Select a role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  {errorsSignup.role_id && <p className="field-error">{errorsSignup.role_id.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="password" className="field-label">Password</label>
                    <input id="password" {...registerSignup('password')} type="password" className="field w-full" />
                    {errorsSignup.password && <p className="field-error">{errorsSignup.password.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="confirm_password" className="field-label">Confirm Password</label>
                    <input id="confirm_password" {...registerSignup('confirm_password')} type="password" className="field w-full" />
                    {errorsSignup.confirm_password && <p className="field-error">{errorsSignup.confirm_password.message}</p>}
                  </div>
                </div>

                <button type="submit" disabled={isSubmittingSignup} className="btn btn-rust w-full justify-center mt-2">
                  {isSubmittingSignup ? 'Creating...' : 'Create account'}
                </button>
              </form>

              <div className="mt-8 flex items-center justify-center gap-3 text-[12px] text-steel">
                <Link to="/login" className="hover:text-ink transition-colors">Back to sign in</Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rust to-info mb-2 drop-shadow-sm" style={{ fontFamily: 'Roboto, sans-serif' }}>
                Verify Mobile
              </h1>
              <p className="text-[15px] text-steel font-medium mb-8">Enter the 6-digit code sent to your phone</p>
              
              <form onSubmit={handleOtpSubmit(onVerifyOtp)} className={`space-y-4 ${error ? 'border-l-[0.5px] border-danger pl-4 -ml-[16.5px]' : ''}`}>
                {error && <div className="text-danger text-sm mb-4">{error}</div>}
                
                <div>
                  <label htmlFor="otp_code" className="field-label flex justify-between">
                    <span>6-Digit Code</span>
                  </label>
                  <input id="otp_code" {...registerOtp('otp_code')} className="field w-full text-center text-xl tracking-widest font-mono" placeholder="------" maxLength={6} />
                  {errorsOtp.otp_code && <p className="field-error text-center">{errorsOtp.otp_code.message}</p>}
                </div>

                <button type="submit" disabled={isSubmittingOtp} className="btn btn-rust w-full justify-center mt-4">
                  {isSubmittingOtp ? 'Verifying...' : 'Verify & Login'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
