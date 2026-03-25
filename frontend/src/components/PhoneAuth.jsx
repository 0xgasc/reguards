import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/auth-store';
import toast from 'react-hot-toast';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export default function PhoneAuth() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];

  // Auto-read referral code from URL ?ref=REGXXXXX
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setReferralCode(ref.toUpperCase());
  }, [searchParams]);

  const handlePhoneChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    setPhone(value);
  };

  const handlePinChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!phone || phone.length !== 8) {
      toast.error('Ingresa un número de teléfono válido (8 dígitos)');
      return;
    }

    const fullPin = pin.join('');
    if (fullPin.length !== 4) {
      toast.error('Ingresa tu PIN de 4 dígitos');
      return;
    }

    setLoading(true);

    try {
      // Auto-detect: try login first, then signup
      let response;
      try {
        response = await axios.post(`${API_URL}/api/auth/login`, {
          phone: `+502${phone}`,
          pin: fullPin,
        });
      } catch (loginError) {
        if (loginError.response?.status === 401) {
          // User doesn't exist, try signup
          response = await axios.post(`${API_URL}/api/auth/signup`, {
            phone: `+502${phone}`,
            pin: fullPin,
            referralCode: referralCode || undefined,
          });
          toast.success(referralCode ? '¡Cuenta creada! +50 pts de bienvenida' : '¡Cuenta creada!');
        } else {
          throw loginError;
        }
      }

      if (response.data.success) {
        setAuth(response.data.token, response.data.user);
        toast.success('¡Bienvenido!');

        // Check for post-login redirect (e.g. from check-in QR)
        const afterLogin = sessionStorage.getItem('afterLogin');
        if (afterLogin) {
          sessionStorage.removeItem('afterLogin');
          navigate(afterLogin);
          return;
        }

        // Navigate based on role
        if (response.data.user.role === 'admin') {
          navigate('/admin');
        } else if (response.data.user.role === 'merchant') {
          navigate('/merchant');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error.response?.data?.error || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neobrutalist-white flex items-center justify-center p-4">
      {/* Grid Background */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,0,0,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        ></div>
      </div>

      <div className="relative max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-neobrutalist-black mb-4 font-sans">
            REGUARDS
          </h1>
          <p className="text-xl font-bold text-neobrutalist-gray-800">
            PUNTOS. PREMIOS. SIMPLE.
          </p>
        </div>

        {/* Referral banner */}
        {referralCode && (
          <div className="border-4 border-black bg-yellow-300 px-6 py-3 mb-4 shadow-brutal-sm">
            <div>
              <p className="font-black text-sm">¡FUISTE INVITADO!</p>
              <p className="font-mono text-xs">Código: <strong>{referralCode}</strong> — Ambos ganan 50 puntos</p>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="bg-neobrutalist-white border-4 border-neobrutalist-black shadow-brutal p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Phone Input */}
            <div>
              <label className="block text-sm font-bold text-neobrutalist-black mb-3 uppercase tracking-wide">
                Teléfono
              </label>
              <div className="flex items-center border-4 border-neobrutalist-black bg-neobrutalist-white">
                <span className="px-4 py-3 font-mono font-bold text-neobrutalist-black border-r-4 border-neobrutalist-black">
                  +502
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="flex-1 px-4 py-3 font-mono text-lg font-bold text-neobrutalist-black focus:outline-none bg-transparent"
                  placeholder="5555-5555"
                  maxLength={8}
                  required
                />
              </div>
            </div>

            {/* PIN Input */}
            <div>
              <label className="block text-sm font-bold text-neobrutalist-black mb-3 uppercase tracking-wide">
                PIN de 4 dígitos
              </label>
              <div className="flex gap-4 justify-center">
                {pin.map((digit, index) => (
                  <input
                    key={index}
                    ref={pinRefs[index]}
                    type="text"
                    inputMode="numeric"
                    value={digit}
                    onChange={(e) => handlePinChange(index, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(index, e)}
                    className="w-16 h-16 text-center text-2xl font-bold border-4 border-neobrutalist-black focus:outline-none focus:border-neobrutalist-yellow bg-neobrutalist-white font-mono"
                    maxLength={1}
                    required
                  />
                ))}
              </div>
              <p className="text-xs text-neobrutalist-gray-800 mt-2 text-center font-bold">
                {isSignup
                  ? 'Elige un PIN para tu cuenta'
                  : 'Ingresa tu PIN o crea uno nuevo'}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-neobrutalist-yellow border-4 border-neobrutalist-black py-4 font-bold text-lg uppercase tracking-wider shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-brutal-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </form>

          {/* Info */}
          <div className="mt-6 pt-6 border-t-4 border-neobrutalist-black">
            <p className="text-sm font-bold text-center text-neobrutalist-gray-800">
              Si es tu primera vez, se creará tu cuenta automáticamente
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm font-bold text-neobrutalist-black uppercase tracking-wide">
            GANA PUNTOS • CANJEA PREMIOS • DISFRUTA
          </p>
        </div>
      </div>
    </div>
  );
}
